import redis from './redis.js'

export async function saveCallHistory(callSid, history) {
  await redis.set(
    'history:' + callSid,
    JSON.stringify(history.slice(-10)),
    'EX',
    3600
  )
}

export async function getCallHistory(callSid) {
  try {
    const data = await redis.get('history:' + callSid)
    if (!data) return []
    try {
      return JSON.parse(data)
    } catch {
      console.error('Corrupted call history in Redis for:', callSid)
      await redis.del('history:' + callSid)
      return []
    }
  } catch (err) {
    console.error('Redis error in getCallHistory:', err)
    return []
  }
}

export async function getCallContext(callSid) {
  try {
    const data = await redis.get('call:' + callSid)
    if (!data) return null
    try {
      return JSON.parse(data)
    } catch {
      console.error('Corrupted call context in Redis for:', callSid)
      return null
    }
  } catch (err) {
    console.error('Redis error in getCallContext:', err)
    return null
  }
}

export async function clearCallHistory(callSid) {
  try {
    await Promise.all([
      redis.del('history:' + callSid),
      redis.del('call:' + callSid)
    ])
  } catch (err) {
    console.error('Redis error in clearCallHistory:', err)
  }
}
