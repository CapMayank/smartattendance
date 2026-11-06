'use client'

import { useState, useEffect } from 'react'
import { Plus, Server, Trash2, Edit2, Check, X, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

type Device = {
  id: string
  name: string
  ipAddress: string | null
  port: string | null
  status: string
  lastPing: string
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  const [formData, setFormData] = useState({ name: '', ipAddress: '', port: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', ipAddress: '', port: '' })

  const fetchDevices = async () => {
    const res = await fetch('/api/devices')
    if (res.ok) setDevices(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) return
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
    if (res.ok) {
      setFormData({ name: '', ipAddress: '', port: '' })
      fetchDevices()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this device configuration?')) return
    const res = await fetch(`/api/devices?id=${id}`, { method: 'DELETE' })
    if (res.ok) fetchDevices()
  }

  const startEditing = (device: Device) => {
    setEditingId(device.id)
    setEditData({
      name: device.name,
      ipAddress: device.ipAddress || '',
      port: device.port || ''
    })
  }

  const saveEdit = async () => {
    const res = await fetch('/api/devices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, ...editData })
    })
    if (res.ok) {
      setEditingId(null)
      fetchDevices()
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto min-h-screen pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-3xl border border-white/[0.04] shadow-lg shadow-indigo-500/10">
            <Server className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Device Manager
            </h1>
            <p className="text-slate-400 mt-1 font-medium">Configure and monitor biometric devices</p>
          </div>
        </div>
        <button onClick={fetchDevices} className="flex items-center gap-2 px-4 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl hover:bg-black/40 transition-colors shadow-sm text-slate-300 font-medium group">
          <RefreshCw className="w-5 h-5 text-indigo-400 group-hover:rotate-180 transition-transform duration-500" />
          Refresh Status
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create Form Container */}
        <div className="lg:col-span-1">
          <div className="bg-black/30 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
            
            <h2 className="text-xl font-bold text-white mb-6 relative z-10 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              Register Device
            </h2>
            
            <form onSubmit={handleCreate} className="relative z-10 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Device Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Front Door D01" className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner" required />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">IP Address <span className="text-slate-600 font-normal normal-case">(Optional)</span></label>
                <input type="text" value={formData.ipAddress} onChange={e => setFormData({...formData, ipAddress: e.target.value})} placeholder="e.g. 192.168.1.100" className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner font-mono text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Port <span className="text-slate-600 font-normal normal-case">(Optional)</span></label>
                <input type="text" value={formData.port} onChange={e => setFormData({...formData, port: e.target.value})} placeholder="e.g. 4370" className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner font-mono text-sm" />
              </div>
              
              <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 mt-2">
                <Plus className="w-5 h-5" /> Add Device
              </button>
            </form>
          </div>
        </div>

        {/* List Container */}
        <div className="lg:col-span-2">
          <div className="bg-black/30 backdrop-blur-2xl border border-white/[0.08] rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col h-full">

            {/* Card grid (all breakpoints) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-5">
              {loading ? (
                <div className="col-span-full p-12 text-center bg-black/40 rounded-3xl border border-white/[0.08]">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                    <p className="text-slate-400 font-medium animate-pulse">Loading devices...</p>
                  </div>
                </div>
              ) : devices.length > 0 ? (
                devices.map((device) => {
                  const now = new Date()
                  const isOnline = (now.getTime() - new Date(device.lastPing).getTime()) < 5 * 60 * 1000

                  return (
                    <div key={device.id} className="bg-black/40 border border-white/[0.08] rounded-3xl p-5 flex flex-col gap-4 relative overflow-hidden shadow-lg group">
                      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-colors ${isOnline ? 'bg-emerald-500/5 group-hover:bg-emerald-500/10' : 'bg-rose-500/5 group-hover:bg-rose-500/10'}`}></div>
                      
                      <div className="flex items-start justify-between relative z-10">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`p-3 rounded-xl shrink-0 shadow-inner border border-white/[0.04] transition-colors duration-500 ${isOnline ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400' : 'bg-gradient-to-br from-rose-500/20 to-red-500/20 text-rose-400'}`}>
                            <Server className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex flex-col">
                            <p className="font-bold text-white text-lg truncate">{device.name}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {device.id}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-2 relative z-10">
                        <div className="bg-black/50 p-3 rounded-2xl border border-white/[0.04] flex flex-col justify-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Network</span>
                          <p className="font-mono text-sm text-slate-300">{device.ipAddress || <span className="text-slate-600 italic font-sans text-xs">No IP</span>}</p>
                          {device.port && <p className="text-xs text-indigo-400/80 font-mono">:{device.port}</p>}
                        </div>
                        <div className="bg-black/50 p-3 rounded-2xl border border-white/[0.04] flex flex-col justify-center items-start">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Status</span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border shadow-sm transition-colors duration-500 ${
                            isOnline 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10' 
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/10'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/[0.08] relative z-10">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          Seen {format(new Date(device.lastPing), 'MMM dd, hh:mm a')}
                        </span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEditing(device)} className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 bg-black/60 border border-white/[0.08] rounded-xl transition-all shadow-sm">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(device.id)} className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 bg-black/60 border border-white/[0.08] rounded-xl transition-all shadow-sm">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full p-12 text-center bg-black/40 rounded-3xl border border-white/[0.08]">
                  <div className="flex flex-col items-center gap-3">
                    <Server className="w-12 h-12 text-slate-600 mb-2" />
                    <p className="text-slate-300 font-bold text-lg">No Devices Configured</p>
                    <p className="text-slate-500 text-sm">Add your first biometric attendance device.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Modern Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in">
          <div className="bg-black/60 backdrop-blur-2xl border border-white/[0.08] rounded-3xl w-full max-w-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-white/[0.08] flex justify-between items-center bg-black/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" /> Edit Device
              </h3>
              <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Device Name</label>
                <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full bg-black/60 border border-white/[0.08] rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner" autoFocus />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">IP Address</label>
                <input type="text" value={editData.ipAddress} onChange={e => setEditData({...editData, ipAddress: e.target.value})} className="w-full bg-black/60 border border-white/[0.08] rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner font-mono text-sm" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Port</label>
                <input type="text" value={editData.port} onChange={e => setEditData({...editData, port: e.target.value})} className="w-full bg-black/60 border border-white/[0.08] rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner font-mono text-sm" />
              </div>
            </div>

            <div className="p-6 border-t border-white/[0.08] flex gap-3 bg-black/30">
              <button onClick={() => setEditingId(null)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors border border-white/[0.04]">
                Cancel
              </button>
              <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5">
                <Check className="w-5 h-5" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
