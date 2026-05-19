import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import useAuthStore from '../store/authStore'

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const clearAuth = useAuthStore(s => s.clearAuth)

  const loadStats = async () => {
    try {
      const res = await api.get('/super-admin/stats')
      setStats(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const handleLogout = () => {
    clearAuth()
    localStorage.removeItem('role')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-gray-900 text-white">
        <div className="p-6">
          <h1 className="text-xl font-bold">VocaFlow</h1>
          <p className="text-sm text-gray-400">Super Admin</p>
        </div>
        <nav className="mt-2">
          <button
            className="w-full text-left px-6 py-3 bg-gray-800"
          >
            Dashboard
          </button>
          <button
            onClick={() => navigate('/super-admin/users')}
            className="w-full text-left px-6 py-3 hover:bg-gray-800"
          >
            Users
          </button>
          <button
            onClick={handleLogout}
            className="w-full text-left px-6 py-3 mt-8 text-red-400 hover:bg-gray-800"
          >
            Logout
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <h2 className="text-3xl font-bold mb-8 text-gray-900">Dashboard</h2>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <span className="text-2xl">👥</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalUsers}</div>
              <div className="text-sm text-gray-500 font-medium">Total Users</div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <span className="text-2xl">🤖</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalAgents}</div>
              <div className="text-sm text-gray-500 font-medium">Total Agents</div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <span className="text-2xl">👤</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalLeads}</div>
              <div className="text-sm text-gray-500 font-medium">Total Leads</div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-teal-100 rounded-lg">
                  <span className="text-2xl">⚙️</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalWorkflows}</div>
              <div className="text-sm text-gray-500 font-medium">Total Workflows</div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <span className="text-2xl">📞</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalCalls}</div>
              <div className="text-sm text-gray-500 font-medium">Total Calls</div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
