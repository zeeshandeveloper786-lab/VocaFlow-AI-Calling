
import { queryRAG } from "../lib/rag.js"
import { analyzeSentiment } from "../lib/sentiment.js"
import { handleObjection } from "../lib/objections.js"
import { scoreCall } from "../lib/scorer.js"
import { analyzeCall } from "../lib/coach.js"
import { getIO } from "../lib/socket.js"
import redis from "../lib/redis.js"
import prisma from "../lib/db.js"
import pkg from "twilio"
import { synthesizeSpeech } from "../lib/tts.js"
import { generateReply, buildSystemPrompt } from "../lib/llm.js"
const { twiml: { VoiceResponse } } = pkg

import { saveCallHistory, getCallHistory, clearCallHistory } from "../lib/callContext.js"

export const audioStreamHandler = async (req, res) => {
  try {
    const { text, voiceId } = req.query
    if (!text || !voiceId) {
      return res.sendStatus(400)
    }
    const audioBuffer = await synthesizeSpeech(decodeURIComponent(text), voiceId)
    if (!audioBuffer) {
      const twiml = new VoiceResponse()
      twiml.say({ voice: "alice" }, decodeURIComponent(text))
      return res.type("text/xml").send(twiml.toString())
    }
    
    res.set('Content-Type', 'audio/mulaw; rate=8000')
    res.set('Content-Length', audioBuffer.length)
    return res.send(audioBuffer)
  } catch (err) {
    console.error('Audio stream error:', err)
    const twiml = new VoiceResponse()
    twiml.say({ voice: "alice" }, "Sorry, an error occurred.")
    res.type("text/xml").send(twiml.toString())
  }
}

export const inboundHandler = async (req, res) => {
  try {
    const calledNumber = req.body.To

    // Find agent via PhoneNumber table
    let agent = null
    let tenantId = null

    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { number: calledNumber },
      include: { agent: { include: { transferPhoneNumber: true, knowledgeDoc: true } } }
    })
    if (phoneNumber) {
      tenantId = phoneNumber.tenantId
      agent = phoneNumber.agent
    }

    // Fallback: any active agent for this tenant
    if (tenantId && !agent) {
      agent = await prisma.agent.findFirst({
        where: { tenantId, deletedAt: null },
        include: { transferPhoneNumber: true, knowledgeDoc: true }
      })
    }

    if (!tenantId || !agent) {
      const twiml = new VoiceResponse()
      twiml.say({ voice: "alice" }, "Sorry, this number is not configured.")
      return res.type("text/xml").send(twiml.toString())
    }

    const call = await prisma.call.create({
      data: { tenantId, agentId: agent.id, direction: "INBOUND", status: "INITIATED", twilioSid: req.body.CallSid }
    })
    await redis.set("call:" + req.body.CallSid, JSON.stringify({
      callId: call.id, agentId: agent.id, tenantId,
      agentSystemPrompt: agent.systemPrompt, agentType: agent.agentType
    }))

    const twiml = new VoiceResponse()
    const openingText = `Hello, this is ${agent.name}. How can I help you today?`
    if (agent.voiceId && process.env.ELEVENLABS_API_KEY) {
      twiml.play(process.env.SERVER_URL + "/webhooks/audio?text=" + encodeURIComponent(openingText) + "&voiceId=" + agent.voiceId)
    } else {
      twiml.say({ voice: "alice" }, openingText)
    }

    if (process.env.USE_DEEPGRAM_STREAMING === 'true') {
      const start = twiml.start()
      start.stream({ url: 'wss://' + req.headers.host + '/media-stream', track: 'inbound_track' })
      twiml.pause({ length: 60 })
    } else {
      twiml.gather({
        input: "speech", speechModel: "phone_call", enhanced: "true",
        speechTimeout: "auto", timeout: 8,
        action: process.env.SERVER_URL + "/webhooks/twilio/gather",
        method: "POST", language: agent.language || "en-US", profanityFilter: false
      })
    }

    res.type("text/xml").send(twiml.toString())
  } catch (err) {
    console.error(err)
    const twiml = new VoiceResponse()
    twiml.say({ voice: "alice" }, "Sorry, an error occurred.")
    res.type("text/xml").send(twiml.toString())
  }
}

export const outboundHandler = async (req, res) => {
  try {
    console.log('SERVER_URL (outbound):', process.env.SERVER_URL)
    const callSid = req.body.CallSid
    const ctxRaw = await redis.get("call:" + callSid)
    const ctx = ctxRaw ? JSON.parse(ctxRaw) : {}
    if (ctx.tenantId) {
      getIO().to(ctx.tenantId).emit('call_status', {
        status: 'connecting',
        message: 'Connecting to caller...',
        callSid
      })
    }
    if (!ctx.agentId) {
      const twiml = new VoiceResponse()
      twiml.say({ voice: "alice" }, "Sorry, an error occurred.")
      return res.type("text/xml").send(twiml.toString())
    }
    const agent = await prisma.agent.findUnique({ 
      where: { id: ctx.agentId },
      include: { transferPhoneNumber: true, knowledgeDoc: true }
    })
    if (!agent) {
      const twiml = new VoiceResponse()
      twiml.say({ voice: "alice" }, "Sorry, an error occurred.")
      return res.type("text/xml").send(twiml.toString())
    }
    const call = await prisma.call.upsert({ 
      where: { twilioSid: callSid },
      update: {},
      create: { 
        tenantId: ctx.tenantId, 
        agentId: agent.id, 
        leadId: ctx.leadId, 
        direction: "OUTBOUND", 
        status: "INITIATED", 
        twilioSid: callSid 
      } 
    })
    await redis.set("call:" + callSid, JSON.stringify({ 
      callId: call.id, 
      agentId: agent.id, 
      tenantId: ctx.tenantId, 
      leadId: ctx.leadId, 
      knowledgeDocId: agent.knowledgeDocId || ctx.knowledgeDocId, 
      agentSystemPrompt: agent.systemPrompt, 
      agentType: agent.agentType 
    }))
    const twiml = new VoiceResponse()
    const openingText = `Hello, this is ${agent.name}. How can I help you today?`
    if (agent.voiceId && process.env.ELEVENLABS_API_KEY) {
      const audioUrl = process.env.SERVER_URL + '/webhooks/audio?text=' + encodeURIComponent(openingText) + '&voiceId=' + agent.voiceId
      twiml.play(audioUrl)
    } else {
      twiml.say({ voice: 'alice' }, openingText)
    }
    
    if (process.env.USE_DEEPGRAM_STREAMING === 'true') {
      const start = twiml.start()
      start.stream({
        url: 'wss://' + req.headers.host + '/media-stream',
        track: 'inbound_track'
      })
      twiml.pause({ length: 60 })
    } else {
      twiml.gather({
        input: 'speech',
        speechModel: 'phone_call',
        enhanced: 'true',
        speechTimeout: 'auto',
        timeout: 10,
        action: process.env.SERVER_URL + '/webhooks/twilio/gather',
        method: 'POST',
        language: 'en-US',
        profanityFilter: 'false'
      })
    }
    
    console.log('TwiML (outbound):', twiml.toString())
    res.type('text/xml').send(twiml.toString())
  } catch (err) {
    console.error(err)
    const twiml = new VoiceResponse()
    twiml.say({ voice: "alice" }, "Sorry, an error occurred.")
    res.type("text/xml").send(twiml.toString())
  }
}

export const gatherHandler = async (req, res) => {
  try {
    const speechResult = req.body.SpeechResult || ""
    const callSid = req.body.CallSid
    const ctxRaw = await redis.get("call:" + callSid)
    const ctx = ctxRaw ? JSON.parse(ctxRaw) : {}
    const call = await prisma.call.findFirst({ where: { twilioSid: callSid } })
    const agent = ctx.agentId ? await prisma.agent.findUnique({ 
      where: { id: ctx.agentId },
      include: { transferPhoneNumber: true, knowledgeDoc: true }
    }) : null
    const tenantId = ctx.tenantId || call?.tenantId
    const io = getIO()

    if (!speechResult || speechResult.trim() === "") {
      const twiml = new VoiceResponse()
      const repeatText = "I didn't catch that, could you repeat please?"
      if (agent?.voiceId && process.env.ELEVENLABS_API_KEY) {
        twiml.play(process.env.SERVER_URL + "/webhooks/audio?text=" + encodeURIComponent(repeatText) + "&voiceId=" + agent.voiceId)
      } else {
        twiml.say({ voice: "alice" }, repeatText)
      }
      twiml.gather({
        input: "speech",
        speechModel: "phone_call",
        enhanced: "true",
        speechTimeout: "auto",
        timeout: 8,
        action: process.env.SERVER_URL + "/webhooks/twilio/gather",
        method: "POST",
        language: agent?.language || "en-US",
        profanityFilter: false
      })
      return res.type("text/xml").send(twiml.toString())
    }

    if (!agent) {
      const twiml = new VoiceResponse()
      twiml.say({ voice: "alice" }, "Sorry, an error occurred.")
      return res.type("text/xml").send(twiml.toString())
    }

    const [history, ragContext] = await Promise.all([
      getCallHistory(callSid),
      queryRAG(speechResult, tenantId, agent.knowledgeDocId).catch(() => '')
    ])
    const systemPrompt = buildSystemPrompt(agent, ragContext)
    const aiReply = await generateReply(systemPrompt, history, speechResult)

    if (aiReply.includes('[TRANSFER_TO_HUMAN]') && agent.transferPhoneNumber) {
      const twiml = new VoiceResponse()
      twiml.say({ voice: "alice" }, "Please hold while I transfer you to a human agent.")
      twiml.dial(agent.transferPhoneNumber.number)
      await prisma.call.update({
        where: { id: ctx.callId },
        data: { status: 'TRANSFERRED' }
      })
      return res.type('text/xml').send(twiml.toString())
    }

    history.push({ role: 'user', content: speechResult })
    history.push({ role: 'assistant', content: aiReply })
    await saveCallHistory(callSid, history)
    const newTranscript = (call?.transcript || '') + '\nCaller: ' + speechResult + '\nAI: ' + aiReply
    await prisma.call.update({
      where: { id: ctx.callId },
      data: { transcript: newTranscript }
    })

    const sentimentResult = await analyzeSentiment(speechResult).catch(() => ({ sentiment: 'NEUTRAL', score: 50 }))
    await prisma.call.update({
      where: { id: ctx.callId },
      data: {
        sentiment: sentimentResult.sentiment,
        sentimentScore: sentimentResult.score
      }
    })
    const objection = await handleObjection(speechResult, tenantId).catch(() => null)
    if (objection?.detected) {
      io.to(tenantId).emit('objection_detected', {
        type: objection.type,
        response: objection.response
      })
    }

    io.to(tenantId).emit('transcript', {
      role: 'caller',
      text: speechResult,
      callId: ctx.callId
    })
    io.to(tenantId).emit('transcript', {
      role: 'ai',
      text: aiReply,
      callId: ctx.callId
    })
    io.to(tenantId).emit('sentiment', {
      sentiment: sentimentResult.sentiment,
      callId: ctx.callId
    })

    const twiml = new VoiceResponse()
    if (agent.voiceId && process.env.ELEVENLABS_API_KEY) {
      const audioUrl = process.env.SERVER_URL + '/webhooks/audio?text=' + encodeURIComponent(aiReply) + '&voiceId=' + agent.voiceId
      twiml.play(audioUrl)
    } else {
      twiml.say({
        voice: 'alice',
        language: agent.language || 'en-US'
      }, aiReply)
    }

    twiml.gather({
      input: 'speech',
      speechModel: 'phone_call',
      enhanced: 'true',
      speechTimeout: 'auto',
      timeout: 8,
      action: process.env.SERVER_URL + '/webhooks/twilio/gather',
      method: 'POST',
      language: agent.language || 'en-US',
      profanityFilter: false
    })
    return res.type('text/xml').send(twiml.toString())
  } catch (err) {
    console.error(err)
    const twiml = new VoiceResponse()
    twiml.say({ voice: "alice" }, "Sorry, an error occurred.")
    res.type("text/xml").send(twiml.toString())
  }
}

export const callStatusHandler = async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body
    if (CallStatus === "completed") {
      const call = await prisma.call.findFirst({ 
        where: { twilioSid: CallSid }, 
        include: { lead: true, agent: true } 
      })
      if (call && call.status !== 'COMPLETED' && call.status !== 'FAILED') {
        const updated = await prisma.call.updateMany({ 
          where: { id: call.id, NOT: { status: { in: ['COMPLETED', 'FAILED'] } } }, 
          data: { status: "COMPLETED", duration: parseInt(CallDuration || "0") } 
        })
        
        if (updated.count > 0) {
          await scoreCall(call.transcript, call.leadId, call.tenantId, call.id).catch(() => {})
          await analyzeCall(call.id, call.tenantId).catch(() => {})
          
          if (call.lead && call.lead.status === "PENDING") {
            await prisma.lead.update({ 
              where: { id: call.leadId }, 
              data: { status: "CONTACTED" } 
            })
          }
          
          getIO().to(call.tenantId).emit('call_status', {
            status: 'ended',
            message: 'Call ended',
            duration: CallDuration,
            score: null // Score might be async calculated later
          })
        }
        await clearCallHistory(CallSid).catch(() => {})
      }
    } else if (["failed","busy","no-answer"].includes(CallStatus)) {
      const calls = await prisma.call.findMany({
        where: { twilioSid: CallSid },
        include: { lead: true }
      })
      await prisma.call.updateMany({ 
        where: { twilioSid: CallSid }, 
        data: { status: "MISSED" } 
      })
      for (const call of calls) {
        if (call.leadId) {
          await prisma.lead.update({
            where: { id: call.leadId },
            data: { status: "FAILED" }
          }).catch(() => {})
        }
        try {
          getIO().to(call.tenantId).emit('dialer_job_status', {
            status: CallStatus, // 'failed' | 'busy' | 'no-answer'
            leadId: call.leadId,
            name: call.lead?.name,
            phone: call.lead?.phone,
            error: `Call ended with status: ${CallStatus}`
          })
        } catch (e) {
          console.error("Failed to emit socket status update:", e.message)
        }
      }
    }

    res.sendStatus(204)
  } catch (err) {
    console.error(err)
    res.sendStatus(204)
  }
}

export const dialStatusHandler = async (req, res) => {
  try {
    const { DialCallStatus, CallSid } = req.body
    console.log(`[Handoff Failover] Dial status received for call ${CallSid}: ${DialCallStatus}`)

    // If the call was successfully completed, we don't need to do anything, Twilio will hang up
    if (DialCallStatus === 'completed' || DialCallStatus === 'answered') {
      return res.type('text/xml').send('<Response><Hangup/></Response>')
    }

    // Otherwise, the dial failed (busy, no-answer, failed, invalid, timeout)
    // We should reconnect the caller to the AI assistant!
    const ctx = await redis.get('call:' + CallSid)
    let agent = null
    let tenantId = null
    
    if (ctx) {
      const parsed = JSON.parse(ctx)
      tenantId = parsed.tenantId
      agent = await prisma.agent.findUnique({
        where: { id: parsed.agentId }
      })
    }

    // Revert call status in database back to IN_PROGRESS so it can continue normally
    await prisma.call.updateMany({
      where: { twilioSid: CallSid },
      data: { status: 'IN_PROGRESS' }
    })

    if (tenantId) {
      getIO().to(tenantId).emit('call_status', {
        status: 'ai_thinking',
        message: 'Human agent busy. Reconnecting to AI...'
      })
    }

    const twiml = new VoiceResponse()
    const fallbackText = "I'm sorry, all human agents are currently busy or unavailable. Let me continue helping you."
    
    if (agent && agent.voiceId && process.env.ELEVENLABS_API_KEY) {
      twiml.play(process.env.SERVER_URL + "/webhooks/audio?text=" + encodeURIComponent(fallbackText) + "&voiceId=" + agent.voiceId)
    } else {
      twiml.say({ voice: "alice" }, fallbackText)
    }

    if (process.env.USE_DEEPGRAM_STREAMING === 'true') {
      const start = twiml.start()
      start.stream({ url: 'wss://' + req.headers.host + '/media-stream', track: 'inbound_track' })
      twiml.pause({ length: 60 })
    } else {
      twiml.gather({
        input: "speech", speechModel: "phone_call", enhanced: "true",
        speechTimeout: "auto", timeout: 8,
        action: process.env.SERVER_URL + "/webhooks/twilio/gather",
        method: "POST", language: agent?.language || "en-US", profanityFilter: false
      })
    }

    return res.type('text/xml').send(twiml.toString())
  } catch (err) {
    console.error('[Handoff Failover] Error in dialStatusHandler:', err)
    res.type('text/xml').send('<Response><Say voice="alice">An error occurred during transfer. Goodbye.</Say><Hangup/></Response>')
  }
}
