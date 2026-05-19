
import { useState, useEffect } from 'react'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import api from '../api/axios'
import Layout from '../components/Layout'
import { Navigate } from 'react-router-dom'

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [selectedLeads, setSelectedLeads] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', email: '', status: 'PENDING' })
  const [phoneError, setPhoneError] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [csvFile, setCsvFile] = useState(null)
  const [parsedLeadsCount, setParsedLeadsCount] = useState(0)
  const [parsedLeadsData, setParsedLeadsData] = useState([])
  const [csvError, setCsvError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const limit = 20

  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : null

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  const fetchLeads = async (p = 1) => {
    try {
      const res = await api.get('/leads', { params: { page: p, limit } })
      setLeads(Array.isArray(res.data.data) ? res.data.data : [])
      setTotal(res.data.total)
      setPage(p)
    } catch (err) {
      console.error('Failed to fetch leads:', err)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setPhoneError('')

    const phoneRegex = /^\+[1-9]\d{6,14}$/
    if (!leadForm.phone || !phoneRegex.test(leadForm.phone)) {
      setPhoneError('Please enter a valid phone number with country code')
      return
    }

    try {
      const data = {
        name: leadForm.name,
        phone: leadForm.phone,
        email: leadForm.email,
        status: leadForm.status
      }

      if (editingLead) {
        await api.put(`/leads/${editingLead.id}`, data)
      } else {
        await api.post('/leads', data)
      }
      setShowModal(false)
      setEditingLead(null)
      setLeadForm({ name: '', phone: '', email: '', status: 'PENDING' })
      fetchLeads()
    } catch (err) {
      console.error('Failed to save lead:', err)
    }
  }

  const handleEdit = (lead) => {
    setEditingLead(lead)
    setLeadForm({ name: lead.name, phone: lead.phone, email: lead.email || '', status: lead.status })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this lead?')) return
    try {
      await api.delete(`/leads/${id}`)
      fetchLeads()
    } catch (err) {
      console.error('Failed to delete lead:', err)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedLeads.length === 0) return
    if (!window.confirm(`Delete ${selectedLeads.length} leads?`)) return
    try {
      await Promise.all(selectedLeads.map(id => api.delete(`/leads/${id}`)))
      setSelectedLeads([])
      fetchLeads()
    } catch (err) {
      console.error('Failed to delete selected leads:', err)
    }
  }

  const toggleSelect = (id) => {
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(leads.map(l => l.id))
    }
  }

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/)
    if (lines.length === 0) return []
    
    const rawHeaders = lines[0].split(',')
    const headers = rawHeaders.map(h => h.trim().toLowerCase().replace(/['"]+/g, ''))
    
    const nameIndex = headers.findIndex(h => h.includes('name'))
    const phoneIndex = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('contact') || h.includes('number'))
    const emailIndex = headers.findIndex(h => h.includes('email') || h.includes('mail'))
    const notesIndex = headers.findIndex(h => h.includes('note') || h.includes('remark') || h.includes('comment') || h.includes('about'))

    if (nameIndex === -1 || phoneIndex === -1) {
      throw new Error('CSV headers must contain at least "name" and "phone" columns.')
    }

    const parsed = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      let values = []
      let insideQuote = false
      let currentValue = ''
      for (let j = 0; j < line.length; j++) {
        const char = line[j]
        if (char === '"') {
          insideQuote = !insideQuote
        } else if (char === ',' && !insideQuote) {
          values.push(currentValue.trim())
          currentValue = ''
        } else {
          currentValue += char
        }
      }
      values.push(currentValue.trim())

      let name = values[nameIndex]?.replace(/^"|"$/g, '') || ''
      let rawPhone = values[phoneIndex]?.replace(/^"|"$/g, '') || ''
      let email = emailIndex !== -1 ? (values[emailIndex]?.replace(/^"|"$/g, '') || '') : ''
      let notes = notesIndex !== -1 ? (values[notesIndex]?.replace(/^"|"$/g, '') || '') : ''

      if (name && rawPhone) {
        let phone = rawPhone.replace(/[^\d+]/g, '')
        
        if (phone.startsWith('03')) {
          phone = '+92' + phone.substring(1)
        } else if (phone.startsWith('3') && phone.length === 10) {
          phone = '+92' + phone
        } else if (phone.startsWith('92') && !phone.startsWith('+')) {
          phone = '+' + phone
        } else if (!phone.startsWith('+')) {
          phone = '+' + phone
        }

        parsed.push({ name, phone, email, notes })
      }
    }
    return parsed
  }

  const handleCsvChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCsvFile(file)
    setCsvError('')
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target.result
        const parsed = parseCSV(text)
        if (parsed.length === 0) {
          throw new Error('No valid leads (with name and phone) found in CSV file.')
        }
        setParsedLeadsData(parsed)
        setParsedLeadsCount(parsed.length)
      } catch (err) {
        setCsvError(err.message || 'Failed to parse CSV file.')
        setParsedLeadsData([])
        setParsedLeadsCount(0)
      }
    }
    reader.onerror = () => {
      setCsvError('Failed to read CSV file.')
    }
    reader.readAsText(file)
  }

  const handleImportSubmit = async (e) => {
    e.preventDefault()
    if (parsedLeadsData.length === 0) return
    setIsImporting(true)
    try {
      await api.post('/leads/bulk', { leads: parsedLeadsData })
      setShowImportModal(false)
      fetchLeads()
      window.alert(`Successfully imported ${parsedLeadsData.length} leads!`)
    } catch (err) {
      console.error(err)
      setCsvError(err.response?.data?.error || err.response?.data?.message || 'Failed to import leads.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Leads</h1>
          <div className="flex gap-2">
            {selectedLeads.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Delete Selected ({selectedLeads.length})
              </button>
            )}
            <button
              onClick={() => {
                setCsvFile(null)
                setParsedLeadsCount(0)
                setParsedLeadsData([])
                setCsvError('')
                setShowImportModal(true)
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md transition duration-200 flex items-center gap-1.5 shadow-sm font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import CSV
            </button>
            <button
              onClick={() => {
                setEditingLead(null)
                setLeadForm({ name: '', phone: '', email: '', status: 'PENDING' })
                setShowModal(true)
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Add Lead
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">
                  <input
                    type="checkbox"
                    checked={leads.length > 0 && selectedLeads.length === leads.length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Score</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leads.map(lead => (
                <tr key={lead.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedLeads.includes(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lead.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.email || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {lead.score !== null && lead.score !== undefined ? (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        lead.score >= 70 ? 'bg-red-100 text-red-800' :
                        lead.score >= 40 ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {lead.score}/100
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      lead.status === 'CONVERTED' ? 'bg-green-100 text-green-800' :
                      lead.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() => handleEdit(lead)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(lead.id)}
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

        <div className="mt-4 flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => fetchLeads(page - 1)}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2">Page {page} of {Math.ceil(total / limit)}</span>
          <button
            disabled={page * limit >= total}
            onClick={() => fetchLeads(page + 1)}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">{editingLead ? 'Edit Lead' : 'Add Lead'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm({...leadForm, name: e.target.value})}
                    required
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                  <div className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                    <PhoneInput
                      international
                      defaultCountry="PK"
                      value={leadForm.phone}
                      onChange={(value) => setLeadForm(prev => ({ ...prev, phone: value || '' }))}
                      placeholder="Enter phone number"
                      style={{ '--PhoneInputCountryFlag-height': '1em' }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Select country flag then enter number</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm({...leadForm, email: e.target.value})}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                {editingLead && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <select
                      value={leadForm.status}
                      onChange={(e) => setLeadForm({...leadForm, status: e.target.value})}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="CONTACTED">CONTACTED</option>
                      <option value="QUALIFIED">QUALIFIED</option>
                      <option value="BOOKED">BOOKED</option>
                      <option value="LOST">LOST</option>
                    </select>
                  </div>
                )}
                <div className="flex gap-4 justify-end">
                  {phoneError && (
                    <p className="text-red-500 text-sm self-center">{phoneError}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setEditingLead(null)
                      setPhoneError('')
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {editingLead ? 'Save' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 transform scale-100 transition-all duration-300">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Bulk Import Leads</h2>
                    <p className="text-xs text-gray-500">Upload `.csv` spreadsheet to insert multiple leads</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-xs font-semibold text-gray-500 block mb-1">REQUIRED FORMAT & COLUMNS:</span>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Your CSV must include columns named exactly <span className="font-semibold text-gray-800">name</span> and <span className="font-semibold text-gray-800">phone</span>.
                  You can optionally add <span className="font-semibold text-gray-800">email</span> and <span className="font-semibold text-gray-800">notes</span>.
                </p>
                <div className="mt-2 text-xs font-mono bg-white px-2 py-1.5 rounded border border-gray-100 text-gray-500 select-all">
                  name, phone, email, notes
                </div>
              </div>

              <form onSubmit={handleImportSubmit} className="space-y-5">
                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-emerald-400 transition bg-gray-50/50 group relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center pointer-events-none">
                    <div className="p-3 bg-white rounded-full shadow-sm border border-gray-100 text-gray-400 group-hover:text-emerald-500 group-hover:scale-110 transition duration-300 mb-2">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    {csvFile ? (
                      <div>
                        <span className="block text-sm font-semibold text-gray-700 truncate max-w-xs">{csvFile.name}</span>
                        <span className="text-xs text-gray-400">{(csvFile.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ) : (
                      <div>
                        <span className="block text-sm font-semibold text-gray-600">Click to upload or drag & drop</span>
                        <span className="text-xs text-gray-400">Only standard `.csv` spreadsheet files supported</span>
                      </div>
                    )}
                  </div>
                </div>

                {parsedLeadsCount > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-medium animate-pulse">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Found {parsedLeadsCount} valid leads ready for import!</span>
                  </div>
                )}

                {csvError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{csvError}</span>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 text-sm font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={parsedLeadsCount === 0 || isImporting}
                    className="px-5 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition shadow-sm flex items-center gap-1.5"
                  >
                    {isImporting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Importing...
                      </>
                    ) : (
                      'Upload Leads'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

