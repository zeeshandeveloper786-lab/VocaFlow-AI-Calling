import { useState, useEffect, useRef } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import useCallStore from '../store/callStore'
import { connectSocket } from '../lib/socket'

export default function LiveCall() {
  const { isAuth } = useAuthStore()
  const { callId } = useParams()
  const activeCall = useCallStore(s => s.activeCall)
  const setActiveCall = useCallStore(s => s.setActiveCall)
  
  const [messages, setMessages] = useState([])
  const [callTimer, setCallTimer] = useState(0)
  const [sentiment, setSentiment] = useState(null)
  const [objection, setObjection] = useState(null)
  const [handoffDone, setHandoffDone] = useState(false)
  
  const [callState, setCallState] = useState({
    status: 'idle',
    message: 'Waiting for call...',
    transcript: '',
    text: '',
    leadName: '',
    duration: '',
    score: ''
  })
  
  const scrollRef = useRef(null)

  useEffect(() => {
    if (callId && !activeCall) {
      api.get(`/calls?page=1&limit=100`).then(res => {
        const found = (res.data.data || []).find(c => c.id === callId || c.twilioSid === callId)
        if (found) setActiveCall(found)
      }).catch(() => {})
    }
  }, [callId])

  useEffect(() => {
    if (activeCall) {
      setHandoffDone(activeCall.status === 'TRANSFERRED')
      if (activeCall.transcript) {
        const parsedMessages = []
        const lines = activeCall.transcript.split('\n')
        for (const line of lines) {
          if (line.startsWith('Caller: ')) {
            parsedMessages.push({ role: 'caller', text: line.replace('Caller: ', '') })
          } else if (line.startsWith('AI: ')) {
            parsedMessages.push({ role: 'ai', text: line.replace('AI: ', '') })
          }
        }
        setMessages(parsedMessages)
      } else {
        setMessages([])
      }
    } else {
      setMessages([])
      setHandoffDone(false)
    }
  }, [activeCall])

  useEffect(() => {
    const interval = setInterval(() => {
      setCallState(prev => {
        const activeStates = ['connected', 'ai_thinking', 'ai_speaking', 'caller_speaking', 'ai_done', 'transferring']
        if (activeStates.includes(prev.status)) {
          setCallTimer(t => t + 1)
        }
        return prev
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const activeCallRef = useRef(activeCall)
  useEffect(() => {
    activeCallRef.current = activeCall
  }, [activeCall])

  useEffect(() => {
    const socket = connectSocket()

    const onTranscript = (data) => {
      setMessages(prev => [...prev, { role: data.role, text: data.text }])
    }

    const onObjectionDetected = (data) => {
      setObjection({ type: data.type, response: data.response })
    }

    const onSentiment = (data) => {
      setSentiment(data.sentiment)
    }
    
    const onCallStatus = (data) => {
      setCallState(prev => ({
        ...prev,
        status: data.status || prev.status,
        message: data.message || prev.message,
        transcript: data.transcript !== undefined ? data.transcript : prev.transcript,
        text: data.text !== undefined ? data.text : prev.text,
        leadName: data.leadName !== undefined ? data.leadName : prev.leadName,
        duration: data.duration !== undefined ? data.duration : prev.duration,
        score: data.score !== undefined ? data.score : prev.score
      }))

      if (data.status === 'connected') {
        setCallTimer(0)
      }

      if (data.callSid) {
        setActiveCall({
          id: data.callId || activeCallRef.current?.id || '',
          twilioSid: data.callSid,
          status: data.status === 'transferring' ? 'TRANSFERRED' : 'IN_PROGRESS',
          lead: data.leadName ? { name: data.leadName } : null
        })
      }
    }

    socket.on('transcript', onTranscript)
    socket.on('objection_detected', onObjectionDetected)
    socket.on('sentiment', onSentiment)
    socket.on('call_status', onCallStatus)

    return () => {
      socket.off('transcript', onTranscript)
      socket.off('objection_detected', onObjectionDetected)
      socket.off('sentiment', onSentiment)
      socket.off('call_status', onCallStatus)
    }
  }, [setActiveCall])

  const handleTransfer = async () => {
    try {
      await api.post('/calls/handoff', {
        callSid: activeCall?.twilioSid,
        callId: activeCall?.id,
        reason: 'Manual transfer'
      })
      setHandoffDone(true)
      window.alert('Transferred successfully')
    } catch (err) {
      console.error(err)
    }
  }

  const formatTimer = () => {
    const m = Math.floor(callTimer / 60).toString().padStart(2, '0')
    const s = (callTimer % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const sentimentColor = sentiment => {
    if (!sentiment) return 'text-gray-400'
    if (sentiment === 'POSITIVE') return 'text-green-500'
    if (sentiment === 'NEGATIVE') return 'text-red-500'
    return 'text-gray-400'
  }

  const renderStatusIndicator = () => {
    const { status, message, transcript, text, leadName, duration, score } = callState;
    
    let icon, bgColor, textColor;

    switch (status) {
      case 'connecting':
        icon = <div className="w-4 h-4 rounded-full bg-yellow-400 animate-pulse"></div>;
        bgColor = 'bg-yellow-50';
        textColor = 'text-yellow-700';
        break;
      case 'connected':
        icon = <div className="w-4 h-4 rounded-full bg-green-500"></div>;
        bgColor = 'bg-green-50';
        textColor = 'text-green-700';
        break;
      case 'caller_speaking':
        icon = (
          <div className="flex items-end gap-1 h-4">
            <div className="w-1 bg-blue-500 animate-bounce" style={{ height: '60%', animationDelay: '0ms' }}></div>
            <div className="w-1 bg-blue-500 animate-bounce" style={{ height: '100%', animationDelay: '150ms' }}></div>
            <div className="w-1 bg-blue-500 animate-bounce" style={{ height: '40%', animationDelay: '300ms' }}></div>
          </div>
        );
        bgColor = 'bg-blue-50';
        textColor = 'text-blue-700';
        break;
      case 'caller_said':
        icon = (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        );
        bgColor = 'bg-blue-50';
        textColor = 'text-blue-700';
        break;
      case 'ai_thinking':
        icon = (
          <svg className="animate-spin w-5 h-5 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
        bgColor = 'bg-purple-50';
        textColor = 'text-purple-700';
        break;
      case 'ai_speaking':
        icon = (
          <div className="flex items-end gap-1 h-4">
            <div className="w-1 bg-purple-500 animate-bounce" style={{ height: '100%', animationDelay: '0ms' }}></div>
            <div className="w-1 bg-purple-500 animate-bounce" style={{ height: '60%', animationDelay: '150ms' }}></div>
            <div className="w-1 bg-purple-500 animate-bounce" style={{ height: '80%', animationDelay: '300ms' }}></div>
          </div>
        );
        bgColor = 'bg-purple-50';
        textColor = 'text-purple-700';
        break;
      case 'ai_done':
        icon = (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
        );
        bgColor = 'bg-green-50';
        textColor = 'text-green-700';
        break;
      case 'transferring':
        icon = (
          <svg className="w-5 h-5 text-orange-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
        );
        bgColor = 'bg-orange-50';
        textColor = 'text-orange-700';
        break;
      case 'ended':
        icon = <div className="w-4 h-4 rounded-full bg-gray-400"></div>;
        bgColor = 'bg-gray-100';
        textColor = 'text-gray-700';
        break;
      case 'error':
        icon = <div className="w-4 h-4 rounded-full bg-red-500"></div>;
        bgColor = 'bg-red-50';
        textColor = 'text-red-700';
        break;
      default:
        icon = <div className="w-4 h-4 rounded-full bg-gray-300"></div>;
        bgColor = 'bg-gray-50';
        textColor = 'text-gray-500';
    }

    return (
      <div className={`p-4 rounded-xl shadow-sm border mb-6 flex flex-col gap-2 transition-colors duration-300 ${bgColor}`}>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm">
            {icon}
          </div>
          <div className={`font-semibold text-lg ${textColor}`}>
            {status === 'connected' ? `${message} ${leadName ? `• ${leadName}` : ''}` : message}
            {status === 'ended' && ` • Duration: ${duration || 0}s • Score: ${score || 'N/A'}`}
          </div>
        </div>
        
        {status === 'caller_speaking' && transcript && (
          <div className="ml-11 text-gray-600 italic">"{transcript}"</div>
        )}
        {status === 'caller_said' && transcript && (
          <div className="ml-11 text-blue-800 font-medium">"{transcript}"</div>
        )}
        {status === 'ai_speaking' && text && (
          <div className="ml-11 text-purple-800">"{text}"</div>
        )}
        {status === 'error' && message && (
          <div className="ml-11 text-red-600 font-medium">{message}</div>
        )}
      </div>
    );
  };

  if (!isAuth) return <Navigate to="/login" replace />

  return (
    <Layout>
      {objection && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white p-3 text-center">
          Objection: {objection.type} - {objection.response}
          <button
            onClick={() => setObjection(null)}
            className="ml-4 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 pt-12">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-[800px] w-full">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Live Call</h1>
            <div className="font-mono text-xl font-semibold text-gray-700 bg-gray-100 px-4 py-1 rounded-full">
              {formatTimer()}
            </div>
          </div>

          {renderStatusIndicator()}

          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  sentiment === 'POSITIVE'
                    ? 'bg-green-500'
                    : sentiment === 'NEGATIVE'
                    ? 'bg-red-500'
                    : 'bg-gray-400'
                }`}
              />
              <span className={`text-sm font-medium ${sentimentColor(sentiment)}`}>
                Sentiment: {sentiment || 'Pending'}
              </span>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="border rounded-xl p-4 mb-6 h-[350px] overflow-y-auto bg-gray-50"
          >
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">Call transcripts will appear here...</div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === 'caller' ? 'justify-start' : 'justify-end'
                  } mb-4`}
                >
                  <div
                    className={`rounded-2xl px-5 py-3 max-w-[80%] shadow-sm ${
                      msg.role === 'caller'
                        ? 'bg-white border text-gray-800'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    <div className="text-xs opacity-75 mb-1 font-medium">
                      {msg.role === 'caller' ? 'Caller' : 'AI Agent'}
                    </div>
                    {msg.text}
                  </div>
                </div>
              ))
            )}
          </div>

          {!handoffDone && (
            <button
              onClick={handleTransfer}
              disabled={!activeCall}
              className="w-full bg-red-50 text-red-600 border border-red-200 font-semibold py-3 rounded-xl hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              Transfer to Human Agent
            </button>
          )}

          {handoffDone && (
            <div className="text-center p-3 bg-green-50 text-green-700 border border-green-200 rounded-xl font-medium">
              Call has been transferred to human agent
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
