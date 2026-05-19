import express from 'express'
import { validateTwilio } from '../middleware/twilioAuth.js'
import { inboundHandler, gatherHandler, callStatusHandler, outboundHandler, audioStreamHandler, dialStatusHandler } from '../controllers/webhookCtrl.js'

const router = express.Router()

router.get('/audio', audioStreamHandler)
router.post('/twilio/inbound', validateTwilio, inboundHandler)
router.post('/twilio/outbound-handler', validateTwilio, outboundHandler)
router.post('/twilio/call-status', validateTwilio, callStatusHandler)
router.post('/twilio/gather', validateTwilio, gatherHandler)
router.post('/twilio/dial-status', validateTwilio, dialStatusHandler)

export default router
