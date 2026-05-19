
import { useState } from 'react'
import Layout from '../components/Layout'
import { Navigate } from 'react-router-dom'
import { useAgents } from '../hooks/useAgents'
import SlideOver from '../components/SlideOver'
import AgentForm from '../components/AgentForm'

export default function Agents() {
  const { agents, loading, deleteAgent } = useAgents()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : null

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this agent?')) {
      deleteAgent(id)
    }
  }

  const handleEdit = (agent) => {
    setEditing(agent)
    setOpen(true)
  }

  const handleNew = () => {
    setEditing(null)
    setOpen(true)
  }

  const agentTypeColor = {
    RECEPTIONIST: 'bg-blue-100 text-blue-800',
    SALES: 'bg-purple-100 text-purple-800',
    BOOKING: 'bg-green-100 text-green-800',
    SUPPORT: 'bg-orange-100 text-orange-800',
    FOLLOWUP: 'bg-yellow-100 text-yellow-800'
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Agents</h1>
          <button
            onClick={handleNew}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
          >
            New Agent
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-400 text-6xl mb-4">🤖</div>
            <p className="text-gray-600 text-lg">Create your first agent</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{agent.name}</h3>
                    <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs ${agentTypeColor[agent.agentType] || agentTypeColor.RECEPTIONIST}`}>
                      {agent.agentType || 'Receptionist'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" title="Active" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{agent.personality || 'Professional'}</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{agent.tone || 'Formal'}</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{agent.language || 'English'}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(agent)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-md hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(agent.id)}
                    className="px-4 bg-red-50 text-red-600 py-2 rounded-md hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Agent' : 'New Agent'}
      >
        <AgentForm agent={editing} onClose={() => setOpen(false)} />
      </SlideOver>
    </Layout>
  )
}
