import { create } from 'zustand'

const useUiStore = create((set, get) => ({
  sidebarOpen: true,
  toasts: [],
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  addToast: (message, type = 'info') => set((s) => ({
    toasts: [...s.toasts, { id: Date.now(), message, type }]
  })),
  removeToast: (id) => set((s) => ({
    toasts: s.toasts.filter(t => t.id !== id)
  }))
}))

export default useUiStore
