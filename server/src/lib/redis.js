import '../env.js'
import Redis from 'ioredis'

const isTls = process.env.REDIS_URL?.startsWith('rediss://')
const redis = new Redis(process.env.REDIS_URL, {
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
  maxRetriesPerRequest: null,
  lazyConnect: true,
})

redis.on('error', (err) => console.error('Redis error:', err.message))

export default redis