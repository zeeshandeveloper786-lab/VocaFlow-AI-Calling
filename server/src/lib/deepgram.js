import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import { CircuitBreaker } from './resilienceUtils.js'

const deepgram = createClient(process.env.DEEPGRAM_API_KEY)

const deepgramReconnectorBreaker = new CircuitBreaker({
  name: 'DeepgramReconnect',
  failureThreshold: 5,
  cooldownMs: 20000,
  windowMs: 30000
})

class SafeDeepgramConnection {
  constructor(onFinal, onInterim) {
    this.onFinal = onFinal
    this.onInterim = onInterim
    this.intentionalClose = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.baseDelay = 1000 // 1s base
    this.isReconnecting = false
    this.audioQueue = [] // Internal audio frame buffer queue during reconnection
    this.conn = null
    this.connect()
  }

  connect() {
    try {
      console.log(`[Deepgram] Establishing connection (attempt ${this.reconnectAttempts + 1})...`)
      this.conn = deepgram.listen.live({
        model: 'nova-2-phonecall',
        language: 'en-US',
        smart_format: true,
        interim_results: true,
        utterance_end_ms: 1000,
        vad_events: true,
        endpointing: 300,
        encoding: 'mulaw',
        sample_rate: 8000,
        keepAlive: true
      })

      this.conn.on(LiveTranscriptionEvents.Open, () => {
        console.log('[Deepgram] Connection established successfully')
        this.reconnectAttempts = 0
        this.isReconnecting = false
        deepgramReconnectorBreaker.recordSuccess()
        this.flushAudioQueue()
      })

      this.conn.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript
        const isFinal = data.is_final
        if (transcript) {
          if (isFinal) {
            if (this.onFinal) this.onFinal(transcript)
          } else {
            if (this.onInterim) this.onInterim(transcript)
          }
        }
      })

      this.conn.on(LiveTranscriptionEvents.Error, (err) => {
        console.error('[Deepgram] Live connection error:', err.message || err)
        deepgramReconnectorBreaker.recordFailure(err)
      })

      this.conn.on(LiveTranscriptionEvents.Close, () => {
        console.log('[Deepgram] Connection closed')
        if (!this.intentionalClose) {
          this.handleReconnect()
        }
      })
    } catch (err) {
      console.error('[Deepgram] Connection setup failed:', err.message || err)
      deepgramReconnectorBreaker.recordFailure(err)
      if (!this.intentionalClose) {
        this.handleReconnect()
      }
    }
  }

  handleReconnect() {
    if (this.isReconnecting) return
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Deepgram] Maximum reconnect attempts reached. Stream recovery failed.')
      return
    }

    this.isReconnecting = true
    const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts++

    console.log(`[Deepgram] Reconnecting in ${delay}ms...`)
    setTimeout(() => {
      this.isReconnecting = false
      if (!this.intentionalClose) {
        deepgramReconnectorBreaker.execute(() => {
          this.connect()
        }, () => {
          console.warn('[Deepgram] Reconnection blocked by Circuit Breaker. Postponing attempt.')
          this.isReconnecting = false
          this.handleReconnect() // Keep scheduling next slot
        })
      }
    }, delay)
  }

  send(audioBuffer) {
    if (this.conn && this.conn.getReadyState() === 1) {
      try {
        this.conn.send(audioBuffer)
      } catch (err) {
        console.error('[Deepgram] Failed to send audio buffer, buffering frame:', err.message || err)
        this.queueAudio(audioBuffer)
      }
    } else {
      this.queueAudio(audioBuffer)
    }
  }

  queueAudio(audioBuffer) {
    if (this.audioQueue.length < 100) {
      this.audioQueue.push(audioBuffer)
    } else {
      this.audioQueue.shift() // Remove oldest to preserve memory cap
      this.audioQueue.push(audioBuffer)
    }
  }

  flushAudioQueue() {
    if (this.audioQueue.length > 0) {
      console.log(`[Deepgram] Flushing ${this.audioQueue.length} buffered audio frames...`)
      while (this.audioQueue.length > 0) {
        const frame = this.audioQueue.shift()
        this.send(frame)
      }
    }
  }

  getReadyState() {
    return this.conn ? this.conn.getReadyState() : 0
  }

  finish() {
    this.intentionalClose = true
    if (this.conn) {
      try {
        this.conn.finish()
      } catch (err) {
        console.error('[Deepgram] Error terminating connection:', err.message || err)
      }
    }
  }
}

export function createDeepgramConnection(onFinal, onInterim) {
  return new SafeDeepgramConnection(onFinal, onInterim)
}

export function closeConnection(conn) {
  if (conn) {
    conn.intentionalClose = true
    try {
      conn.finish()
    } catch (err) {
      console.error('Error closing Deepgram connection:', err)
    }
  }
}

export function sendAudioToDeepgram(connection, audioBuffer) {
  if (connection && connection.getReadyState() === 1) {
    connection.send(audioBuffer)
  }
}
