import '../env.js'
import twilio from 'twilio'
import { withRetryAndTimeout } from './resilienceUtils.js'

const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
const token = process.env.TWILIO_AUTH_TOKEN?.trim()

const rawTwilioClient = twilio(sid, token)

function makeSafeTwilioClient(originalClient) {
  const wrapMethods = ['create', 'update', 'fetch', 'list', 'remove']

  const proxyHandler = {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop)

      if (val === null || val === undefined) {
        return val
      }

      if (typeof val === 'function' && wrapMethods.includes(prop)) {
        return (...args) => {
          return withRetryAndTimeout(
            () => val.apply(target, args),
            { maxAttempts: 3, timeoutMs: 10000, name: `Twilio ${prop}` }
          )
        }
      }

      if (typeof val === 'function') {
        const boundVal = val.bind(target)
        return new Proxy(boundVal, {
          get(subTarget, subProp, subReceiver) {
            return proxyHandler.get(val, subProp, subReceiver)
          },
          apply(subTarget, thisArg, argArray) {
            const result = Reflect.apply(val, target, argArray)
            if (result !== null && typeof result === 'object') {
              return new Proxy(result, proxyHandler)
            }
            return result
          }
        })
      }

      if (typeof val === 'object') {
        return new Proxy(val, proxyHandler)
      }

      return val
    }
  }

  return new Proxy(originalClient, proxyHandler)
}

const twilioClient = makeSafeTwilioClient(rawTwilioClient)

export { twilioClient }
