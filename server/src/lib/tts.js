import '../env.js'
import { CircuitBreaker, withRetryAndTimeout } from './resilienceUtils.js'

const ttsBreaker = new CircuitBreaker({
  name: 'ElevenLabs',
  failureThreshold: 5,
  cooldownMs: 20000,
  windowMs: 30000,
  fallbackValue: null
})

export async function synthesizeSpeech(text, voiceId) {
  if (!voiceId || !process.env.ELEVENLABS_API_KEY) {
    return null
  }

  return ttsBreaker.execute(async () => {
    return await withRetryAndTimeout(async () => {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: {
              stability: 0.4,
              similarity_boost: 0.8,
              style: 0.0,
              use_speaker_boost: true
            }
          })
        }
      )

      if (!response.ok) {
        throw new Error(`ElevenLabs returned status ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    }, { maxAttempts: 3, timeoutMs: 8000, name: 'ElevenLabs TTS' })
  }, () => null)
}
