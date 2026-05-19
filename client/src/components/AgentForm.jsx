
import { useState, useEffect } from 'react'
import { useAgents } from '../hooks/useAgents'
import api from '../api/axios'

const VOICE_OPTIONS = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel — Calm & Professional (Female)' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi — Confident & Strong (Female)' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh — Deep & Trustworthy (Male)' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold — Authoritative (Male)' }
]

export default function AgentForm({ agent, onClose }) {
  const { createAgent, updateAgent } = useAgents()
  const [form, setForm] = useState({
    name: '',
    personality: 'professional',
    tone: 'formal',
    voiceId: '',
    language: 'english',
    industry: 'sales',
    agentType: 'RECEPTIONIST',
    systemPrompt: '',
    knowledgeDocId: null,
    transferPhoneId: null
  })
  const [documents, setDocuments] = useState([])
  const [phoneNumbers, setPhoneNumbers] = useState([])

  useEffect(() => {
    fetchDocuments()
    fetchPhoneNumbers()
  }, [])

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name || '',
        personality: agent.personality || 'professional',
        tone: agent.tone || 'formal',
        voiceId: agent.voiceId || '',
        language: agent.language || 'english',
        industry: agent.industry || 'sales',
        agentType: agent.agentType || 'RECEPTIONIST',
        systemPrompt: agent.systemPrompt || '',
        knowledgeDocId: agent.knowledgeDocId || null,
        transferPhoneId: agent.transferPhoneId || null
      })
    }
  }, [agent])

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/agents/documents')
      console.log('AgentForm fetchDocuments response:', res)
      setDocuments(Array.isArray(res.data) ? res.data : res.data.documents || [])
    } catch (err) {
      console.error('Failed to fetch documents:', err)
    }
  }

  const fetchPhoneNumbers = async () => {
    try {
      const res = await api.get('/tenant/phone-numbers')
      setPhoneNumbers(Array.isArray(res.data.data?.transferNumbers) 
        ? res.data.data.transferNumbers 
        : Array.isArray(res.data.data) 
        ? res.data.data 
        : [])
    } catch (err) {
      console.error('Failed to fetch phone numbers:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (agent) {
        await updateAgent(agent.id, form)
      } else {
        await createAgent(form)
      }
      onClose()
    } catch (err) {
      console.error('Save error:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
          className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Personality</label>
        <select
          value={form.personality}
          onChange={e => setForm(prev => ({ ...prev, personality: e.target.value }))}
          className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="professional">Professional</option>
          <option value="friendly">Friendly</option>
          <option value="aggressive">Aggressive</option>
          <option value="empathetic">Empathetic</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
        <select
          value={form.tone}
          onChange={e => setForm(prev => ({ ...prev, tone: e.target.value }))}
          className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="formal">Formal</option>
          <option value="casual">Casual</option>
          <option value="persuasive">Persuasive</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
        <select
          value={form.language}
          onChange={e => setForm(prev => ({ ...prev, language: e.target.value }))}
          className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="english">English</option>
          <option value="spanish">Spanish</option>
          <option value="french">French</option>
          <option value="urdu">Urdu</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
        <select
          value={form.industry}
          onChange={e => setForm(prev => ({ ...prev, industry: e.target.value }))}
          className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="dental">Dental</option>
          <option value="real_estate">Real Estate</option>
          <option value="sales">Sales</option>
          <option value="support">Support</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Agent Type</label>
        <select
          value={form.agentType}
          onChange={e => setForm(prev => ({ ...prev, agentType: e.target.value }))}
          className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="RECEPTIONIST">RECEPTIONIST</option>
          <option value="SALES">SALES</option>
          <option value="BOOKING">BOOKING</option>
          <option value="SUPPORT">SUPPORT</option>
          <option value="FOLLOWUP">FOLLOWUP</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Voice ID</label>
        <select
          value={form.voiceId}
          onChange={e => setForm(prev => ({ ...prev, voiceId: e.target.value }))}
          className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a voice</option>
          {VOICE_OPTIONS.map(voice => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Knowledge Document (Optional)</label>
        <select
          value={form.knowledgeDocId || ''}
          onChange={e => setForm(prev => ({ ...prev, knowledgeDocId: e.target.value || null }))}
          className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">No Document</option>
          {documents.map(doc => (
            <option key={doc.id} value={doc.id}>
              {doc.fileName}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">This document will be used as context for all calls handled by this agent</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Human Transfer Number (Optional)</label>
        <select
          value={form.transferPhoneId || ''}
          onChange={e => setForm(prev => ({ ...prev, transferPhoneId: e.target.value || null }))}
          className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select a transfer number --</option>
          {phoneNumbers.map(pn => (
            <option key={pn.id} value={pn.id}>
              {pn.number}{pn.label ? ` (${pn.label})` : ''}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">When AI cannot handle the call, it will be transferred to this human number.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
        <textarea
          rows={5}
          value={form.systemPrompt}
          onChange={e => setForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
          className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
          {agent ? 'Update' : 'Create'}
        </button>
        <button type="button" onClick={onClose} className="flex-1 bg-gray-100 py-2 rounded-md hover:bg-gray-200">
          Cancel
        </button>
      </div>
    </form>
  )
}
