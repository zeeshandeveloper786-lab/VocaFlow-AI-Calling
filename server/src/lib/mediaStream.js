import { createDeepgramConnection, sendAudioToDeepgram, closeConnection } from './deepgram.js'
import { generateReply, buildSystemPrompt } from './llm.js'
import { queryRAG } from './rag.js'
import { saveCallHistory, getCallHistory } from './callContext.js'
import prisma from './db.js'
import { getIO } from './socket.js'
import redis from './redis.js'
import { twilioClient } from './twilio.js'
import { synthesizeSpeech } from './tts.js'
import { scoreCall } from './scorer.js'
import { analyzeCall } from './coach.js'
import { analyzeSentiment } from './sentiment.js'

export function handleMediaStream(ws, req) {
  let streamSid = null
  let callSid = null
  let deepgramConn = null
  let agent = null
  let callId = null
  let tenantId = null
  let isProcessing = false
  let isSpeaking = false
  let playbackInterrupted = false
  let startTime = null

  const processTranscript = async (transcript) => {
    if (!agent) return
    if (isProcessing || !transcript.trim()) return
    isProcessing = true

    try {
      getIO().to(tenantId).emit('call_status', {
        status: 'caller_said',
        message: 'Caller said',
        transcript: transcript
      })
      getIO().to(tenantId).emit('call_status', {
        status: 'ai_thinking',
        message: 'AI is thinking...'
      })

      const [history, ragContext] = await Promise.all([
        getCallHistory(callSid),
        queryRAG(transcript, tenantId, agent?.knowledgeDocId).catch(() => '')
      ])

      const systemPrompt = buildSystemPrompt(agent, ragContext)

      const aiReply = await generateReply(systemPrompt, history, transcript)

      history.push({ role: 'user', content: transcript })
      history.push({ role: 'assistant', content: aiReply })
      await saveCallHistory(callSid, history)

      const newTranscript = '\nCaller: ' + transcript + '\nAI: ' + aiReply
      const existing = await prisma.call.findUnique({ where: { twilioSid: callSid }, select: { transcript: true } })
      const updated = (existing?.transcript || '') + '\n' + newTranscript
      await prisma.call.update({ where: { twilioSid: callSid }, data: { transcript: updated } }).catch(() => {})

      getIO().to(tenantId).emit('transcript', { role: 'caller', text: transcript, callId })
      getIO().to(tenantId).emit('transcript', { role: 'ai', text: aiReply, callId })

      if (aiReply.includes('[TRANSFER_TO_HUMAN]') && agent?.transferPhoneNumber) {
        getIO().to(tenantId).emit('call_status', {
          status: 'transferring',
          message: 'Transferring to human agent...'
        })
        await twilioClient.calls(callSid).update({
          twiml: `<Response><Say voice="alice">Please hold while I transfer you to a human agent.</Say><Dial>${agent.transferPhoneNumber.number}</Dial></Response>`
        })
        return
      }

      getIO().to(tenantId).emit('call_status', {
        status: 'ai_speaking',
        message: 'Agent is speaking...',
        text: aiReply
      })

      const audioBuffer = await synthesizeSpeech(aiReply, agent?.voiceId).catch(() => null)

      if (audioBuffer) {
        const CHUNK_SIZE = 160
        isSpeaking = true
        playbackInterrupted = false
        try {
          for (let i = 0; i < audioBuffer.length; i += CHUNK_SIZE) {
            if (ws.readyState !== 1) break // 1 = OPEN
            if (playbackInterrupted) {
              console.log('AI voice playback interrupted by caller speech!')
              break
            }
            const chunk = audioBuffer.slice(i, i + CHUNK_SIZE)
            const payload = chunk.toString('base64')
            ws.send(JSON.stringify({
              event: 'media',
              streamSid: streamSid,
              media: { payload: payload }
            }))
            await new Promise(r => setTimeout(r, 20))
          }

          if (ws.readyState === 1 && !playbackInterrupted) {
            ws.send(JSON.stringify({
              event: 'mark',
              streamSid: streamSid,
              mark: { name: 'audio_complete' }
            }))
          }
        } catch (err) {
          console.log('WebSocket closed during audio playback - caller hung up')
        } finally {
          isSpeaking = false
        }

        getIO().to(tenantId).emit('call_status', {
          status: 'ai_done',
          message: 'Listening...'
        })
      } else {
        await twilioClient.calls(callSid).update({
          twiml: `<Response>
    <Say voice="alice">${aiReply}</Say>
    <Connect>
      <Stream url="wss://${process.env.SERVER_URL?.replace('https://', '')}/media-stream"/>
    </Connect>
    <Pause length="60"/>
  </Response>`
        }).catch(() => {})
      }

    } catch (err) {
      console.error('processTranscript error:', err)
      getIO().to(tenantId).emit('call_status', {
        status: 'error',
        message: err.message || 'Error processing transcript'
      })
    } finally {
      isProcessing = false
    }
  }

  ws.on('message', async (message) => {
    const data = JSON.parse(message)

    if (data.event === 'start') {
      streamSid = data.start.streamSid
      callSid = data.start.callSid
      startTime = Date.now()

      const ctx = await redis.get('call:' + callSid)
      if (ctx) {
        const parsed = JSON.parse(ctx)
        callId = parsed.callId
        tenantId = parsed.tenantId
        agent = await prisma.agent.findUnique({
          where: { id: parsed.agentId },
          include: { transferPhoneNumber: true }
        })
        const lead = parsed.leadId ? await prisma.lead.findUnique({ where: { id: parsed.leadId } }) : null

        getIO().to(tenantId).emit('call_status', {
          status: 'connected',
          message: 'Connected',
          callSid,
          callId,
          leadName: lead?.name || lead?.phone || 'Unknown Caller',
          agentName: agent?.name || 'AI Agent'
        })
      }

      deepgramConn = createDeepgramConnection(
        (finalTranscript) => {
          if (isSpeaking) {
            playbackInterrupted = true
            isSpeaking = false
            try {
              ws.send(JSON.stringify({ event: 'clear', streamSid }))
            } catch (err) {}
          }
          processTranscript(finalTranscript)
        },
        (partialTranscript) => {
          if (isSpeaking) {
            playbackInterrupted = true
            isSpeaking = false
            try {
              ws.send(JSON.stringify({ event: 'clear', streamSid }))
            } catch (err) {}
          }
          if (!tenantId) return
          getIO().to(tenantId).emit('call_status', {
            status: 'caller_speaking',
            message: 'Caller is speaking...',
            transcript: partialTranscript
          })
        }
      )
      console.log('Media stream started:', callSid)
    }

    if (data.event === 'media') {
      const audioBuffer = Buffer.from(data.media.payload, 'base64')
      sendAudioToDeepgram(deepgramConn, audioBuffer)
    }

    if (data.event === 'stop') {
      if (deepgramConn) closeConnection(deepgramConn)
      console.log('Media stream stopped:', callSid)
    }
  })

  ws.on('close', async () => {
    if (deepgramConn) closeConnection(deepgramConn)
    if (callId && startTime) {
      const duration = Math.round((Date.now() - startTime) / 1000)
      console.log(`Media stream closed. Call ${callId} duration: ${duration}s`)
      
      try {
        const call = await prisma.call.findUnique({ 
          where: { id: callId },
          include: { lead: true }
        })
        
        if (call && call.status !== 'COMPLETED' && call.status !== 'FAILED') {
          // Idempotency lock via atomic status transition
          const updatedCall = await prisma.call.updateMany({
            where: { id: callId, NOT: { status: { in: ['COMPLETED', 'FAILED'] } } },
            data: { status: 'COMPLETED', duration }
          })
          
          if (updatedCall.count > 0) {
            await scoreCall(call.transcript, call.leadId, call.tenantId, call.id).catch(() => {})
            await analyzeCall(call.id, call.tenantId).catch(() => {})

            if (call.lead && call.lead.status === "PENDING") {
              await prisma.lead.update({
                where: { id: call.leadId },
                data: { status: "CONTACTED" }
              })
            }
            
            getIO().to(tenantId).emit('call_status', {
              status: 'ended',
              message: 'Call ended',
              duration
            })
          }
        }
      } catch (err) {
        console.error('Error finalising call from mediaStream close:', err)
      }
    }
  })
}
