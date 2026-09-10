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
    <div className="p-6 max-w-5xl mx-auto min-h-screen pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl border border-white/5 shadow-lg shadow-cyan-500/10">
            <Clock className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Shifts Management
            </h1>
            <p className="text-slate-400 mt-1 font-medium">Configure work schedules and timeframes</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Create Form Container */}
        <div className="md:col-span-1">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
            
            <h2 className="text-xl font-bold text-white mb-6 relative z-10 flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" />
              Add Shift
            </h2>
            
            <form onSubmit={handleCreate} className="relative z-10 space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Shift Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Shift" className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Start Time</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">End Time</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner" required />
                </div>
              </div>
              
              <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5">
                <Plus className="w-5 h-5" /> Create Shift
              </button>
            </form>
          </div>
        </div>

        {/* List Container */}
        <div className="md:col-span-2">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4">
                <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
                <p className="text-slate-400 font-medium animate-pulse">Loading shifts...</p>
              </div>
            ) : shifts.length > 0 ? (
              <div className="divide-y divide-white/[0.05] custom-scrollbar overflow-y-auto max-h-[600px]">
                {shifts.map(shift => (
                  <div key={shift.id} className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                    <div className="flex items-center gap-4 w-full mr-4 min-w-0">
                      <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/5 rounded-xl shrink-0 shadow-inner">
                        <Clock className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-200 text-lg truncate">{shift.name}</p>
                        <p className="text-sm font-medium text-cyan-400/80 mt-0.5 bg-cyan-500/10 inline-block px-2 py-0.5 rounded-md border border-cyan-500/10">
                          {shift.startTime} - {shift.endTime}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditing(shift)} className="p-2.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10 bg-slate-900 border border-white/5 rounded-lg transition-all shadow-sm" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(shift.id)} className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 bg-slate-900 border border-white/5 rounded-lg transition-all shadow-sm" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3">
                <Clock className="w-12 h-12 text-slate-600 mb-2" />
                <p className="text-slate-300 font-semibold text-lg">No Shifts Yet</p>
                <p className="text-slate-500 text-sm max-w-sm text-center">Create your first shift using the form to configure working hours.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-slate-800/30">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-400" /> Edit Shift
              </h3>
              <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Shift Name</label>
                <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner" autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Start Time</label>
                  <input type="time" value={editData.startTime} onChange={e => setEditData({...editData, startTime: e.target.value})} className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">End Time</label>
                  <input type="time" value={editData.endTime} onChange={e => setEditData({...editData, endTime: e.target.value})} className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner" />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3 bg-slate-800/20">
              <button onClick={() => setEditingId(null)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors border border-white/5">
                Cancel
              </button>
              <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5">
                <Check className="w-5 h-5" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
