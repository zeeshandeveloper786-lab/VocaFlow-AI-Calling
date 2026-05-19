import useAuthStore from './authStore'
import { jwtDecode } from 'jwt-decode'

export function useAuth() {
  const user = useAuthStore(s => s.user)
  const token = useAuthStore(s => s.token)
  const setAuth = useAuthStore(s => s.setAuth)
  const clearAuth = useAuthStore(s => s.clearAuth)

  const login = (newToken, newUser) => {
    setAuth(newUser, newToken)
    const decoded = jwtDecode(newToken)
    localStorage.setItem('role', decoded.role)
  }

  const logout = () => {
    clearAuth()
  }

  return { user, token, login, logout }
}

export function getRole() {
  return localStorage.getItem('role')
}

export function isSuperAdmin() {
  return getRole() === 'SUPER_ADMIN'
}

export function isTenantAdmin() {
  return getRole() === 'TENANT_ADMIN'
}
