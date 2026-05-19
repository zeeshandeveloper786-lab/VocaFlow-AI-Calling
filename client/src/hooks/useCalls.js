
import { useState, useEffect, useRef } from 'react'
import api from '../api/axios'
import { connectSocket } from '../lib/socket'

export function useCalls() {
  const [calls, setCalls] = useState([])
  const [activeCalls, setActiveCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const timersRef = useRef({})
  const socketRef = useRef(null)

  const fetchCalls = async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v)
      })
      const res = await api.get(`/calls?${params.toString()}`)
      setCalls(res.data.data || [])
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  const addActiveCall = (callData) => {
    setActiveCalls(prev => [...prev, { ...callData, startedAt: new Date() }])
  }

  const removeActiveCall = (callSid) => {
    setActiveCalls(prev => {
      const call = prev.find(c => c.twilioSid === callSid)
      if (call && timersRef.current[callSid]) {
        clearInterval(timersRef.current[callSid])
      }
      return prev.filter(c => c.twilioSid !== callSid)
    })
  }

  useEffect(() => {
    fetchCalls()

    const handleCallStarted = (data) => {
      addActiveCall(data)
    }

    const handleCallEnded = (data) => {
      removeActiveCall(data.callSid)
      fetchCalls()
    }

    const token = localStorage.getItem('token')
    if (token) {
      socketRef.current = connectSocket()
      socketRef.current.on('call_started', handleCallStarted)
      socketRef.current.on('call_ended', handleCallEnded)
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('call_started', handleCallStarted)
        socketRef.current.off('call_ended', handleCallEnded)
      }
    }
  }, [])

  return { calls, activeCalls, loading, error, fetchCalls }
}
