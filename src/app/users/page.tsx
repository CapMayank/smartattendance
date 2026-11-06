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
    <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-lg border border-white/[0.04]">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">
              System Users
            </h1>
            <p className="text-muted mt-1 font-medium">Manage administrators and system access</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create Form Container */}
        <div className="lg:col-span-1">
          <div className="bg-black/30 border border-white/[0.08] rounded-lg p-6 relative overflow-hidden flex flex-col">
            
            <h2 className="text-xl font-bold text-white mb-6 relative z-10 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" />
              Add Administrator
            </h2>
            
            <form onSubmit={handleCreate} className="relative z-10 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Full Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. John Doe" className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all" required />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Email Address</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="e.g. john@company.com" className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all" required />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Secure Password</label>
                <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono tracking-wider" required />
              </div>
              
              <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-accent text-white font-bold rounded-md transition-all mt-2">
                <Plus className="w-5 h-5" /> Create User
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
                    <p className="text-muted font-medium animate-pulse">Loading users...</p>
                  </div>
                </div>
              ) : users.length > 0 ? (
                users.map((u) => {
                  const isMe = session?.user?.email === u.email;
                  return (
                    <div key={u.id} className="bg-black/40 border border-white/[0.08] rounded-lg p-5 flex flex-col gap-4 relative overflow-hidden group">
                      
                      <div className="flex items-start justify-between relative z-10">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="p-3 bg-blue-500/20 border border-white/[0.04] rounded-md shrink-0">
                            <User className="w-5 h-5 text-blue-400" />
                          </div>
                          <div className="min-w-0 flex flex-col">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-white text-lg truncate">{u.name}</p>
                              {isMe && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/20 uppercase tracking-wider shrink-0">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-muted text-sm mt-0.5">
                              <Mail className="w-3.5 h-3.5" />
                              <span className="truncate">{u.email}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/[0.08] relative z-10">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-subtle uppercase tracking-wider">Access Level</span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            <Shield className="w-3.5 h-3.5" />
                            Admin
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEditing(u)} className="p-2.5 text-muted hover:text-blue-400 hover:bg-accent-hover/10 bg-black/60 border border-white/[0.08] rounded-md transition-all">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!isMe && (
                            <button onClick={() => handleDelete(u.id)} className="p-2.5 text-muted hover:text-rose-400 hover:bg-rose-400/10 bg-black/60 border border-white/[0.08] rounded-md transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full p-12 text-center bg-black/40 rounded-lg border border-white/[0.08]">
                  <div className="flex flex-col items-center gap-3">
                    <User className="w-12 h-12 text-subtle mb-2" />
                    <p className="text-slate-300 font-bold text-lg">No Users Found</p>
                    <p className="text-subtle text-sm">Create administrative users to manage the system.</p>
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
                <Shield className="w-5 h-5 text-blue-400" /> Edit Access Details
              </h3>
              <button onClick={() => setEditingId(null)} className="p-1 text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Full Name</label>
                <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full bg-black/60 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all" autoFocus />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Email Address</label>
                <input type="email" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} className="w-full bg-black/60 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">New Password <span className="text-subtle font-normal normal-case">(Leave blank to keep current)</span></label>
                <input type="password" value={editData.password} onChange={e => setEditData({...editData, password: e.target.value})} placeholder="••••••••" className="w-full bg-black/60 border border-white/[0.08] rounded-md px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono tracking-wider" />
              </div>
            </div>

            <div className="p-6 border-t border-white/[0.08] flex gap-3 bg-black/30">
              <button onClick={() => setEditingId(null)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-md transition-colors border border-white/[0.04]">
                Cancel
              </button>
              <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent text-white font-bold rounded-md transition-all">
                <Check className="w-5 h-5" /> Update Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
