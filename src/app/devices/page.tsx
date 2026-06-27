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
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Server className="w-6 h-6 text-indigo-400" />
            Device Manager
          </h1>
          <p className="text-slate-400 text-sm mt-1">Configure and monitor biometric devices.</p>
        </div>
        <button onClick={fetchDevices} className="p-2 bg-slate-900 border border-white/10 rounded-lg hover:bg-slate-800 transition-colors">
          <RefreshCw className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create Form */}
        <div className="lg:col-span-1">
          <form onSubmit={handleCreate} className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Register Device</h2>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Device Name</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Front Door D01" className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">IP Address (Optional)</label>
              <input type="text" value={formData.ipAddress} onChange={e => setFormData({...formData, ipAddress: e.target.value})} placeholder="e.g. 192.168.1.100" className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Port (Optional)</label>
              <input type="text" value={formData.port} onChange={e => setFormData({...formData, port: e.target.value})} placeholder="e.g. 4370" className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white" />
            </div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors mt-2">
              <Plus className="w-4 h-4" /> Add Device
            </button>
          </form>
        </div>

        {/* Device List */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-white/5 text-slate-300 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Device</th>
                    <th className="px-6 py-4">Network Info</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr><td colSpan={4} className="p-8 text-center">Loading...</td></tr>
                  ) : devices.length > 0 ? (
                    devices.map((device) => {
                      const isEditing = editingId === device.id
                      const now = new Date()
                      const isOnline = (now.getTime() - new Date(device.lastPing).getTime()) < 5 * 60 * 1000

                      return (
                        <tr key={device.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-sm" />
                            ) : (
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`p-2 rounded-lg shrink-0 ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                  <Server className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-white truncate">{device.name}</p>
                                  <p className="text-xs text-slate-500 truncate">ID: {device.id}</p>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <div className="space-y-1">
                                <input type="text" value={editData.ipAddress} onChange={e => setEditData({...editData, ipAddress: e.target.value})} placeholder="IP" className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-sm" />
                                <input type="text" value={editData.port} onChange={e => setEditData({...editData, port: e.target.value})} placeholder="Port" className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-sm" />
                              </div>
                            ) : (
                              <div>
                                <p className="text-slate-300">{device.ipAddress || 'No IP configured'}</p>
                                {device.port && <p className="text-xs text-slate-500">Port: {device.port}</p>}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${
                                isOnline 
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/20'
                              }`}>
                                {isOnline ? 'ONLINE' : 'OFFLINE'}
                              </span>
                              <span className="text-xs text-slate-500 mt-1">
                                Last seen: {format(new Date(device.lastPing), 'MMM dd, HH:mm')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            {isEditing ? (
                              <>
                                <button onClick={saveEdit} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/40 transition-colors"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setEditingId(null)} className="p-1.5 bg-rose-500/20 text-rose-400 rounded hover:bg-rose-500/40 transition-colors"><X className="w-4 h-4" /></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEditing(device)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(device.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-12 text-center">
                        <Server className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400">No devices configured yet.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
