import redis from '../lib/redis.js'

// Simple in-memory fallback store in case Redis is offline
const memoryStore = new Map()
const MAX_MEMORY_KEYS = 1000

// Rolling window for burst detection across the server (last 5 seconds)
let globalRequestTimes = []

// Sweep memory store for stale keys periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of memoryStore.entries()) {
    if (record.resetTime < now) {
      memoryStore.delete(key)
    }
  }
}, 5 * 60 * 1000).unref()

function detectBurst() {
  const now = Date.now()
  globalRequestTimes.push(now)
  // Prune entries older than 5 seconds
  globalRequestTimes = globalRequestTimes.filter(t => now - t < 5000)
  // If we receive more than 150 requests server-wide in 5 seconds, burst mode is active
  return globalRequestTimes.length > 150
}

export function rateLimiter({ windowMs = 60 * 1000, max = 60, message = 'Too many requests, please try again later.' } = {}) {
  return async (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    const key = `ratelimit:${req.baseUrl + req.path}:${ip}`
    const now = Date.now()

    // Dynamic stale key prune on request path
    if (memoryStore.has(key) && memoryStore.get(key).resetTime < now) {
      memoryStore.delete(key)
    }

    // Burst detection: tighten limits by 20% if server is under high sudden volume
    let dynamicMax = max
    if (detectBurst()) {
      dynamicMax = Math.max(5, Math.floor(max * 0.8))
    }

    // 1. Try Redis first (fully distributed cluster-safe)
    try {
      if (redis.status === 'ready' || redis.status === 'connecting') {
        let current

        // Fallback recovery synchronization: if local map has counter, seed Redis
        const exists = await redis.exists(key).catch(() => 0)
        if (!exists && memoryStore.has(key)) {
          const memRecord = memoryStore.get(key)
          if (memRecord.resetTime > now) {
            const ttlMs = memRecord.resetTime - now
            await redis.set(key, memRecord.count + 1, 'PX', ttlMs).catch(() => {})
            current = memRecord.count + 1
            memoryStore.delete(key) // Evict from memory since synchronized
          }
        }

        if (current === undefined) {
          current = await redis.incr(key)
          if (current === 1) {
            await redis.pexpire(key, windowMs)
          }
        }

        res.setHeader('X-RateLimit-Limit', dynamicMax)
        res.setHeader('X-RateLimit-Remaining', Math.max(0, dynamicMax - current))
        
        if (current > dynamicMax) {
          console.warn(`[RateLimit] Blocked request from IP ${ip} for key ${key}`)
          return res.status(429).json({ error: message })
        }
        return next()
      }
    } catch (err) {
      console.error('[RateLimit] Redis error, falling back to memory:', err.message)
    }

    // 2. Memory fallback (standalone mode)
    let record = memoryStore.get(key)
    if (!record || record.resetTime < now) {
      // Memory Cap Eviction: if size reaches cap, evict first inserted
      if (memoryStore.size >= MAX_MEMORY_KEYS) {
        const oldestKey = memoryStore.keys().next().value
        if (oldestKey) memoryStore.delete(oldestKey)
      }

      record = {
        count: 0,
        resetTime: now + windowMs
      }
    }

    record.count++
    memoryStore.set(key, record)

    res.setHeader('X-RateLimit-Limit', dynamicMax)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, dynamicMax - record.count))

    if (record.count > dynamicMax) {
      console.warn(`[RateLimit] Memory-Blocked request from IP ${ip} for key ${key}`)
      return res.status(429).json({ error: message })
    }

    next()
  }
}
