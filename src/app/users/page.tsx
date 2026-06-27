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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-white">System Users</h1>
        <p className="text-slate-400 text-sm mt-1">Manage admin users and their access.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create Form */}
        <div className="lg:col-span-1">
          <form onSubmit={handleCreate} className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Add New User</h2>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
              <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white" required />
            </div>

            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors mt-4">
              <Plus className="w-4 h-4" /> Create User
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-white/5 text-slate-300 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr><td colSpan={4} className="p-8 text-center">Loading...</td></tr>
                  ) : users.length > 0 ? (
                    users.map((u) => {
                      const isEditing = editingId === u.id;
                      const isMe = session?.user?.email === u.email;

                      return (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                            <User className="w-4 h-4" />
                          </div>
                          {isEditing ? (
                            <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-sm" />
                          ) : (
                            <span className="flex items-center gap-2">{u.name} {isMe && <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400">You</span>}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              <input type="email" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-sm" />
                              <input type="password" placeholder="New Password (optional)" value={editData.password} onChange={e => setEditData({...editData, password: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-sm" />
                            </div>
                          ) : (
                            <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-500"/>{u.email}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                           <span className="flex items-center gap-1.5 text-emerald-400"><Shield className="w-3 h-3"/> Admin</span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {isEditing ? (
                            <>
                              <button onClick={saveEdit} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/40 transition-colors"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setEditingId(null)} className="p-1.5 bg-rose-500/20 text-rose-400 rounded hover:bg-rose-500/40 transition-colors"><X className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEditing(u)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                              {!isMe && (
                                <button onClick={() => handleDelete(u.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                      )
                    })
                  ) : (
                    <tr><td colSpan={4} className="p-12 text-center">No users found.</td></tr>
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
