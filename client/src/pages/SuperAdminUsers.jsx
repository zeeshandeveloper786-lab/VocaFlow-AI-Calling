import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import useAuthStore from '../store/authStore'

export default function SuperAdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')
  const navigate = useNavigate()
  const clearAuth = useAuthStore(s => s.clearAuth)

  const loadUsers = async () => {
    try {
      const res = await api.get('/super-admin/users')
      setUsers(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleLogout = () => {
    clearAuth()
    localStorage.removeItem('role')
    navigate('/login')
  }

  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/super-admin/users/${userId}`)
      setDeleteConfirm(null)
      setSuccessMsg('User deleted successfully')
      setTimeout(() => setSuccessMsg(''), 3000)
      loadUsers()
    } catch (err) {
      console.error(err)
    }
  }

  const formatDate = (date) => new Date(date).toLocaleDateString()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-gray-900 text-white">
        <div className="p-6">
          <h1 className="text-xl font-bold">VocaFlow</h1>
          <p className="text-sm text-gray-400">Super Admin</p>
        </div>
        <nav className="mt-2">
          <button
            onClick={() => navigate('/super-admin/dashboard')}
            className="w-full text-left px-6 py-3 hover:bg-gray-800"
          >
            Dashboard
          </button>
          <button
            className="w-full text-left px-6 py-3 bg-gray-800"
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
        <h2 className="text-3xl font-bold mb-8 text-gray-900">User Management</h2>

        {successMsg && (
          <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
            {successMsg}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Agents</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Leads</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Workflows</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Join Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{user.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.role}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.totalAgents}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.totalLeads}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.totalWorkflows}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(user.joinDate)}</td>
                      <td className="px-6 py-4 text-sm font-medium space-x-2">
                        <button
                          onClick={() => navigate(`/super-admin/users/${user.id}/manage`)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded-lg transition"
                        >
                          Manage
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(user)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded-lg transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Delete User</h3>
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete <strong>{deleteConfirm.email}</strong>? This will delete all their data permanently.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleDeleteUser(deleteConfirm.id)}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition"
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
