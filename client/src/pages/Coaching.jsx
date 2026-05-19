
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Layout from '../components/Layout'
import { Navigate } from 'react-router-dom'
import api from '../api/axios'
import useAuthStore from '../store/authStore'

export default function Coaching() {
  const [digest, setDigest] = useState(null)
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingDigest, setLoadingDigest] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const { isAuth } = useAuthStore()

  const fetchReports = async () => {
    try {
      const res = await api.get('/coaching/reports', { params: { page, limit: 10 } })
      setReports(res.data.data)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDigest = async () => {
    setLoadingDigest(true)
    try {
      const res = await api.get('/coaching/digest')
      setDigest(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingDigest(false)
    }
  }

  useEffect(() => {
    if (isAuth) fetchReports()
  }, [isAuth, page])

  if (!isAuth) return <Navigate to="/login" replace />

  const mistakesCount = (report) => {
    if (!report.mistakes) return 0
    if (Array.isArray(report.mistakes)) return report.mistakes.length
    return 0
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString()
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">AI Sales Coaching</h1>
          <button
            onClick={fetchDigest}
            disabled={loadingDigest}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingDigest ? 'Loading...' : 'Get Weekly Digest'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-gray-100 h-24 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-gray-400 text-6xl mb-4">📊</div>
                <p className="text-gray-600 text-lg">No coaching reports yet</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Call ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insights</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mistakes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reports.map(report => (
                      <tr
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-4 py-3 text-sm font-mono">{report.callId.slice(0, 8)}...</td>
                        <td className="px-4 py-3 text-sm">{report.agent?.name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(report.createdAt)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-xs">{report.insights}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                            {mistakesCount(report)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            {digest && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">Weekly Digest</h2>
                <div className="space-y-4">
                  {digest.map(agent => (
                    <div key={agent.agentId} className="border-b pb-4 last:border-0 last:pb-0">
                      <p className="font-medium">{agent.agentName}</p>
                      <p className="text-sm text-gray-500">{agent.mistakesCount} mistakes</p>
                      <div className="mt-2 space-y-1">
                        {agent.insights.slice(0, 3).map((insight, i) => (
                          <p key={i} className="text-xs text-gray-600">{insight}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {selectedReport && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Report Details</h2>
                  <button onClick={() => setSelectedReport(null)} className="text-gray-500 hover:text-gray-700">
                    ✕
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <strong>Insights:</strong>
                    <p className="text-gray-700 mt-1">{selectedReport.insights}</p>
                  </div>
                  {Array.isArray(selectedReport.mistakes) && selectedReport.mistakes.length > 0 && (
                    <div>
                      <strong>Mistakes:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {selectedReport.mistakes.map((m, i) => (
                          <li key={i} className="text-gray-700">{typeof m === 'string' ? m : JSON.stringify(m)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  )
}
