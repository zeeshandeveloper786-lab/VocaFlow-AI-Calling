
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Agents from './pages/Agents'
import Leads from './pages/Leads'
import Calls from './pages/Calls'
import Dialer from './pages/Dialer'
import KnowledgeBase from './pages/KnowledgeBase'
import LiveCall from './pages/LiveCall'
import Analytics from './pages/Analytics'
import Coaching from './pages/Coaching'
import Settings from './pages/Settings'
import PromptStudio from './pages/PromptStudio'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import SuperAdminUsers from './pages/SuperAdminUsers'
import SuperAdminUserManage from './pages/SuperAdminUserManage'
import ProtectedRoute from './components/ProtectedRoute'
import Toast from './components/Toast'
import useAuthStore from './store/authStore'
import { getRole, isSuperAdmin } from './store/auth'

function App() {
  const loadAuth = useAuthStore(s => s.loadAuth)
  const isAuth = useAuthStore(s => s.isAuth)

  useEffect(() => {
    loadAuth()
  }, [loadAuth])

  return (
    <BrowserRouter>
      <Toast />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/super-admin/dashboard" element={
          <ProtectedRoute roles={['SUPER_ADMIN']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/super-admin/users" element={
          <ProtectedRoute roles={['SUPER_ADMIN']}>
            <SuperAdminUsers />
          </ProtectedRoute>
        } />
        <Route path="/super-admin/users/:userId/manage" element={
          <ProtectedRoute roles={['SUPER_ADMIN']}>
            <SuperAdminUserManage />
          </ProtectedRoute>
        } />
        <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/agents" element={
          <ProtectedRoute>
            <Agents />
          </ProtectedRoute>
        } />
        <Route path="/leads" element={
          <ProtectedRoute>
            <Leads />
          </ProtectedRoute>
        } />
        <Route path="/calls" element={
          <ProtectedRoute>
            <Calls />
          </ProtectedRoute>
        } />
        <Route path="/calls/live/:callId" element={
          <ProtectedRoute>
            <LiveCall />
          </ProtectedRoute>
        } />
        <Route path="/live-call" element={
          <ProtectedRoute>
            <LiveCall />
          </ProtectedRoute>
        } />
        <Route path="/dialer" element={
          <ProtectedRoute>
            <Dialer />
          </ProtectedRoute>
        } />
        <Route path="/knowledge-base" element={
          <ProtectedRoute>
            <KnowledgeBase />
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        } />
        <Route path="/coaching" element={
          <ProtectedRoute>
            <Coaching />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="/prompt-studio" element={
          <ProtectedRoute>
            <PromptStudio />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App
