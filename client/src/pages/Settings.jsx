
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import api from '../api/axios'
import useUiStore from '../store/uiStore'
import useAuthStore from '../store/authStore'

function TwilioNumberCard({ agents, addToast }) {
  const twilioNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER || ''
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentAssignment, setCurrentAssignment] = useState(null)

  useEffect(() => {
    api.get('/tenant/phone-numbers').then(res => {
      const inbound = res.data.data?.inboundNumbers || []
      const match = inbound.find(n => n.number === twilioNumber)
      if (match) {
        setCurrentAssignment(match)
        setSelectedAgentId(match.agentId || '')
      }
    }).catch(() => { })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await api.put('/tenant/phone-numbers/assign', { agentId: selectedAgentId || null })
      setCurrentAssignment(res.data.data)
      addToast('Agent assigned to Twilio number!', 'success')
    } catch (err) {
      addToast('Failed to assign agent', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!twilioNumber) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
        VITE_TWILIO_PHONE_NUMBER not set in client/.env. Add it to show your Twilio number here.
      </div>
    )
  }

  return (
    <div className="border rounded-md p-4 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-lg font-mono font-semibold">{twilioNumber}</span>
        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">Your Twilio Number</span>
        {currentAssignment?.agentId && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">Active</span>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Assign Agent for Inbound Calls</label>
        <select value={selectedAgentId} onChange={e => setSelectedAgentId(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm">
          <option value="">No agent (calls will not be answered)</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name} — {a.agentType}</option>)}
        </select>
        <p className="mt-1 text-xs text-gray-400">When a customer calls {twilioNumber}, this agent will answer.</p>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
          {saving ? 'Saving...' : 'Save Assignment'}
        </button>

      </div>
    </div>
  )
}

export default function Settings() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile')
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [tenant, setTenant] = useState(null)
  const [inboundNumbers, setInboundNumbers] = useState([])
  const [transferNumbers, setTransferNumbers] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [showAddInboundForm, setShowAddInboundForm] = useState(false)
  const [showAddTransferForm, setShowAddTransferForm] = useState(false)
  const [newInboundNumber, setNewInboundNumber] = useState('')
  const [newTransferNumber, setNewTransferNumber] = useState('')
  const [newTransferLabel, setNewTransferLabel] = useState('')
  const [selectedPhoneNumberForSetup, setSelectedPhoneNumberForSetup] = useState(null)
  const [agents, setAgents] = useState([])
  const addToast = useUiStore(s => s.addToast)
  const setAuth = useAuthStore(s => s.setAuth)
  const navigate = useNavigate()

  const originalToken = localStorage.getItem('originalToken')
  const originalRole = localStorage.getItem('originalRole')

  const handleStopImpersonation = () => {
    if (originalToken && originalRole) {
      const decoded = JSON.parse(atob(originalToken.split('.')[1]))
      setAuth({ email: decoded.email }, originalToken)
      localStorage.setItem('role', originalRole)
      localStorage.removeItem('originalToken')
      localStorage.removeItem('originalRole')
      navigate('/super-admin/dashboard')
    }
  }

  useEffect(() => {
    if (activeTab === 'profile') fetchTenant()
    if (activeTab === 'calendar') fetchCalendarStatus()
    if (activeTab === 'phone') { fetchPhoneNumbers(); fetchAgents() }
  }, [activeTab])

  // Handle OAuth callback redirect
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (connected === 'true') {
      addToast('Google Calendar connected!', 'success')
      fetchCalendarStatus()
    }
    if (error === 'auth_failed') {
      addToast('Calendar connection failed. Try again.', 'error')
    }
  }, [])

  const fetchAgents = async () => {
    try {
      const res = await api.get('/agents')
      setAgents(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchTenant = async () => {
    try {
      const res = await api.get('/tenant/me')
      setTenant(res.data)
      setName(res.data.name)
    } catch (err) { console.error(err) }
  }

  const fetchCalendarStatus = async () => {
    try {
      const res = await api.get('/calendar/status')
      setCalendarConnected(res.data.connected)
    } catch (err) { console.error(err) }
  }

  const fetchPhoneNumbers = async () => {
    try {
      const res = await api.get('/tenant/phone-numbers')
      setInboundNumbers(res.data.data?.inboundNumbers || [])
      setTransferNumbers(res.data.data?.transferNumbers || [])
    } catch (err) { console.error(err) }
  }

  const handleSaveTenant = async () => {
    setSaving(true)
    try {
      await api.put('/tenant/me', { name })
      addToast('Tenant profile saved!', 'success')
    } catch (err) {
      addToast('Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleConnectCalendar = async () => {
    try {
      const res = await api.get('/calendar/auth')
      window.open(res.data.url, '_blank')
    } catch (err) { console.error(err) }
  }

  const handleDisconnectCalendar = async () => {
    if (!window.confirm('Disconnect Google Calendar?')) return
    setLoading(true)
    try {
      await api.post('/calendar/disconnect')
      setCalendarConnected(false)
      addToast('Calendar disconnected', 'success')
    } catch (err) {
      addToast('Disconnect failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleLinkAgent = async (phoneNumberId, agentId) => {
    try {
      const res = await api.put(`/tenant/phone-numbers/${phoneNumberId}/link-agent`, { agentId: agentId || null })
      setInboundNumbers(inboundNumbers.map(pn => pn.id === phoneNumberId ? res.data : pn))
      addToast('Agent linked to number!', 'success')
    } catch (err) {
      addToast('Failed to link agent', 'error')
    }
  }

  const handleDeletePhoneNumber = async (id, type) => {
    if (!window.confirm('Are you sure you want to delete this phone number?')) return
    try {
      await api.delete(`/tenant/phone-numbers/${id}`)
      if (type === 'INBOUND') {
        setInboundNumbers(inboundNumbers.filter(n => n.id !== id))
      } else {
        setTransferNumbers(transferNumbers.filter(n => n.id !== id))
      }
      if (selectedPhoneNumberForSetup?.id === id) setSelectedPhoneNumberForSetup(null)
      addToast('Phone number deleted!', 'success')
    } catch (err) {
      addToast('Failed to delete phone number', 'error')
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'phone', label: 'Phone Numbers' }
  ]

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          {originalToken && (
            <button onClick={handleStopImpersonation} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
              Stop Impersonation
            </button>
          )}
        </div>

        <div className="flex gap-2 mb-8 border-b">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium ${activeTab === tab.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-md px-3 py-2" />
              </div>
              <button onClick={handleSaveTenant} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Google Calendar</h2>
            {calendarConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-700">Connected</span>
                </div>
                <button onClick={handleDisconnectCalendar} disabled={loading} className="px-4 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 disabled:opacity-50">
                  {loading ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                  <span className="text-gray-500">Not connected</span>
                </div>
                <button onClick={handleConnectCalendar} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Connect Google Calendar
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'phone' && (
          <div className="space-y-6">
            {/* Main Twilio Number Card */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-1">Your Twilio Number</h2>
              <p className="text-sm text-gray-500 mb-4">This is the number configured in your server. Assign an agent to handle inbound calls.</p>
              <TwilioNumberCard agents={agents} addToast={addToast} />
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold">Human Transfer Numbers</h2>
                <button onClick={() => setShowAddTransferForm(true)} className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700">
                  Add Number
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">When AI cannot handle a call, it transfers to these numbers.</p>

              {showAddTransferForm && (
                <div className="mb-6 p-4 border rounded-md bg-gray-50 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input type="text" value={newTransferNumber} onChange={e => setNewTransferNumber(e.target.value)}
                      className="w-full border rounded-md px-3 py-2" placeholder="+923001234567" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Label (optional)</label>
                    <input type="text" value={newTransferLabel} onChange={e => setNewTransferLabel(e.target.value)}
                      className="w-full border rounded-md px-3 py-2" placeholder="Main Line, Sales Line, etc." />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      try {
                        const res = await api.post('/tenant/phone-numbers', { number: newTransferNumber, label: newTransferLabel, phoneType: 'TRANSFER' })
                        setTransferNumbers([...transferNumbers, res.data])
                        setShowAddTransferForm(false)
                        setNewTransferNumber('')
                        setNewTransferLabel('')
                        addToast('Transfer number added!', 'success')
                      } catch (err) { addToast('Failed to add number', 'error') }
                    }} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Add</button>
                    <button onClick={() => { setShowAddTransferForm(false); setNewTransferNumber(''); setNewTransferLabel('') }}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              )}

              {transferNumbers.length === 0 ? (
                <p className="text-gray-500">No transfer numbers added yet.</p>
              ) : (
                <div className="space-y-2">
                  {transferNumbers.map(num => {
                    const connectedAgent = agents.find(a => a.transferPhoneId === num.id)
                    return (
                      <div key={num.id} className="grid grid-cols-4 gap-4 items-center p-3 border rounded-md">
                        <div><p className="font-medium">{num.number}</p></div>
                        <div>{num.label && <p className="text-sm text-gray-500">{num.label}</p>}</div>
                        <div>
                          {connectedAgent
                            ? <p className="text-sm text-blue-600">{connectedAgent.name}</p>
                            : <p className="text-sm text-gray-400">Not connected</p>}
                        </div>
                        <div className="flex justify-end">
                          <button onClick={() => handleDeletePhoneNumber(num.id, 'TRANSFER')}
                            className="px-3 py-1 bg-red-50 text-red-600 rounded-md text-sm hover:bg-red-100">Delete</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
