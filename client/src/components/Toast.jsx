import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useUiStore from '../store/uiStore'

export default function Toast() {
  const toasts = useUiStore(s => s.toasts)
  const removeToast = useUiStore(s => s.removeToast)

  useEffect(() => {
    toasts.forEach(t => {
      const timer = setTimeout(() => removeToast(t.id), 3000)
      return () => clearTimeout(timer)
    })
  }, [toasts, removeToast])

  const bg = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600'
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`px-4 py-3 rounded-lg shadow-lg text-white ${bg[t.type] || bg.info}`}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
