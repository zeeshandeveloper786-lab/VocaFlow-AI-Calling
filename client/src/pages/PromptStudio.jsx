import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Layout from '../components/Layout'
import { Navigate } from 'react-router-dom'
import { useAgents } from '../hooks/useAgents'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import useUiStore from '../store/uiStore'

export default function PromptStudio() {
  const { isAuth } = useAuthStore()
  const addToast = useUiStore(s => s.addToast)
  const { agents } = useAgents()
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [prompts, setPrompts] = useState({
    systemPrompt: ''
  })
  const [saving, setSaving] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [chat, setChat] = useState([])
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (selectedAgentId) {
      fetchPrompts(selectedAgentId)
    }
  }, [selectedAgentId])

  const fetchPrompts = async (agentId) => {
    try {
      const res = await api.get(`/prompt-studio/${agentId}`)
      setPrompts(res.data)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/prompt-studio/${selectedAgentId}`, prompts)
      addToast('Prompts saved!', 'success')
    } catch (e) {
      addToast('Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!testMessage.trim()) return
    setTesting(true)
    const userMsg = { role: 'user', text: testMessage }
    setChat(prev => [...prev, userMsg])
    const msg = testMessage
    setTestMessage('')
    try {
      const res = await api.post('/prompt-studio/test', {
        systemPrompt: prompts.systemPrompt,
        testMessage: msg,
        chatHistory: chat.map(c => ({
          role: c.role,
          content: c.text
        }))
      })
      setChat(prev => [...prev, { role: 'assistant', text: res.data.response }])
    } catch (e) {
      addToast('Test failed', 'error')
    } finally {
      setTesting(false)
    }
  }

  if (!isAuth) return <Navigate to="/login" replace />

  return (
    <Layout>
      <div className="h-[calc(100vh-56px)] flex bg-gray-50 overflow-hidden">
        <motion.div
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-1/2 bg-white border-r p-6 flex flex-col"
        >
          <h1 className="text-2xl font-bold mb-6">AI Prompt Studio</h1>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Agent</label>
            <select
              value={selectedAgentId}
              onChange={e => setSelectedAgentId(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="">Choose an agent...</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
            <textarea
              value={prompts.systemPrompt}
              onChange={e => setPrompts(prev => ({ ...prev, systemPrompt: e.target.value }))}
              className="w-full flex-1 border rounded-md px-3 py-2 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Enter system prompt instructions..."
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !selectedAgentId}
            className="mt-6 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </motion.div>

        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-1/2 flex flex-col"
        >
          <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Test Prompt</h2>
            {chat.length > 0 && (
              <button
                onClick={() => setChat([])}
                className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors cursor-pointer"
              >
                Clear Chat
              </button>
            )}
          </div>

          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {chat.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">Send a test message to see the AI response</div>
            ) : (
              chat.map((msg, idx) => (
                <div key={idx} className={`p-3 rounded-lg max-w-[80%] ${msg.role === 'user' ? 'bg-blue-50 ml-auto text-right' : 'bg-white'}`}>
                  <span className="text-xs text-gray-500 block">{msg.role}</span>
                  <p>{msg.text}</p>
                </div>
              ))
            )}
          </div>

          <div className="bg-white border-t p-4 flex gap-2">
            <input
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTest()}
              placeholder="Type a test message..."
              className="flex-1 border rounded-md px-3 py-2"
            />
            <button
              onClick={handleTest}
              disabled={testing || !testMessage.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {testing ? 'Sending...' : 'Send'}
            </button>
          </div>
        </motion.div>
      </div>
    </Layout>
  )
}
