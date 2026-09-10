'use client'

import { useState, useEffect } from 'react'
import { Plus, User, Mail, Shield, Trash2, Edit2, Check, X } from 'lucide-react'
import { useSession } from 'next-auth/react'

type SystemUser = {
  id: string
  name: string
  email: string
}

export default function UsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)

  const [formData, setFormData] = useState({ name: '', email: '', password: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', email: '', password: '' })

  const fetchUsers = async () => {
    const res = await fetch('/api/users')
    if (res.ok) {
      setUsers(await res.json())
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
    
    if (res.ok) {
      setFormData({ name: '', email: '', password: '' })
      fetchUsers()
    } else {
      const error = await res.json()
      alert(error.error || 'Failed to create user')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchUsers()
    } else {
      const error = await res.json()
      alert(error.error || 'Failed to delete user')
    }
  }

  const startEditing = (u: SystemUser) => {
    setEditingId(u.id)
    setEditData({ name: u.name, email: u.email, password: '' }) // blank password unless changing
  }

  const saveEdit = async () => {
    const res = await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, ...editData })
    })
    if (res.ok) {
      setEditingId(null)
      fetchUsers()
    } else {
      const error = await res.json()
      alert(error.error || 'Failed to update user')
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto min-h-screen pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl border border-white/5 shadow-lg shadow-indigo-500/10">
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              System Users
            </h1>
            <p className="text-slate-400 mt-1 font-medium">Manage administrators and system access</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create Form Container */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
            
            <h2 className="text-xl font-bold text-white mb-6 relative z-10 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              Add Administrator
            </h2>
            
            <form onSubmit={handleCreate} className="relative z-10 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Full Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. John Doe" className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner" required />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Email Address</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="e.g. john@company.com" className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner" required />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Secure Password</label>
                <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner font-mono tracking-widest" required />
              </div>
              
              <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 mt-2">
                <Plus className="w-5 h-5" /> Create User
              </button>
            </form>
          </div>
        </div>

        {/* List Container */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-800/50 text-slate-300 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-5 rounded-tl-3xl">Administrator</th>
                    <th className="px-6 py-5">Role & Access</th>
                    <th className="px-6 py-5 text-right rounded-tr-3xl">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="p-12">
                        <div className="flex flex-col items-center justify-center gap-4">
                          <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                          <p className="text-slate-400 font-medium animate-pulse">Loading users...</p>
                        </div>
                      </td>
                    </tr>
                  ) : users.length > 0 ? (
                    users.map((u) => {
                      const isMe = session?.user?.email === u.email;

                      return (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/5 rounded-xl shrink-0 shadow-inner">
                                <User className="w-5 h-5 text-indigo-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-slate-200 text-base truncate">{u.name}</p>
                                  {isMe && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-xs">
                                  <Mail className="w-3.5 h-3.5" />
                                  <span className="truncate">{u.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase border shadow-sm bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10">
                                <Shield className="w-3.5 h-3.5" />
                                Admin
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEditing(u)} className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 bg-slate-900 border border-white/5 rounded-lg transition-all shadow-sm" title="Edit Security">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {!isMe && (
                                <button onClick={() => handleDelete(u.id)} className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 bg-slate-900 border border-white/5 rounded-lg transition-all shadow-sm" title="Revoke Access">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} className="p-16 text-center">
                        <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-300 font-semibold text-lg">No Users Found</p>
                        <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Create administrative users to manage the system.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Modern Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-slate-800/30">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" /> Edit Access Details
              </h3>
              <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Full Name</label>
                <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner" autoFocus />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Email Address</label>
                <input type="email" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">New Password <span className="text-slate-600 font-normal normal-case">(Leave blank to keep current)</span></label>
                <input type="password" value={editData.password} onChange={e => setEditData({...editData, password: e.target.value})} placeholder="••••••••" className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner font-mono tracking-widest" />
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3 bg-slate-800/20">
              <button onClick={() => setEditingId(null)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors border border-white/5">
                Cancel
              </button>
              <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5">
                <Check className="w-5 h-5" /> Update Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
