import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { jwtDecode } from 'jwt-decode'

const useAuthStore = create(persist(
  (set, get) => ({
    user: null,
    token: null,
    tenantId: null,
    isAuth: false,
    setAuth: (user, token) => {
      let tenantId = null
      try {
        const decoded = jwtDecode(token)
        tenantId = decoded.tenantId
      } catch (e) {}
      set({ user, token, tenantId, isAuth: true })
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    },
    clearAuth: () => {
      set({ user: null, token: null, tenantId: null, isAuth: false })
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('role')
    },
    loadAuth: () => {
      const token = localStorage.getItem('token')
      const userStr = localStorage.getItem('user')
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr)
          const decoded = jwtDecode(token)
          set({ user, token, tenantId: decoded.tenantId, isAuth: true })
        } catch (e) {
          get().clearAuth()
        }
      }
    }
  }),
  { name: 'auth-storage' }
))

export default useAuthStore
