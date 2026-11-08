'use client'

import { useState, useEffect } from 'react'
import { Plus, IdCard, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardHeader, EmptyState, Field, IconButton, Input, Modal, PageHeader, Skeleton } from '@/components/ui'

type Designation = { id: string, name: string }

export default function DesignationsPage() {
  const [items, setItems] = useState<Designation[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const startEditing = (desig: Designation) => {
    setEditingId(desig.id)
    setEditName(desig.name)
  }

  const saveEdit = async () => {
    if (!editName.trim()) return
    const res = await fetch('/api/designations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, name: editName.trim() })
    })
    const data = await res.json().catch(() => null)
    if (res.ok) {
      setEditingId(null)
      fetchData()
      toast.success('Designation updated')
    } else {
      toast.error(data?.error || 'Failed to update designation')
    }
  }

  const fetchData = async () => {
    const res = await fetch('/api/designations')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const res = await fetch('/api/designations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() })
    })
    const data = await res.json().catch(() => null)
    if (res.ok) {
      setName('')
      fetchData()
      toast.success('Designation created')
    } else {
      toast.error(data?.error || 'Failed to create designation')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this designation?')) return
    const res = await fetch(`/api/designations?id=${id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => null)
    if (res.ok) {
      fetchData()
      toast.success('Designation deleted')
    } else {
      toast.error(data?.error || 'Failed to delete designation')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Designations" subtitle="Manage job titles and professional roles" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-1 self-start">
          <CardHeader title="Add designation" />
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Designation name" htmlFor="new-name">
              <Input id="new-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Senior Developer" required />
            </Field>
            <Button type="submit" icon={Plus} className="w-full">Create Designation</Button>
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
                  {items.map(desig => (
                    <tr key={desig.id}>
                      <td className="w-full">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 flex-none place-items-center rounded-[10px] border border-line bg-card-hi text-muted">
                            <IdCard size={16} aria-hidden="true" />
                          </span>
                          <span className="font-medium text-text">{desig.name}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <IconButton icon={Pencil} label="Edit" className="size-8" onClick={() => startEditing(desig)} />
                          <IconButton icon={Trash2} label="Delete" className="size-8 hover:border-absent hover:text-absent" onClick={() => handleDelete(desig.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={IdCard} title="No designations yet" hint="Create your first designation using the form to assign roles to staff." />
          )}
        </Card>
      </div>

      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Edit designation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </>
        }
      >
        <Field label="Designation name" htmlFor="edit-name">
          <Input id="edit-name" type="text" value={editName} onChange={e => setEditName(e.target.value)} data-autofocus />
        </Field>
      </Modal>
    </div>
  )
}
