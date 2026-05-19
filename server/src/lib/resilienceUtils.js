/**
 * Resilience Utilities for VocaFlow
 * Standardizes Circuit Breakers, Sequential Retries with Jitter, and Hard Timeouts.
 */

// Simple structured logger helper that prevents logging PII
export function logResilience(event, details = {}) {
  const logObj = {
    timestamp: new Date().toISOString(),
    event,
    ...details
  }
  console.log(`[Resilience] ${JSON.stringify(logObj)}`)
}

export class CircuitBreaker {
  constructor({ name, failureThreshold = 5, cooldownMs = 15000, windowMs = 30000, fallbackValue = null }) {
    this.name = name
    this.failureThreshold = failureThreshold
    this.cooldownMs = cooldownMs
    this.windowMs = windowMs
    this.fallbackValue = fallbackValue

    this.state = 'CLOSED' // CLOSED, OPEN, HALF_OPEN
    this.failures = []
    this.openUntil = 0
  }

  recordSuccess() {
    if (this.state !== 'CLOSED') {
      logResilience('CIRCUIT_STATE_CHANGE', { name: this.name, oldState: this.state, newState: 'CLOSED' })
      this.state = 'CLOSED'
    }
    this.failures = []
  }

  recordFailure(err) {
    const now = Date.now()
    this.failures.push(now)
    // Filter failures within the window
    this.failures = this.failures.filter(time => now - time < this.windowMs)

    if (this.state === 'HALF_OPEN') {
      logResilience('CIRCUIT_STATE_CHANGE', {
        name: this.name,
        oldState: this.state,
        newState: 'OPEN',
        reason: 'Half-open test request failed',
        error: err?.message || String(err)
      })
      this.state = 'OPEN'
      this.openUntil = now + this.cooldownMs
    } else if (this.state === 'CLOSED' && this.failures.length >= this.failureThreshold) {
      logResilience('CIRCUIT_STATE_CHANGE', {
        name: this.name,
        oldState: this.state,
        newState: 'OPEN',
        reason: `Exceeded ${this.failureThreshold} failures in ${this.windowMs / 1000}s`,
        error: err?.message || String(err)
      })
      this.state = 'OPEN'
      this.openUntil = now + this.cooldownMs
    }
  }

  execute(fn, degradedFallback = null) {
    const now = Date.now()

    if (this.state === 'OPEN') {
      if (now > this.openUntil) {
        logResilience('CIRCUIT_STATE_CHANGE', { name: this.name, oldState: 'OPEN', newState: 'HALF_OPEN' })
        this.state = 'HALF_OPEN'
      } else {
        logResilience('CIRCUIT_BLOCKED_REQUEST', { name: this.name, state: this.state, openUntil: new Date(this.openUntil).toISOString() })
        if (degradedFallback !== null) return degradedFallback()
        if (typeof this.fallbackValue === 'function') return this.fallbackValue()
        return this.fallbackValue
      }
    }

    try {
      const result = fn()
      if (result instanceof Promise) {
        return result
          .then(val => {
            this.recordSuccess()
            return val;
          })
          .catch(err => {
            this.recordFailure(err)
            throw err;
          })
      } else {
        this.recordSuccess()
        return result
      }
    } catch (err) {
      this.recordFailure(err)
      throw err
    }
  }
}

/**
 * Standardized retry runner with timeout and jitter.
 * Prevents overlapping retries (executes sequentially).
 */
export async function withRetryAndTimeout(fn, {
  maxAttempts = 3,
  timeoutMs = 8000,
  baseDelay = 300,
  maxDelay = 3000,
  name = 'API Call'
} = {}) {
  let delay = baseDelay

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let timeoutId = null
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    try {
      // Execute the fn raced with the timeout
      const result = await Promise.race([
        fn(),
        timeoutPromise
      ])
      clearTimeout(timeoutId)
      return result
    } catch (err) {
      clearTimeout(timeoutId)
      logResilience('RETRY_ATTEMPT_FAILED', {
        name,
        attempt,
        maxAttempts,
        error: err.message || String(err)
      })

      if (attempt >= maxAttempts) {
        logResilience('RETRY_EXHAUSTED', {
          name,
          maxAttempts,
          error: err.message || String(err)
        })
        throw err
      }

      // Calculate exponential backoff with full jitter
      const exponentialDelay = Math.min(maxDelay, delay * Math.pow(2, attempt - 1))
      // Jitter range [0.5 * delay, 1.5 * delay]
      const jitter = (Math.random() - 0.5) * exponentialDelay * 0.5
      const finalDelay = Math.max(50, Math.floor(exponentialDelay + jitter))

      await new Promise(r => setTimeout(r, finalDelay))
    }
  }
}
