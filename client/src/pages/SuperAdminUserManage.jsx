import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/axios'
import useUiStore from '../store/uiStore'

export default function SuperAdminUserManage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const addToast = useUiStore(s => s.addToast)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [overviewData, setOverviewData] = useState(null)
  const [agents, setAgents] = useState([])
  const [leads, setLeads] = useState([])
  const [calls, setCalls] = useState([])
  const [workflows, setWorkflows] = useState([])
  const [viewingTranscript, setViewingTranscript] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(null)
  const [newStatus, setNewStatus] = useState('')

  const loadOverview = async () => {
    try {
      const res = await api.get(`/super-admin/users/${userId}/overview`)
      setOverviewData(res.data)
    } catch (err) {
      addToast('Failed to load overview', 'error')
    }
  }

  const loadAgents = async () => {
    try {
      const res = await api.get(`/super-admin/users/${userId}/agents`)
      setAgents(res.data)
    } catch (err) {
      addToast('Failed to load agents', 'error')
    }
  }

  const loadLeads = async () => {
    try {
      const res = await api.get(`/super-admin/users/${userId}/leads`)
      setLeads(res.data)
    } catch (err) {
      addToast('Failed to load leads', 'error')
    }
  }

  const loadCalls = async () => {
    try {
      const res = await api.get(`/super-admin/users/${userId}/calls`)
      setCalls(res.data)
    } catch (err) {
      addToast('Failed to load calls', 'error')
    }
  }

  const loadWorkflows = async () => {
    try {
      const res = await api.get(`/super-admin/users/${userId}/workflows`)
      setWorkflows(res.data)
    } catch (err) {
      addToast('Failed to load workflows', 'error')
    }
  }

  useEffect(() => {
    const loadTabData = async () => {
      setLoading(true)
      try {
        if (activeTab === 'overview') await loadOverview()
        else if (activeTab === 'agents') await loadAgents()
        else if (activeTab === 'leads') await loadLeads()
        else if (activeTab === 'calls') await loadCalls()
        else if (activeTab === 'workflows') await loadWorkflows()
      } finally {
        setLoading(false)
      }
    }
    loadTabData()
  }, [activeTab, userId])

  const handleDeleteAgent = async (agentId) => {
    if (!window.confirm('Delete this agent?')) return
    try {
      await api.delete(`/super-admin/users/${userId}/agents/${agentId}`)
      addToast('Agent deleted', 'success')
      loadAgents()
    } catch (err) {
      addToast('Failed to delete agent', 'error')
    }
  }

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Delete this lead?')) return
    try {
      await api.delete(`/super-admin/users/${userId}/leads/${leadId}`)
      addToast('Lead deleted', 'success')
      loadLeads()
    } catch (err) {
      addToast('Failed to delete lead', 'error')
    }
  }

  const handleUpdateLeadStatus = async (leadId) => {
    try {
      await api.patch(`/super-admin/users/${userId}/leads/${leadId}/status`, { status: newStatus })
      addToast('Lead status updated', 'success')
      setUpdatingStatus(null)
      loadLeads()
    } catch (err) {
      addToast('Failed to update status', 'error')
    }
  }

  const handleViewTranscript = async (callId) => {
    try {
      const res = await api.get(`/super-admin/users/${userId}/calls/${callId}/transcript`)
      setViewingTranscript(res.data.transcript)
    } catch (err) {
      addToast('Failed to load transcript', 'error')
    }
  }

  const handleDeleteWorkflow = async (workflowId) => {
    if (!window.confirm('Delete this workflow?')) return
    try {
      await api.delete(`/super-admin/users/${userId}/workflows/${workflowId}`)
      addToast('Workflow deleted', 'success')
      loadWorkflows()
    } catch (err) {
      addToast('Failed to delete workflow', 'error')
    }
  }

  const handleToggleWorkflow = async (workflowId) => {
    try {
      await api.patch(`/super-admin/users/${userId}/workflows/${workflowId}/toggle`)
      addToast('Workflow toggled', 'success')
      loadWorkflows()
    } catch (err) {
      addToast('Failed to toggle workflow', 'error')
    }
  }

  const formatDate = (date) => new Date(date).toLocaleDateString()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-gray-900 text-white">
        <div className="p-6">
          <button
            onClick={() => navigate('/super-admin/users')}
            className="flex items-center gap-2 text-gray-300 hover:text-white mb-4"
          >
            ← Back to Users
          </button>
          {overviewData && (
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold text-lg">{overviewData.user.name || 'Unnamed'}</h3>
              <p className="text-sm text-gray-400">{overviewData.user.email}</p>
              <p className="text-sm text-gray-500 mt-2">
                Joined: {formatDate(overviewData.user.createdAt)}
              </p>
              <p className="text-sm text-green-400 mt-1">Status: Active</p>
            </div>
          )}
        </div>
        <nav className="mt-4 space-y-1">
          {['overview', 'agents', 'leads', 'calls', 'workflows'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-6 py-3 ${activeTab === tab ? 'bg-gray-800' : 'hover:bg-gray-800'
                }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && overviewData && (
              <div>
                <h2 className="text-3xl font-bold mb-8 text-gray-900">Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <div className="text-3xl font-bold text-gray-900 mb-1">{overviewData.totalAgents}</div>
                    <div className="text-sm text-gray-500 font-medium">Agents</div>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <div className="text-3xl font-bold text-gray-900 mb-1">{overviewData.totalLeads}</div>
                    <div className="text-sm text-gray-500 font-medium">Leads</div>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <div className="text-3xl font-bold text-gray-900 mb-1">{overviewData.totalCalls}</div>
                    <div className="text-sm text-gray-500 font-medium">Calls</div>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <div className="text-3xl font-bold text-gray-900 mb-1">{overviewData.totalWorkflows}</div>
                    <div className="text-sm text-gray-500 font-medium">Workflows</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100">
                      <h3 className="text-xl font-semibold text-gray-900">Lead Status Breakdown</h3>
                    </div>
                    <div className="p-6">
                      {overviewData.leadStatusBreakdown.length === 0 ? (
                        <p className="text-gray-500">No leads yet</p>
                      ) : (
                        <div className="space-y-3">
                          {overviewData.leadStatusBreakdown.map((item) => (
                            <div key={item.status} className="flex items-center justify-between">
                              <span className="text-gray-700">{item.status}</span>
                              <span className="font-semibold">{item._count.id}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100">
                      <h3 className="text-xl font-semibold text-gray-900">Recent Calls</h3>
                    </div>
                    <div className="overflow-x-auto">
                      {overviewData.recentCalls.length === 0 ? (
                        <div className="p-6 text-gray-500">No calls yet</div>
                      ) : (
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Agent</th>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {overviewData.recentCalls.map((call) => (
                              <tr key={call.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-900">{call.lead?.phone || '-'}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{call.agent?.name || '-'}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{formatDate(call.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'agents' && (
              <div>
                <h2 className="text-3xl font-bold mb-8 text-gray-900">Agents</h2>
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  {agents.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No agents yet</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Language</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Voice ID</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {agents.map((agent) => (
                            <tr key={agent.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-semibold text-gray-900">{agent.name}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{agent.agentType}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{agent.language}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{agent.voiceId}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{formatDate(agent.createdAt)}</td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => handleDeleteAgent(agent.id)}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded-lg"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'leads' && (
              <div>
                <h2 className="text-3xl font-bold mb-8 text-gray-900">Leads</h2>
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  {leads.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No leads yet</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Score</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {leads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-semibold text-gray-900">{lead.name}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{lead.phone}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{lead.email || '-'}</td>
                              <td className="px-6 py-4">
                                {updatingStatus === lead.id ? (
                                  <div className="flex gap-2">
                                    <select
                                      value={newStatus}
                                      onChange={(e) => setNewStatus(e.target.value)}
                                      className="border rounded px-2 py-1"
                                    >
                                      <option value="PENDING">PENDING</option>
                                      <option value="CONTACTED">CONTACTED</option>
                                      <option value="QUALIFIED">QUALIFIED</option>
                                      <option value="CONVERTED">CONVERTED</option>
                                      <option value="LOST">LOST</option>
                                    </select>
                                    <button
                                      onClick={() => handleUpdateLeadStatus(lead.id)}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setUpdatingStatus(null)}
                                      className="text-gray-600 hover:text-gray-800"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-600">{lead.status}</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">{lead.score || '-'}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{formatDate(lead.createdAt)}</td>
                              <td className="px-6 py-4 space-x-2">
                                {updatingStatus !== lead.id && (
                                  <button
                                    onClick={() => {
                                      setUpdatingStatus(lead.id)
                                      setNewStatus(lead.status)
                                    }}
                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded-lg"
                                  >
                                    Edit Status
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteLead(lead.id)}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded-lg"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'calls' && (
              <div>
                <h2 className="text-3xl font-bold mb-8 text-gray-900">Calls</h2>
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  {calls.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No calls yet</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Agent</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Duration</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Sentiment</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Score</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {calls.map((call) => (
                            <tr key={call.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm text-gray-900">{call.lead?.phone || '-'}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{call.agent?.name || '-'}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{call.duration ? `${call.duration}s` : '-'}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{call.sentiment?.toFixed(2) || '-'}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{call.sentimentScore?.toFixed(2) || '-'}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{formatDate(call.createdAt)}</td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => handleViewTranscript(call.id)}
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded-lg"
                                >
                                  View Transcript
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'workflows' && (
              <div>
                <h2 className="text-3xl font-bold mb-8 text-gray-900">Workflows</h2>
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  {workflows.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No workflows yet</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Trigger</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Active</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {workflows.map((workflow) => (
                            <tr key={workflow.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-semibold text-gray-900">{workflow.name}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{workflow.trigger}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${workflow.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                  {workflow.active ? 'Yes' : 'No'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">{formatDate(workflow.createdAt)}</td>
                              <td className="px-6 py-4 space-x-2">
                                <button
                                  onClick={() => handleToggleWorkflow(workflow.id)}
                                  className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-3 py-1 rounded-lg"
                                >
                                  Toggle
                                </button>
                                <button
                                  onClick={() => handleDeleteWorkflow(workflow.id)}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded-lg"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {viewingTranscript && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Call Transcript</h3>
              <button
                onClick={() => setViewingTranscript(null)}
                className="text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
            </div>
            <div className="whitespace-pre-wrap text-gray-800">
              {viewingTranscript || 'No transcript available'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
