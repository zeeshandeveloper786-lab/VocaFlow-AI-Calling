
import { useState, useEffect } from 'react'
import api from '../api/axios'

export function useAgents() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAgents = async () => {
    try {
      const res = await api.get('/agents')
      setAgents(res.data)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  const createAgent = async (data) => {
    const res = await api.post('/agents', data)
    setAgents(prev => [...prev, res.data])
    return res.data
  }

  const updateAgent = async (id, data) => {
    const res = await api.put(`/agents/${id}`, data)
    setAgents(prev => prev.map(a => a.id === id ? res.data : a))
    return res.data
  }

  const deleteAgent = async (id) => {
    await api.delete(`/agents/${id}`)
    setAgents(prev => prev.filter(a => a.id !== id))
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  return { agents, loading, error, fetchAgents, createAgent, updateAgent, deleteAgent }
}
