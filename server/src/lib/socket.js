import { Server } from 'socket.io'
import { verifyAccess } from './token.js'

let io

function initSocket(server) {
  io = new Server(server, {
    path: '/api/socket.io',
    cors: { origin: ['http://localhost:5173'], credentials: true },
    transports: ['polling', 'websocket'],
    allowUpgrades: true,
    perMessageDeflate: false
  })

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token
      if (!token) throw new Error('No token')
      const payload = verifyAccess(token)
      socket.user = payload
      next()
    } catch (err) {
      next(new Error('Auth failed'))
    }
  })

  io.on('connection', (socket) => {
    console.log('🔌 Socket connected:', socket.user.id)
    socket.join(`tenant-${socket.user.tenantId}`)
    socket.join(socket.user.tenantId)
    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected:', socket.user.id)
    })
  })

  return io
}

// Stores recent emitted events to prevent flood and duplicate payloads
const recentEmits = new Map()

// Clean up recentEmits periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of recentEmits.entries()) {
    if (now - record.timestamp > 10000) {
      recentEmits.delete(key)
    }
  }
}, 30000).unref()

function getPayloadHash(payload) {
  if (!payload) return ''
  try {
    return JSON.stringify(payload)
  } catch {
    return String(payload)
  }
}

function shouldSuppressEvent(room, eventName, payload) {
  const now = Date.now()
  const key = `${room}:${eventName}`
  const hash = getPayloadHash(payload)

  const record = recentEmits.get(key)
  if (record) {
    const elapsed = now - record.timestamp
    const isSamePayload = record.payloadHash === hash

    // Soft Throttle: suppress same event emitted within 50ms
    if (elapsed < 50) {
      return true
    }

    // Duplicate payload suppression: ignore identical payload within 500ms
    if (isSamePayload && elapsed < 500) {
      return true
    }
  }

  recentEmits.set(key, { timestamp: now, payloadHash: hash })
  return false
}

// Proxies the socket/server instance to intercept emit calls dynamically
function makeSafeEmitter(emitter, currentRoom = 'global') {
  if (!emitter) return emitter
  return new Proxy(emitter, {
    get(target, prop, receiver) {
      if (prop === 'to' || prop === 'in') {
        return (roomName) => {
          const originalRoomObject = target[prop](roomName)
          return makeSafeEmitter(originalRoomObject, roomName)
        }
      }

      if (prop === 'emit') {
        return (eventName, ...args) => {
          const payload = args[0]
          if (shouldSuppressEvent(currentRoom, eventName, payload)) {
            // Silently suppress the duplicate/flooded websocket emission
            return target
          }
          return target.emit(eventName, ...args)
        }
      }

      const val = Reflect.get(target, prop, receiver)
      if (typeof val === 'function') {
        return val.bind(target)
      }
      return val
    }
  })
}

function getIO() {
  if (!io) throw new Error("Socket.IO not initialized")
  return makeSafeEmitter(io)
}

export { initSocket, getIO }
