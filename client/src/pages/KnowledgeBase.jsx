
import { useState, useEffect } from 'react'
import api from '../api/axios'
import Layout from '../components/Layout'
import { Navigate } from 'react-router-dom'

export default function KnowledgeBase() {
  const [docs, setDocs] = useState([])
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : null

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  const fetchDocs = async () => {
    try {
      const res = await api.get('/upload/knowledge-docs')
      const data = res.data.data?.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        createdAt: doc.createdAt,
        chunks: doc._count?.embeddings || 0
      })) || []
      setDocs(data)
    } catch (err) {
      console.error('Failed to fetch docs:', err)
    }
  }

  useEffect(() => {
    fetchDocs()
  }, [])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await api.post('/upload/pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setFile(null)
      fetchDocs()
      
      let elapsed = 0
      const poll = setInterval(async () => {
        elapsed += 3000
        try {
          const r = await api.get('/upload/knowledge-docs')
          const data = r.data.data?.map(doc => ({
            id: doc.id,
            fileName: doc.fileName,
            createdAt: doc.createdAt,
            chunks: doc._count?.embeddings || 0
          })) || []
          setDocs(data)
          const doc = data.find(d => d.id === res.data.docId)
          if ((doc && doc.chunks > 0) || elapsed >= 60000) {
            clearInterval(poll)
          }
        } catch (err) {
          console.error(err)
        }
      }, 3000)
    } catch (err) {
      console.error('Failed to upload:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this document?\nThis will permanently remove the document and all its embeddings."
      )
    )
      return
    try {
      await api.delete(`/upload/knowledge-docs/${id}`)
      fetchDocs()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Knowledge Base</h1>
          <form onSubmit={handleUpload} className="flex gap-2">
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files[0])}
              className="px-4 py-2 border rounded"
            />
            <button
              type="submit"
              disabled={!file || uploading}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">File Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Upload Date</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Chunks</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {docs.map(doc => (
                <tr key={doc.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{doc.fileName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.chunks > 0 ? doc.chunks : 'Processing...'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-red-600 hover:text-red-800"
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
    </Layout>
  )
}
