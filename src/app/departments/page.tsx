'use client'

import { useState, useEffect } from 'react'
import { Plus, Building2, Trash2, Pencil } from 'lucide-react'
import { Button, Card, CardHeader, EmptyState, Field, IconButton, Input, Modal, PageHeader, Skeleton } from '@/components/ui'

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
    <div className="space-y-5">
      <PageHeader title="Departments" subtitle="Organize and manage your company structure" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-1 self-start">
          <CardHeader title="Add department" />
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Department name" htmlFor="new-name">
              <Input id="new-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Engineering" required />
            </Field>
            <Button type="submit" icon={Plus} className="w-full">Create Department</Button>
          </form>
        </Card>

        <Card className="overflow-hidden !p-0 md:col-span-2">
          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : items.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(dept => (
                    <tr key={dept.id}>
                      <td className="w-full">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 flex-none place-items-center rounded-[10px] border border-line bg-card-hi text-muted">
                            <Building2 size={16} aria-hidden="true" />
                          </span>
                          <span className="font-medium text-text">{dept.name}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <IconButton icon={Pencil} label="Edit" className="size-8" onClick={() => startEditing(dept)} />
                          <IconButton icon={Trash2} label="Delete" className="size-8 hover:border-absent hover:text-absent" onClick={() => handleDelete(dept.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Building2} title="No departments yet" hint="Create your first department using the form to organize your staff." />
          )}
        </Card>
      </div>

      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Edit department"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </>
        }
      >
        <Field label="Department name" htmlFor="edit-name">
          <Input id="edit-name" type="text" value={editName} onChange={e => setEditName(e.target.value)} data-autofocus />
        </Field>
      </Modal>
    </div>
  )
}
