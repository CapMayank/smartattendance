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
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Departments Management</h1>
        <p className="text-slate-400 text-sm mt-1">Organize your staff into departments.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <form onSubmit={handleCreate} className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Add Department</h2>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Department Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Engineering" className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white" required />
            </div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>
        </div>

        <div className="md:col-span-2">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : items.length > 0 ? (
              <div className="divide-y divide-white/5">
                {items.map(dept => {
                  const isEditing = editingId === dept.id;
                  return (
                  <div key={dept.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4 w-full mr-4 min-w-0">
                      <div className="p-3 bg-indigo-500/20 rounded-xl shrink-0">
                        <Building2 className="w-5 h-5 text-indigo-400" />
                      </div>
                      {isEditing ? (
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white text-sm" />
                      ) : (
                        <p className="font-medium text-white truncate">{dept.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/40 transition-colors"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingId(null)} className="p-2 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/40 transition-colors"><X className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditing(dept)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Edit Department"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(dept.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Delete Department"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>
            ) : <div className="p-8 text-center text-slate-400">No departments added yet.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
