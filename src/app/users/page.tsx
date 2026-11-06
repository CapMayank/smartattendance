'use client'

import { useState, useEffect } from 'react'
import { Plus, User, Shield, Trash2, Pencil } from 'lucide-react'
import { Avatar, Button, Card, CardHeader, EmptyState, Field, IconButton, Input, Modal, PageHeader, Skeleton } from '@/components/ui'
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
    <div className="space-y-5">
      <PageHeader title="System users" subtitle="Manage administrators and system access" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="self-start lg:col-span-1">
          <CardHeader title="Add administrator" />
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Full name" htmlFor="new-name">
              <Input id="new-name" type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. John Doe" required />
            </Field>
            <Field label="Email address" htmlFor="new-email">
              <Input id="new-email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="e.g. john@company.com" required />
            </Field>
            <Field label="Secure password" htmlFor="new-password">
              <Input id="new-password" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" required />
            </Field>
            <Button type="submit" icon={Plus} className="w-full">Create User</Button>
          </form>
        </Card>

        <Card className="overflow-hidden !p-0 lg:col-span-2">
          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : users.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Access level</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isMe = session?.user?.email === u.email;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar name={u.name} />
                            <span className="font-medium text-text">{u.name}</span>
                            {isMe && (
                              <span className="rounded-full border border-line bg-card-hi px-2 py-0.5 text-[11px] text-muted">You</span>
                            )}
                          </div>
                        </td>
                        <td className="text-muted">{u.email}</td>
                        <td>
                          <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-line bg-card-hi px-2.5 text-xs text-muted">
                            <Shield size={13} aria-hidden="true" />
                            Admin
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-2">
                            <IconButton icon={Pencil} label="Edit user" className="size-8" onClick={() => startEditing(u)} />
                            {!isMe && (
                              <IconButton icon={Trash2} label="Delete user" className="size-8 hover:border-absent hover:text-absent" onClick={() => handleDelete(u.id)} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={User} title="No users found" hint="Create administrative users to manage the system." />
          )}
        </Card>
      </div>

      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Edit access details"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Update Access</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name" htmlFor="edit-name">
            <Input id="edit-name" type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} autoFocus />
          </Field>
          <Field label="Email address" htmlFor="edit-email">
            <Input id="edit-email" type="email" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} />
          </Field>
          <Field label="New password" htmlFor="edit-password" helper="Leave blank to keep current">
            <Input id="edit-password" type="password" value={editData.password} onChange={e => setEditData({...editData, password: e.target.value})} placeholder="••••••••" />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
