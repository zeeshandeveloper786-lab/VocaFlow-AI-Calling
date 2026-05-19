import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import Layout from '../components/Layout'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ResponsiveContainer } from 'recharts'

export default function Analytics() {
  const { isAuth } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState({})
  const [callStats, setCallStats] = useState({})
  const [sentimentTrend, setSentimentTrend] = useState([])
  const [agentPerf, setAgentPerf] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, callsRes, sentimentRes, agentsRes] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/analytics/calls'),
          api.get('/analytics/sentiment'),
          api.get('/analytics/agents')
        ])
        setOverview(overviewRes.data?.data || overviewRes.data || {})
        setCallStats(callsRes.data?.data || callsRes.data || {})
        setSentimentTrend(Array.isArray(sentimentRes.data?.data) ? sentimentRes.data.data : [])
        setAgentPerf(Array.isArray(agentsRes.data?.data) ? agentsRes.data.data : [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    if (isAuth) fetchData()
  }, [isAuth])

  if (!isAuth) return <Navigate to="/login" replace />

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Analytics</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-4 border-l-4 border-gray-300 animate-pulse">
                <div className="h-6 w-3/4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 w-1/2 bg-gray-200 rounded"></div>
              </div>
            ))
          ) : (
            <>
              <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Avg Call Duration</p>
                <p className="text-2xl font-bold">{overview?.avgDuration || 0}s</p>
              </div>
              <div className="bg-white rounded-lg p-4 border-l-4 border-green-500 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Total Bookings</p>
                <p className="text-2xl font-bold">{overview?.totalAppointments || 0}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Handoff Rate</p>
                <p className="text-2xl font-bold">{(overview?.handoffRate || 0).toFixed(1)}%</p>
              </div>
              <div className="bg-white rounded-lg p-4 border-l-4 border-orange-500 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Objection Rate</p>
                <p className="text-2xl font-bold">{(overview?.objectionRate || 0).toFixed(1)}%</p>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Agent Performance</h3>
            {loading ? (
              <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={Array.isArray(agentPerf) ? agentPerf : []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="agentName" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                  <Bar dataKey="callCount" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Sentiment Trend</h3>
            {loading ? (
              <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={Array.isArray(sentimentTrend) ? sentimentTrend : []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="avgSentiment" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
