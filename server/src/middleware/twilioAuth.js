import twilio from 'twilio'

export const validateTwilio = (req, res, next) => {
  // In non-production (local dev / ngrok without TWILIO_AUTH_TOKEN), skip validation
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken || process.env.NODE_ENV !== 'production') {
    return next()
  }

  const signature = req.headers['x-twilio-signature']

  // Must use the exact public URL that was configured in Twilio console
  // req.protocol is unreliable behind proxies/ngrok (returns "http" even for "https" URLs)
  // SERVER_URL must be set to e.g. https://abc123.ngrok.io or your production domain
  const serverUrl = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`
  const url = `${serverUrl}${req.originalUrl}`

  const isValid = twilio.validateRequest(authToken, signature, url, req.body)

  if (!isValid) {
    console.warn(`[twilioAuth] Invalid Twilio signature for ${req.method} ${url}`)
    return res.status(403).send('Invalid Twilio signature')
  }

  next()
}
