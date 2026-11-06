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
    <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-lg border border-white/[0.04]">
            <Server className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">
              Device Manager
            </h1>
            <p className="text-muted mt-1 font-medium">Configure and monitor biometric devices</p>
          </div>
        </div>
        <button onClick={fetchDevices} className="flex items-center gap-2 px-4 py-2.5 bg-black/40 border border-white/[0.08] rounded-md hover:bg-black/40 transition-colors text-slate-300 font-medium group">
          <RefreshCw className="w-5 h-5 text-blue-400 group-hover:rotate-180 transition-transform duration-500" />
          Refresh Status
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create Form Container */}
        <div className="lg:col-span-1">
          <div className="bg-black/30 border border-white/[0.08] rounded-lg p-6 relative overflow-hidden flex flex-col">
            
            <h2 className="text-xl font-bold text-white mb-6 relative z-10 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" />
              Register Device
            </h2>
            
            <form onSubmit={handleCreate} className="relative z-10 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Device Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Front Door D01" className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all" required />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">IP Address <span className="text-subtle font-normal normal-case">(Optional)</span></label>
                <input type="text" value={formData.ipAddress} onChange={e => setFormData({...formData, ipAddress: e.target.value})} placeholder="e.g. 192.168.1.100" className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Port <span className="text-subtle font-normal normal-case">(Optional)</span></label>
                <input type="text" value={formData.port} onChange={e => setFormData({...formData, port: e.target.value})} placeholder="e.g. 4370" className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono text-sm" />
              </div>
              
              <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-accent hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-md transition-all hover:-translate-y-0.5 mt-2">
                <Plus className="w-5 h-5" /> Add Device
              </button>
            </form>
          </div>
        </div>

        {/* List Container */}
        <div className="lg:col-span-2">
          <div className="bg-black/30 border border-white/[0.08] rounded-lg overflow-hidden flex flex-col h-full">

            {/* Card grid (all breakpoints) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-5">
              {loading ? (
                <div className="col-span-full p-12 text-center bg-black/40 rounded-lg border border-white/[0.08]">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="text-muted font-medium animate-pulse">Loading devices...</p>
                  </div>
                </div>
              ) : devices.length > 0 ? (
                devices.map((device) => {
                  const now = new Date()
                  const isOnline = (now.getTime() - new Date(device.lastPing).getTime()) < 5 * 60 * 1000

                  return (
                    <div key={device.id} className="bg-black/40 border border-white/[0.08] rounded-lg p-5 flex flex-col gap-4 relative overflow-hidden group">
                      
                      <div className="flex items-start justify-between relative z-10">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`p-3 rounded-md shrink-0  border border-white/[0.04] transition-colors duration-500 ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            <Server className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex flex-col">
                            <p className="font-bold text-white text-lg truncate">{device.name}</p>
                            <p className="text-xs text-subtle font-mono mt-0.5">ID: {device.id}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-2 relative z-10">
                        <div className="bg-black/50 p-3 rounded-lg border border-white/[0.04] flex flex-col justify-center">
                          <span className="text-[10px] font-bold text-subtle uppercase tracking-wider block mb-1">Network</span>
                          <p className="font-mono text-sm text-slate-300">{device.ipAddress || <span className="text-subtle italic font-sans text-xs">No IP</span>}</p>
                          {device.port && <p className="text-xs text-blue-400/80 font-mono">:{device.port}</p>}
                        </div>
                        <div className="bg-black/50 p-3 rounded-lg border border-white/[0.04] flex flex-col justify-center items-start">
                          <span className="text-[10px] font-bold text-subtle uppercase tracking-wider block mb-1">Status</span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border  transition-colors duration-500 ${
                            isOnline 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ' 
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20 '
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/[0.08] relative z-10">
                        <span className="text-[10px] text-subtle font-bold uppercase tracking-wider">
                          Seen {format(new Date(device.lastPing), 'MMM dd, hh:mm a')}
                        </span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEditing(device)} className="p-2.5 text-muted hover:text-blue-400 hover:bg-accent-hover/10 bg-black/60 border border-white/[0.08] rounded-md transition-all">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(device.id)} className="p-2.5 text-muted hover:text-rose-400 hover:bg-rose-400/10 bg-black/60 border border-white/[0.08] rounded-md transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full p-12 text-center bg-black/40 rounded-lg border border-white/[0.08]">
                  <div className="flex flex-col items-center gap-3">
                    <Server className="w-12 h-12 text-subtle mb-2" />
                    <p className="text-slate-300 font-bold text-lg">No Devices Configured</p>
                    <p className="text-subtle text-sm">Add your first biometric attendance device.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Modern Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in">
          <div className="bg-black/60 border border-white/[0.08] rounded-lg w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-white/[0.08] flex justify-between items-center bg-black/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" /> Edit Device
              </h3>
              <button onClick={() => setEditingId(null)} className="p-1 text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Device Name</label>
                <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full bg-black/60 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all" autoFocus />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">IP Address</label>
                <input type="text" value={editData.ipAddress} onChange={e => setEditData({...editData, ipAddress: e.target.value})} className="w-full bg-black/60 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono text-sm" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Port</label>
                <input type="text" value={editData.port} onChange={e => setEditData({...editData, port: e.target.value})} className="w-full bg-black/60 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono text-sm" />
              </div>
            </div>

            <div className="p-6 border-t border-white/[0.08] flex gap-3 bg-black/30">
              <button onClick={() => setEditingId(null)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-md transition-colors border border-white/[0.04]">
                Cancel
              </button>
              <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-md transition-all hover:-translate-y-0.5">
                <Check className="w-5 h-5" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
