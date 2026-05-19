
import React, { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { Navigate, useNavigate } from 'react-router-dom'
import { useCalls } from '../hooks/useCalls'
import TranscriptView from '../components/TranscriptView'
import api from '../api/axios'
import useAuthStore from '../store/authStore'

export default function Calls() {
  const { calls, activeCalls, loading, error, fetchCalls } = useCalls()
  const [filters, setFilters] = useState({ direction: '', sentiment: '', fromDate: '' })
  const [expandedId, setExpandedId] = useState(null)
  const [page, setPage] = useState(1)
  const [durations, setDurations] = useState({})
  const [objectionModal, setObjectionModal] = useState(null)
  const navigate = useNavigate()
  const timersRef = useRef({})
  const { isAuth } = useAuthStore()

  useEffect(() => {
    fetchCalls({
      page,
      limit: 20,
      direction: filters.direction,
      sentiment: filters.sentiment,
      fromDate: filters.fromDate
    })
  }, [filters, page])

  useEffect(() => {
    activeCalls.forEach(call => {
      if (!timersRef.current[call.twilioSid]) {
        timersRef.current[call.twilioSid] = setInterval(() => {
          setDurations(prev => {
            const now = new Date()
            const start = call.startedAt || now
            const diff = Math.floor((now - start) / 1000)
            return { ...prev, [call.twilioSid]: diff }
          })
        }, 1000)
      }
    })

    return () => {
      Object.values(timersRef.current).forEach(clearInterval)
    }
  }, [activeCalls])

  const formatDuration = (sec) => {
    if (!sec) return '-'
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const statusColor = {
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    'no-answer': 'bg-gray-100 text-gray-800',
    initiated: 'bg-blue-100 text-blue-800'
  }

  const scoreBadgeClass = (score) => {
    if (score === null || score === undefined) return 'bg-gray-100 text-gray-700'
    if (score <= 40) return 'bg-red-100 text-red-800'
    if (score <= 70) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const sentimentBadgeClass = (sentiment, score) => {
    if (!sentiment && (score === null || score === undefined)) return 'bg-gray-100 text-gray-700'
    const s = typeof sentiment === 'string' ? sentiment.toUpperCase() : ''
    if (s === 'POSITIVE' || score > 60) return 'bg-green-100 text-green-800'
    if (s === 'NEGATIVE' || score < 40) return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-700'
  }

  const sentimentLabel = (sentiment, score) => {
    if (!sentiment && (score === null || score === undefined)) return '-'
    const s = typeof sentiment === 'string' ? sentiment.toUpperCase() : ''
    if (s === 'POSITIVE' || score > 60) return 'POSITIVE'
    if (s === 'NEGATIVE' || score < 40) return 'NEGATIVE'
    return 'NEUTRAL'
  }

  const getObjection = (call) => {
    if (!call.analysis) return null
    try {
      const analysis = JSON.parse(call.analysis)
      return analysis.objection
    } catch (e) {
      return null
    }
  }

  if (!isAuth) return <Navigate to="/login" replace />

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Calls</h1>
        </div>

        {activeCalls.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                LIVE
              </span>
              <h2 className="text-xl font-semibold">Active Calls</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCalls.map(call => (
                <div key={call.twilioSid} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold">{call.lead?.phone || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">{call.agent?.name || 'Agent'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg">{formatDuration(durations[call.twilioSid] || 0)}</p>
                      <div className="flex items-center gap-1 justify-end">
                        <span className={`w-2 h-2 rounded-full ${
                          (call.sentiment || 0) > 0 ? 'bg-green-500' :
                          (call.sentiment || 0) < 0 ? 'bg-red-500' : 'bg-yellow-500'
                        }`}></span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/calls/live/${call.twilioSid}`)}
                    className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
                  >
                    Monitor
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white border rounded-lg p-4 flex flex-wrap gap-4 items-center">
          <select
            value={filters.direction}
            onChange={e => setFilters(prev => ({ ...prev, direction: e.target.value }))}
            className="border rounded-md px-3 py-2"
          >
            <option value="">All Directions</option>
            <option value="INBOUND">INBOUND</option>
            <option value="OUTBOUND">OUTBOUND</option>
          </select>
          <select
            value={filters.sentiment}
            onChange={e => setFilters(prev => ({ ...prev, sentiment: e.target.value }))}
            className="border rounded-md px-3 py-2"
          >
            <option value="">All Sentiments</option>
            <option value="POSITIVE">POSITIVE</option>
            <option value="NEGATIVE">NEGATIVE</option>
            <option value="NEUTRAL">NEUTRAL</option>
          </select>
          <input
            type="date"
            value={filters.fromDate}
            onChange={e => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
            className="border rounded-md px-3 py-2"
          />
        </div>

        {loading ? (
          <div className="text-center py-10">Loading calls...</div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Agent</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Direction</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Duration</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Sentiment</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Score</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {calls.map(call => {
                  const objection = getObjection(call)
                  return (
                    <React.Fragment key={call.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3">{call.lead?.phone || '-'}</td>
                        <td className="px-4 py-3">{call.agent?.name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${
                            call.direction?.toUpperCase() === 'INBOUND' 
                              ? 'bg-sky-50 text-sky-700 border border-sky-100' 
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          }`}>
                            {call.direction?.toUpperCase() === 'INBOUND' ? '📥 Inbound' : '📤 Outbound'}
                          </span>
                        </td>
                        <td className="px-4 py-3">{formatDuration(call.duration)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${sentimentBadgeClass(call.sentiment, call.sentimentScore)}`}>
                            {sentimentLabel(call.sentiment, call.sentimentScore)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${scoreBadgeClass(call.lead?.score)}`}>
                            {call.lead?.score ?? '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${statusColor[call.status] || 'bg-gray-100'}`}>
                            {call.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{new Date(call.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 flex gap-2">
                          <button
                            onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
                            className="text-blue-600 hover:underline"
                          >
                            {expandedId === call.id ? 'Hide' : 'Transcript'}
                          </button>
                          {call.leadId && (
                            <button
                              onClick={() => navigate('/leads')}
                              className="text-gray-600 hover:underline"
                            >
                              Lead
                            </button>
                          )}
                          {objection?.detected && (
                            <button
                              onClick={() => setObjectionModal(objection)}
                              className="text-orange-600 hover:underline"
                            >
                              View Objection
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedId === call.id && (
                        <tr>
                          <td colSpan={9} className="p-0">
                            <TranscriptView transcript={call.transcript} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-2 justify-center">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-600">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            Next
          </button>
        </div>

        {objectionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4">Objection Details</h2>
              <div className="space-y-4">
                <div>
                  <strong>Type:</strong> {objectionModal.type}
                </div>
                <div>
                  <strong>AI Response:</strong> {objectionModal.response}
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setObjectionModal(null)}
                  className="px-4 py-2 bg-gray-100 rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
