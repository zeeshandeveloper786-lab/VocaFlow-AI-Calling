
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../store/auth'
import useUiStore from '../store/uiStore'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const sidebarOpen = useUiStore(s => s.sidebarOpen)
  const toggleSidebar = useUiStore(s => s.toggleSidebar)
  const location = useLocation()

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/agents', label: 'Agents', icon: '🤖' },
    { path: '/leads', label: 'Leads', icon: '👥' },
    { path: '/calls', label: 'Calls', icon: '📞' },
    { path: '/live-call', label: 'Live Call', icon: '🎙️' },
    { path: '/dialer', label: 'Dialer', icon: '📱' },
    { path: '/knowledge-base', label: 'Knowledge Base', icon: '📚' },
    { path: '/analytics', label: 'Analytics', icon: '📈' },
    { path: '/prompt-studio', label: 'Prompt Studio', icon: '✏️' },
    { path: '/coaching', label: 'Coaching', icon: '🎯' },
    { path: '/settings', label: 'Settings', icon: '⚙️' }
  ]

  return (
    <div className="flex h-screen bg-gray-100">
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="bg-white shadow-md overflow-hidden"
          >
            <div className="p-4 border-b w-64">
              <h2 className="text-xl font-bold">VocaFlow</h2>
              {user?.tenantName && (
                <p className="text-sm text-gray-500 mt-1">{user.tenantName}</p>
              )}
            </div>
            <nav className="p-4 space-y-1 w-64">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block px-4 py-2 rounded flex items-center gap-3 ${
                    location.pathname === item.path
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t w-64">
              <button
                onClick={logout}
                className="w-full px-4 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100"
              >
                Logout
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      <main className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <button onClick={toggleSidebar} className="text-gray-600 hover:text-gray-800">
            {sidebarOpen ? '◀' : '▶'}
          </button>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">{user?.email}</span>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
