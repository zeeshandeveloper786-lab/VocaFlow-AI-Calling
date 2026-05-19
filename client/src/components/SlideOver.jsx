
export default function SlideOver({ open, onClose, title, children }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl transform transition-transform">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 overflow-y-auto h-[calc(100%-80px)]">{children}</div>
      </div>
    </div>
  )
}
