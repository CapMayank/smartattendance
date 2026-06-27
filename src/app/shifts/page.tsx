'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Clock, Edit2, Check, X } from 'lucide-react'

type Shift = {
  id: string
  name: string
  startTime: string
  endTime: string
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [name, setName] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', startTime: '', endTime: '' })

  const startEditing = (shift: Shift) => {
    setEditingId(shift.id)
    setEditData({ name: shift.name, startTime: shift.startTime, endTime: shift.endTime })
  }

  const saveEdit = async () => {
    if (!editData.name || !editData.startTime || !editData.endTime) return
    const res = await fetch('/api/shifts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, ...editData })
    })
    if (res.ok) {
      setEditingId(null)
      fetchShifts()
    }
  }

  const fetchShifts = async () => {
    const res = await fetch('/api/shifts')
    if (res.ok) {
      setShifts(await res.json())
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchShifts()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !startTime || !endTime) return

    const res = await fetch('/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, startTime, endTime })
    })

    if (res.ok) {
      setName('')
      fetchShifts()
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE' })
    if (res.ok) fetchShifts()
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Shifts Management</h1>
          <p className="text-slate-400 text-sm mt-1">Configure work shifts for your staff.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create Form */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Add New Shift</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Shift Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. Morning Shift"
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white" 
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Start Time</label>
                  <input 
                    type="time" 
                    value={startTime} 
                    onChange={e => setStartTime(e.target.value)} 
                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white" 
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">End Time</label>
                  <input 
                    type="time" 
                    value={endTime} 
                    onChange={e => setEndTime(e.target.value)} 
                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white" 
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors mt-2"
              >
                <Plus className="w-4 h-4" />
                Add Shift
              </button>
            </form>
          </div>
        </div>

        {/* Shifts List */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading...</div>
            ) : shifts.length > 0 ? (
              <div className="divide-y divide-white/5">
                {shifts.map((shift) => {
                  const isEditing = editingId === shift.id;
                  return (
                  <div key={shift.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4 w-full mr-4 min-w-0">
                      <div className="p-3 bg-blue-500/20 rounded-xl shrink-0">
                        <Clock className="w-5 h-5 text-blue-400" />
                      </div>
                      {isEditing ? (
                        <div className="flex flex-col gap-2 w-full">
                          <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-sm" />
                          <div className="flex items-center gap-2">
                            <input type="time" value={editData.startTime} onChange={e => setEditData({...editData, startTime: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-sm" />
                            <span className="text-slate-500">-</span>
                            <input type="time" value={editData.endTime} onChange={e => setEditData({...editData, endTime: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-sm" />
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{shift.name}</p>
                          <p className="text-sm text-slate-400">{shift.startTime} - {shift.endTime}</p>
                        </div>
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
                          <button onClick={() => startEditing(shift)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Edit Shift"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(shift.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Delete Shift"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No shifts created yet.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
