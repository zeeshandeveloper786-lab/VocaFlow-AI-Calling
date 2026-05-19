import { Navigate } from 'react-router-dom'
import { getRole } from '../store/auth'
import useAuthStore from '../store/authStore'

export default function ProtectedRoute({ children, roles }) {
  const isAuth = useAuthStore(s => s.isAuth)
  const role = getRole()

  if (!isAuth) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
