import '../env.js'
import { google } from 'googleapis'
import db from './db.js'
import redis from './redis.js'
import { withRetryAndTimeout } from './resilienceUtils.js'

function makeSafeCalendarClient(originalCalendar) {
  const wrapMethods = ['list', 'insert', 'patch', 'delete', 'query']

  const proxyHandler = {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, receiver)

      if (typeof val === 'function') {
        if (wrapMethods.includes(prop)) {
          return (...args) => {
            return withRetryAndTimeout(
              () => val.apply(target, args),
              { maxAttempts: 3, timeoutMs: 10000, name: `Google Calendar ${prop}` }
            )
          }
        }
        return val.bind(target)
      }

      if (val !== null && typeof val === 'object') {
        return new Proxy(val, proxyHandler)
      }

      return val
    }
  }

  return new Proxy(originalCalendar, proxyHandler)
}

const originalCalendarCreator = google.calendar.bind(google)
google.calendar = function(...args) {
  const inst = originalCalendarCreator(...args)
  return makeSafeCalendarClient(inst)
}

const originalOAuth = google.auth.OAuth2
google.auth.OAuth2 = class extends originalOAuth {
  getToken(...args) {
    return withRetryAndTimeout(
      () => super.getToken(...args),
      { maxAttempts: 3, timeoutMs: 10000, name: 'Google OAuth getToken' }
    )
  }
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.SERVER_URL}/calendar/callback`
)

function getAuthUrl(tenantId) {
  const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64')
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state
  })
}

async function handleCallback(code, tenantId) {
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  const calList = await calendar.calendarList.list()
  const primary = calList.data.items?.find(c => c.primary)

  const updateData = {
    googleAccessToken: tokens.access_token,
    googleCalendarId: primary?.id || 'primary'
  }
  // Only update refresh token if we got one (Google only sends it on first auth)
  if (tokens.refresh_token) {
    updateData.googleRefreshToken = tokens.refresh_token
  }

  await db.tenant.update({
    where: { id: tenantId },
    data: updateData
  })
}

async function getAvailableSlots(tenantId, date) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
  auth.setCredentials({ access_token: tenant.googleAccessToken, refresh_token: tenant.googleRefreshToken })
  const calendar = google.calendar({ version: 'v3', auth })
  const dayStart = new Date(date + 'T00:00:00Z')
  const dayEnd = new Date(date + 'T23:59:59Z')
  const busy = await calendar.freebusy.query({
    requestBody: { timeMin: dayStart.toISOString(), timeMax: dayEnd.toISOString(), items: [{ id: 'primary' }] }
  })
  const busySlots = busy.data.calendars.primary.busy
  const slots = []
  for (let h = 9; h < 17; h++) {
    for (let m = 0; m < 60; m += 30) {
      const start = new Date(date + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00Z')
      const end = new Date(start.getTime() + 30 * 60000)
      const conflict = busySlots.some(b => new Date(b.start) < end && new Date(b.end) > start)
      if (!conflict) slots.push({ start: start.toISOString(), end: end.toISOString() })
    }
  }
  return slots
}

async function createEvent(tenantId, title, startTime, endTime, attendeeEmail) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
  auth.setCredentials({ access_token: tenant.googleAccessToken, refresh_token: tenant.googleRefreshToken })
  const calendar = google.calendar({ version: 'v3', auth })
  const event = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: title,
      start: { dateTime: startTime },
      end: { dateTime: endTime },
      attendees: attendeeEmail ? [{ email: attendeeEmail }] : []
    }
  })
  return event.data.id
}

async function updateEvent(tenantId, eventId, startTime, endTime) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
  auth.setCredentials({ access_token: tenant.googleAccessToken, refresh_token: tenant.googleRefreshToken })
  const calendar = google.calendar({ version: 'v3', auth })
  await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: {
      start: { dateTime: startTime },
      end: { dateTime: endTime }
    }
  })
  return eventId
}

async function deleteEvent(tenantId, eventId) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
  auth.setCredentials({ access_token: tenant.googleAccessToken, refresh_token: tenant.googleRefreshToken })
  const calendar = google.calendar({ version: 'v3', auth })
  await calendar.events.delete({ calendarId: 'primary', eventId })
  return true
}

async function getClient(tenantId) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant?.googleRefreshToken) throw new Error('No Google auth')

  oauth2Client.setCredentials({
    access_token: tenant.googleAccessToken,
    refresh_token: tenant.googleRefreshToken
  })

  return oauth2Client
}

async function getSlots(tenantId, dateStr) {
  const auth = await getClient(tenantId)
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
  const calendar = google.calendar({ version: 'v3', auth })

  const start = new Date(dateStr)
  start.setHours(9, 0, 0, 0)
  const end = new Date(dateStr)
  end.setHours(17, 0, 0, 0)

  const events = await calendar.events.list({
    calendarId: tenant.googleCalendarId,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  })

  const busy = events.data.items?.map(e => ({
    start: new Date(e.start?.dateTime || e.start?.date),
    end: new Date(e.end?.dateTime || e.end?.date)
  })) || []

  const slots = []
  let current = new Date(start)
  while (current < end) {
    const slotEnd = new Date(current.getTime() + 30 * 60000)
    const isFree = !busy.some(b => !(slotEnd <= b.start || current >= b.end))
    if (isFree) {
      slots.push({ start: current.toISOString(), end: slotEnd.toISOString() })
    }
    current = slotEnd
    if (slots.length >= 5) break
  }

  return slots
}

async function bookSlot(tenantId, slot, leadName, leadPhone) {
  const auth = await getClient(tenantId)
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
  const calendar = google.calendar({ version: 'v3', auth })

  const lockKey = `lock:booking:${tenantId}:${slot.start}`
  const lockToken = Math.random().toString(36).slice(2) + Date.now().toString(36)
  let lockAcquired = false
  let renewInterval = null

  try {
    // 1. Concurrency check: Redis atomic lock (expires in 10s to prevent deadlock)
    if (redis.status === 'ready' || redis.status === 'connecting') {
      const result = await redis.set(lockKey, lockToken, 'NX', 'EX', 10)
      if (!result) {
        throw new Error('This time slot is currently being reserved by another user. Please choose a different slot.')
      }
      lockAcquired = true

      // Heartbeat lease renewal mechanism to prevent premature TTL expiration on slow Google APIs
      renewInterval = setInterval(async () => {
        try {
          const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
              return redis.call("expire", KEYS[1], 10)
            else
              return 0
            end
          `
          await redis.eval(script, 1, lockKey, lockToken)
        } catch (err) {
          console.error('[Lock Renewal] Failed to renew lock:', err.message)
        }
      }, 3000)
    }

    // 2. Double-check Google Calendar conflicts
    const existingEvents = await calendar.events.list({
      calendarId: tenant.googleCalendarId || 'primary',
      timeMin: slot.start,
      timeMax: slot.end,
      singleEvents: true
    }).catch(() => ({ data: { items: [] } }))

    if (existingEvents?.data?.items && existingEvents.data.items.length > 0) {
      throw new Error('This time slot has already been booked. Please choose a different slot.')
    }

    // 3. Perform insertion
    const event = await calendar.events.insert({
      calendarId: tenant.googleCalendarId || 'primary',
      requestBody: {
        summary: `Call with ${leadName}`,
        description: `Phone: ${leadPhone}`,
        start: { dateTime: slot.start },
        end: { dateTime: slot.end }
      }
    })

    return { link: event.data.htmlLink, eventId: event.data.id }
  } finally {
    // Clean up heartbeat
    if (renewInterval) {
      clearInterval(renewInterval)
    }
    // 4. Release Redis lock safely (ONLY if token matches to avoid releasing someone else's premature lock)
    if (lockAcquired) {
      try {
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `
        await redis.eval(script, 1, lockKey, lockToken)
      } catch (err) {
        console.error('[Lock Release] Safe lock release error:', err.message)
        await redis.del(lockKey).catch(() => {})
      }
    }
  }
}

export { getAuthUrl, handleCallback, getAvailableSlots, createEvent, updateEvent, deleteEvent, getClient, getSlots, bookSlot }
