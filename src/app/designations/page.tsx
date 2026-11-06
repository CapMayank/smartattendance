'use client'

import { useState, useEffect } from 'react'
import { Plus, IdCard, Trash2, Edit2, Check, X } from 'lucide-react'

type Designation = { id: string, name: string }

export default function DesignationsPage() {
  const [items, setItems] = useState<Designation[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const startEditing = (desig: Designation) => {
    setEditingId(desig.id)
    setEditName(desig.name)
  }

  const saveEdit = async () => {
    if (!editName) return
    const res = await fetch('/api/designations', {
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
    const res = await fetch('/api/designations')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return
    const res = await fetch('/api/designations', {
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
    if (!confirm('Are you sure you want to delete this designation?')) return
    const res = await fetch(`/api/designations?id=${id}`, { method: 'DELETE' })
    if (res.ok) fetchData()
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/20 rounded-lg border border-white/[0.04]">
            <IdCard className="w-8 h-8 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">
              Designations Management
            </h1>
            <p className="text-muted mt-1 font-medium">Manage job titles and professional roles</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Create Form Container */}
        <div className="md:col-span-1">
          <div className="bg-black/30 border border-white/[0.08] rounded-lg p-6 relative overflow-hidden flex flex-col">
            
            <h2 className="text-xl font-bold text-white mb-6 relative z-10 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-400" />
              Add Designation
            </h2>
            
            <form onSubmit={handleCreate} className="relative z-10 space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Designation Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Senior Developer" className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all" required />
              </div>
              
              <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-600 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-md transition-all hover:-translate-y-0.5">
                <Plus className="w-5 h-5" /> Create Designation
              </button>
            </form>
          </div>
        </div>

        {/* List Container */}
        <div className="md:col-span-2">
          <div className="bg-black/30 border border-white/[0.08] rounded-lg overflow-hidden flex flex-col h-full">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4">
                <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
                <p className="text-muted font-medium animate-pulse">Loading designations...</p>
              </div>
            ) : items.length > 0 ? (
              <div className="divide-y divide-white/[0.05] custom-scrollbar overflow-y-auto max-h-[600px]">
                {items.map(desig => (
                  <div key={desig.id} className="p-5 flex items-center justify-between hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-4 w-full mr-4 min-w-0">
                      <div className="p-3 bg-amber-500/20 border border-white/[0.04] rounded-md shrink-0">
                        <IdCard className="w-6 h-6 text-amber-400" />
                      </div>
                      <p className="font-semibold text-slate-200 text-lg truncate">{desig.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditing(desig)} className="p-2.5 text-muted hover:text-amber-400 hover:bg-amber-400/10 bg-black/40 border border-white/[0.04] rounded-lg transition-all" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(desig.id)} className="p-2.5 text-muted hover:text-rose-400 hover:bg-rose-400/10 bg-black/40 border border-white/[0.04] rounded-lg transition-all" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3">
                <IdCard className="w-12 h-12 text-subtle mb-2" />
                <p className="text-slate-300 font-semibold text-lg">No Designations Yet</p>
                <p className="text-subtle text-sm max-w-sm text-center">Create your first designation using the form to organize job titles.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in">
          <div className="bg-black/60 border border-white/[0.08] rounded-lg w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-white/[0.08] flex justify-between items-center bg-black/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" /> Edit Designation
              </h3>
              <button onClick={() => setEditingId(null)} className="p-1 text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Designation Name</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-black/60 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all" autoFocus />
              </div>
            </div>

            <div className="p-6 border-t border-white/[0.08] flex gap-3 bg-black/30">
              <button onClick={() => setEditingId(null)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-md transition-colors border border-white/[0.04]">
                Cancel
              </button>
              <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-md transition-all hover:-translate-y-0.5">
                <Check className="w-5 h-5" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
