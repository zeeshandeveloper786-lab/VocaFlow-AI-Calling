import './env.js'
import './workers/index.js'
import http from 'http'
import app from './app.js'
import db from './lib/db.js'
import { initSocket } from './lib/socket.js'
import redis from './lib/redis.js'
import { twilioClient } from './lib/twilio.js'
import { WebSocketServer } from 'ws'
import { handleMediaStream } from './lib/mediaStream.js'

const PORT = process.env.PORT || 3001

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err)
})

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err)
})

;(async () => {
  try {
    console.log('🚀 Starting server initialization...')

    await db.$connect()
    console.log('✅ Database connected')

    await redis.ping()
    console.log('✅ Redis connected')

    await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch()
    console.log('✅ Twilio ready')

    const server = http.createServer(app)

    initSocket(server)
    console.log('✅ Socket attached')

    const wss = new WebSocketServer({ server, path: '/media-stream' })
    wss.on('connection', handleMediaStream)
    console.log('✅ WebSocket Media Stream server ready')

    server.listen(PORT, () => {
      console.log('\n🎉 === SERVER RUNNING ON PORT ' + PORT + ' ===\n')
    })

  } catch (err) {
    console.error('❌ Failed to start server:', err)
    process.exit(1)
  }
})()
