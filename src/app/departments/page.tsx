'use client'

import { useState, useEffect } from 'react'
import { Plus, Building2, Trash2, Edit2, Check, X } from 'lucide-react'

type Department = { id: string, name: string }

export default function DepartmentsPage() {
  const [items, setItems] = useState<Department[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const startEditing = (dept: Department) => {
    setEditingId(dept.id)
    setEditName(dept.name)
  }

  const saveEdit = async () => {
    if (!editName) return
    const res = await fetch('/api/departments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, name: editName })
    })
    if (res.ok) {
      setEditingId(null)
      fetchData()
    }
  }

  const fetchData = async () => {
    const res = await fetch('/api/departments')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    if (res.ok) {
      setName('')
      fetchData()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return
    const res = await fetch(`/api/departments?id=${id}`, { method: 'DELETE' })
    if (res.ok) fetchData()
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto min-h-screen pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/[0.05] rounded-2xl border border-white/[0.06]">
            <Building2 className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-100">
              Departments Management
            </h1>
            <p className="text-slate-500 mt-1 font-medium">Organize and manage your company structure</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Create Form Container */}
        <div className="md:col-span-1">
          <div className="bg-white/[0.025] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex flex-col">
            <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              Add Department
            </h2>
            
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Department Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Engineering" className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-slate-200 font-medium focus:outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/15 transition-all" required />
              </div>
              
              <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all duration-200">
                <Plus className="w-5 h-5" /> Create Department
              </button>
            </form>
          </div>
        </div>

        {/* List Container */}
        <div className="md:col-span-2">
          <div className="bg-white/[0.025] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex flex-col h-full">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4">
                <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-medium animate-pulse">Loading departments...</p>
              </div>
            ) : items.length > 0 ? (
              <div className="divide-y divide-white/[0.05] custom-scrollbar overflow-y-auto max-h-[600px]">
                {items.map(dept => (
                  <div key={dept.id} className="p-5 flex items-center justify-between hover:bg-white/[0.04] transition-colors group">
                    <div className="flex items-center gap-4 w-full mr-4 min-w-0">
                      <div className="p-3 bg-white/[0.06] border border-white/[0.06] rounded-xl shrink-0">
                        <Building2 className="w-6 h-6 text-indigo-400" />
                      </div>
                      <p className="font-semibold text-slate-200 text-lg truncate">{dept.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditing(dept)} className="p-2.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10 bg-white/[0.03] border border-white/[0.06] rounded-lg transition-all" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(dept.id)} className="p-2.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 bg-white/[0.03] border border-white/[0.06] rounded-lg transition-all" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3">
                <Building2 className="w-12 h-12 text-slate-700 mb-2" />
                <p className="text-slate-300 font-semibold text-lg">No Departments Yet</p>
                <p className="text-slate-500 text-sm max-w-sm text-center">Create your first department using the form to organize your staff.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl animate-in fade-in">
          <div className="bg-[#0d1017]/95 backdrop-blur-2xl border border-white/[0.07] rounded-2xl w-full max-w-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-white/[0.06] flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" /> Edit Department
              </h3>
              <button onClick={() => setEditingId(null)} className="p-1 text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Department Name</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-slate-200 font-medium focus:outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/15 transition-all" autoFocus />
              </div>
            </div>

            <div className="p-6 border-t border-white/[0.06] flex gap-3 bg-white/[0.01]">
              <button onClick={() => setEditingId(null)} className="flex-1 px-4 py-3 bg-white/[0.04] hover:bg-white/[0.07] text-slate-300 font-bold rounded-xl transition-colors border border-white/[0.06]">
                Cancel
              </button>
              <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all duration-200">
                <Check className="w-5 h-5" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
