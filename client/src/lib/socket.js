import { io } from 'socket.io-client'
import useAuthStore from '../store/authStore'

let socket = null
let safeSocketProxy = null

const recentEvents = new Map()

// Sweep periodically to prevent memory leaks in the browser
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of recentEvents.entries()) {
    if (now - record.timestamp > 10000) {
      recentEvents.delete(key)
    }
  }
}, 30000)

function shouldSuppress(eventName, payload) {
  const now = Date.now()
  const hash = payload ? JSON.stringify(payload) : ''
  const key = eventName
  const record = recentEvents.get(key)

  if (record) {
    const elapsed = now - record.timestamp
    const isSamePayload = record.payloadHash === hash

    // Soft Throttle: if same event type received within 50ms, suppress it
    if (elapsed < 50) return true

    // Duplicate payload suppression within 500ms
    if (isSamePayload && elapsed < 500) return true
  }

  recentEvents.set(key, { timestamp: now, payloadHash: hash })
  return false
}

function makeSafeClientSocket(clientSocket) {
  if (!clientSocket) return clientSocket
  return new Proxy(clientSocket, {
    get(target, prop, receiver) {
      if (prop === 'on') {
        return (eventName, listener) => {
          const wrappedListener = (...args) => {
            const payload = args[0]
            if (!shouldSuppress(eventName, payload)) {
              listener(...args)
            }
          }
          return target.on(eventName, wrappedListener)
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

export function getSocket() {
  if (!socket) {
    const token = useAuthStore.getState().token
    socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
      path: '/api/socket.io',
      auth: { token },
      autoConnect: false,
      transports: ['polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })
    safeSocketProxy = makeSafeClientSocket(socket)
  }
  return safeSocketProxy
}

export function connectSocket() {
  const s = getSocket()
  // Since s is a proxy, we retrieve the underlying socket to connect or read status
  if (!socket.connected) {
    const token = useAuthStore.getState().token
    socket.auth = { token }
    socket.connect()
  }
  return s
}

export default getSocket()
