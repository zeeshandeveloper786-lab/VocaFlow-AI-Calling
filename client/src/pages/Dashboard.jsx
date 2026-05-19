import React, { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts'

export default function Dashboard() {
  const navigate = useNavigate()
  const { isAuth } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState({})
  const [callStats, setCallStats] = useState({})
  const [leadStats, setLeadStats] = useState({})
  const [recentCalls, setRecentCalls] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, callsRes, leadsRes] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/analytics/calls'),
          api.get('/analytics/leads')
        ])
        setOverview(overviewRes.data?.data || overviewRes.data || {})
        const callsData = callsRes.data?.data || callsRes.data || []
        setCallStats(Array.isArray(callsData) ? callsData : [])
        const leadsRaw = leadsRes.data?.data || leadsRes.data || []
        const leadsArr = Array.isArray(leadsRaw) ? leadsRaw : []
        const leadsMap = {}
        leadsArr.forEach(l => { leadsMap[l.status] = l._count?.id || 0 })
        setLeadStats(leadsMap)
        setRecentCalls(overviewRes.data?.data?.recentCalls || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    if (isAuth) fetchData()
  }, [isAuth])

  if (!isAuth) return <Navigate to="/login" replace />

  const leadStatusData = [
    { name: 'PENDING', value: leadStats.PENDING || 0, color: '#6366f1' },
    { name: 'CONTACTED', value: leadStats.CONTACTED || 0, color: '#3b82f6' },
    { name: 'QUALIFIED', value: leadStats.QUALIFIED || 0, color: '#f59e0b' },
    { name: 'BOOKED', value: leadStats.BOOKED || 0, color: '#10b981' },
    { name: 'CONVERTED', value: leadStats.CONVERTED || 0, color: '#8b5cf6' },
    { name: 'LOST', value: leadStats.LOST || 0, color: '#ef4444' }
  ].filter(item => item.value > 0)

  const totalLeads = leadStatusData.reduce((s, d) => s + d.value, 0)

  const sentimentColor = (sentiment) => {
    if (!sentiment) return 'text-gray-500'
    if (sentiment === 'POSITIVE') return 'text-green-600'
    if (sentiment === 'NEGATIVE') return 'text-red-600'
    return 'text-yellow-600'
  }

  const callsLast7Days = Array.isArray(callStats) ? callStats.slice(-7) : []

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>
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
                <p className="text-sm text-gray-500 mb-1">Total Calls</p>
                <p className="text-2xl font-bold">{overview?.totalCalls || 0}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border-l-4 border-green-500 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Active Leads</p>
                <p className="text-2xl font-bold">{overview?.activeLeads || 0}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Booking Rate</p>
                <p className="text-2xl font-bold">{(overview?.bookingRate || 0).toFixed(1)}%</p>
              </div>
              <div className="bg-white rounded-lg p-4 border-l-4 border-orange-500 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Conversion Rate</p>
                <p className="text-2xl font-bold">{(overview?.conversionRate || 0).toFixed(1)}%</p>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-1">Calls Last 7 Days</h3>
            <p className="text-xs text-gray-400 mb-4">Daily call volume</p>
            {loading ? (
              <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={callsLast7Days} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={v => v.slice(5)} />
                  <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2.5}
                    fill="url(#callGradient)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-1">Lead Status</h3>
            <p className="text-xs text-gray-400 mb-4">Distribution by status</p>
            {loading ? (
              <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
            ) : totalLeads === 0 ? (
              <div className="h-[250px] flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl p-6 text-center">
                <span className="text-4xl mb-3">📊</span>
                <p className="text-sm font-semibold text-gray-700">No Lead Data Available</p>
                <p className="text-xs text-gray-400 max-w-[280px] mt-1 mx-auto leading-relaxed">
                  Leads status distribution will appear once you add active leads to your sales pipeline.
                </p>
              </div>
            ) : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={leadStatusData}
                      cx="50%"
                      cy="45%"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      labelLine={false}
                    >
                      {leadStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                      formatter={(value, name) => [value, name]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                      formatter={(value) => <span style={{ color: '#6b7280' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: '-12px' }}>
                  <span className="text-2xl font-bold text-gray-900">{totalLeads}</span>
                  <span className="text-xs text-gray-400 mt-0.5">Total Leads</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Recent Calls</h3>
          {loading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sentiment</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentCalls.slice(0, 5).map(call => (
                    <tr key={call.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm">{call.agent?.name || 'Unknown'}</td>
                      <td className="px-3 py-2 text-sm">{call.lead?.name || 'Unknown'}</td>
                      <td className="px-3 py-2 text-sm">{call.duration ? `${call.duration}s` : '-'}</td>
                      <td className="px-3 py-2">
                        <span className={sentimentColor(call.sentiment)}>
                          {call.sentiment || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm">{call.lead?.score || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
