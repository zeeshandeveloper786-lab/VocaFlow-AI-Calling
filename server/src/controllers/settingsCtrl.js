import db from '../lib/db.js'

function maskSecret(val) {
  if (!val) return ''
  if (val.length <= 4) return '****'
  return '****' + val.slice(-4)
}

export const getSettings = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId
    const settings = await db.tenantSettings.findUnique({ where: { tenantId } })
    if (!settings) {
      return res.json({
        twilioAccountSid: '',
        twilioAuthToken: '',
        outboundNumber: '',
        inboundNumber: '',
        elevenLabsKey: '',
        openAiKey: ''
      })
    }
    res.json({
      twilioAccountSid: settings.twilioAccountSid || '',
      twilioAuthToken: maskSecret(settings.twilioAuthToken),
      outboundNumber: settings.outboundNumber || '',
      inboundNumber: settings.inboundNumber || '',
      elevenLabsKey: maskSecret(settings.elevenLabsKey),
      openAiKey: maskSecret(settings.openAiKey)
    })
  } catch (err) {
    next(err)
  }
}

export const updateSettings = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId
    const { twilioAccountSid, twilioAuthToken, outboundNumber, inboundNumber, elevenLabsKey, openAiKey } = req.body

    const data = {}
    if (twilioAccountSid !== undefined) data.twilioAccountSid = twilioAccountSid
    if (outboundNumber !== undefined) data.outboundNumber = outboundNumber
    if (inboundNumber !== undefined) data.inboundNumber = inboundNumber
    // Only update secrets if they are not masked (user actually changed them)
    if (twilioAuthToken && !twilioAuthToken.startsWith('****')) data.twilioAuthToken = twilioAuthToken
    if (elevenLabsKey && !elevenLabsKey.startsWith('****')) data.elevenLabsKey = elevenLabsKey
    if (openAiKey && !openAiKey.startsWith('****')) data.openAiKey = openAiKey

    const settings = await db.tenantSettings.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data }
    })

    res.json({
      twilioAccountSid: settings.twilioAccountSid || '',
      twilioAuthToken: maskSecret(settings.twilioAuthToken),
      outboundNumber: settings.outboundNumber || '',
      inboundNumber: settings.inboundNumber || '',
      elevenLabsKey: maskSecret(settings.elevenLabsKey),
      openAiKey: maskSecret(settings.openAiKey)
    })
  } catch (err) {
    next(err)
  }
}
