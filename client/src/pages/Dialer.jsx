import { useState, useEffect } from 'react'
import api from '../api/axios'
import Layout from '../components/Layout'
import { Navigate } from 'react-router-dom'
import { useAgents } from '../hooks/useAgents'
import { connectSocket } from '../lib/socket'


export default function Dialer() {
  const [leads, setLeads] = useState([])
  const [calls, setCalls] = useState([])
  const [status, setStatus] = useState({ running: false, activeJobs: 0, waitingJobs: 0, totalLeads: 0 })
  const [logs, setLogs] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const { agents, loading: agentsLoading, fetchAgents } = useAgents()

  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : null

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  const fetchData = async () => {
    const [leadsRes, callsRes, statusRes] = await Promise.all([
      api.get('/leads', { params: { page: 1, limit: 100 } }).catch(() => ({ data: { data: [] } })),
      api.get('/calls', { params: { page: 1, limit: 100 } }).catch(() => ({ data: { data: [] } })),
      api.get('/dialer/status').catch(() => ({ data: { data: { status: 'idle' } } }))
    ])
    setLeads(leadsRes.data.data)
    setCalls(callsRes.data.data)
    const dialerData = statusRes.data?.data || {}
    const dialerStatus = dialerData.status || 'idle'
    setStatus({ 
      running: dialerStatus === 'running', 
      activeJobs: dialerData.activeJobs || 0, 
      waitingJobs: dialerData.waitingJobs || 0, 
      totalLeads: leadsRes.data.total || 0 
    })
  }


  useEffect(() => {
    fetchData()
    fetchAgents()
  }, [])

  useEffect(() => {
    const socket = connectSocket()

    const onDialerJobStatus = (data) => {
      const timeStr = new Date().toLocaleTimeString()
      let logMsg = ''
      
      switch (data.status?.toLowerCase()) {
        case 'calling':
          logMsg = `[${timeStr}] 📞 Outbound Call Triggered: ${data.name} (${data.phone})`
          break
        case 'initiated':
          logMsg = `[${timeStr}] 🟢 Connected & Ringing: ${data.name} (${data.phone})`
          break
        case 'failed':
          logMsg = `[${timeStr}] ❌ Call Failed: ${data.name} (${data.phone}) - Error: ${data.error || 'Connection Failed'}`
          break
        case 'busy':
          logMsg = `[${timeStr}] 📵 Busy: ${data.name} (${data.phone})`
          break
        case 'no-answer':
          logMsg = `[${timeStr}] 📭 No Answer: ${data.name} (${data.phone})`
          break
        case 'completed':
          logMsg = `[${timeStr}] ✅ Completed Call: ${data.name} (${data.phone})`
          break
        default:
          logMsg = `[${timeStr}] ℹ️ Call status updated: ${data.name} - Status: ${data.status}`
      }

      setLogs(prev => [logMsg, ...prev])

      setLeads(prevLeads => {
        return prevLeads.map(lead => {
          if (lead.id === data.leadId) {
            let nextStatus = lead.status
            if (data.status === 'calling') nextStatus = 'PENDING'
            else if (data.status === 'initiated') nextStatus = 'CONTACTED'
            else if (['failed', 'busy', 'no-answer'].includes(data.status)) nextStatus = 'FAILED'
            
            return {
              ...lead,
              status: nextStatus,
              updatedAt: new Date().toISOString()
            }
          }
          return lead
        })
      })

      fetchData()
    }

    socket.on('dialer_job_status', onDialerJobStatus)

    return () => {
      socket.off('dialer_job_status', onDialerJobStatus)
    }
  }, [])


  useEffect(() => {
    if (!status.running) return
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [status.running])

  const selectedAgentObj = agents.find(a => a.id === selectedAgent)

  const handleStart = async () => {
    if (!selectedAgent) {
      setLogs(prev => [...prev, `❌ Please select an agent first`])
      return
    }
    try {
      const res = await api.post('/dialer/start', { agentId: selectedAgent })
      setLogs(prev => [...prev, `✅ Campaign started - ${res.data.queued} leads queued`])
      fetchData()
    } catch (err) {
      setLogs(prev => [...prev, `❌ Failed to start: ${err.response?.data?.error || err.message}`])
      console.error('Failed to start dialer:', err)
    }
  }

  const handleStop = async () => {
    try {
      await api.post('/dialer/stop')
      setLogs(prev => [...prev, '⏹️ Campaign stopped'])
      fetchData()
    } catch (err) {
      setLogs(prev => [...prev, `❌ Failed to stop: ${err.message}`])
      console.error('Failed to stop dialer:', err)
    }
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'converted':
        return 'bg-green-100 text-green-800'
      case 'called':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Dialer</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Campaign Control</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Agent</label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              disabled={status.running}
              className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select Agent</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-4 items-center">
            <button
              onClick={handleStart}
              disabled={status.running}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Start Campaign
            </button>
            <button
              onClick={handleStop}
              disabled={!status.running}
              className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              Stop Campaign
            </button>
            <div className="px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: status.running ? '#d1fae5' : '#f3f4f6', color: status.running ? '#065f46' : '#374151' }}>
              {status.running ? '✅ RUNNING' : '⏸️ STOPPED'}
            </div>
          </div>

          {logs.length > 0 && (
            <div className="mt-4 bg-gray-50 rounded p-4 max-h-40 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="text-sm text-gray-700">{log}</div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Leads</h3>
            <p className="text-3xl font-bold">{status.totalLeads}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Waiting Calls</h3>
            <p className="text-3xl font-bold text-orange-600">{status.waitingJobs}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Active Calls</h3>
            <p className="text-3xl font-bold text-blue-600">{status.activeJobs}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Calls Made</h3>
            <p className="text-3xl font-bold text-green-600">{calls.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leads.map(lead => (
                <tr key={lead.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lead.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.email || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {lead.updatedAt ? new Date(lead.updatedAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
