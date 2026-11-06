'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Clock, Pencil } from 'lucide-react'
import { Button, Card, CardHeader, EmptyState, Field, IconButton, Input, Modal, PageHeader, Skeleton } from '@/components/ui'

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
    <div className="space-y-5">
      <PageHeader title="Shifts" subtitle="Configure work schedules and timeframes" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-1 self-start">
          <CardHeader title="Add shift" />
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Shift name" htmlFor="new-name">
              <Input id="new-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Shift" required />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Start time" htmlFor="new-start">
                <Input id="new-start" type="time" className="num" value={startTime} onChange={e => setStartTime(e.target.value)} required />
              </Field>
              <Field label="End time" htmlFor="new-end">
                <Input id="new-end" type="time" className="num" value={endTime} onChange={e => setEndTime(e.target.value)} required />
              </Field>
            </div>

            <Button type="submit" icon={Plus} className="w-full">Create Shift</Button>
          </form>
        </Card>

        <Card className="overflow-hidden !p-0 md:col-span-2">
          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : shifts.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Shift</th>
                    <th>Start</th>
                    <th>End</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map(shift => (
                    <tr key={shift.id}>
                      <td className="w-full">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 flex-none place-items-center rounded-[10px] border border-line bg-card-hi text-muted">
                            <Clock size={16} aria-hidden="true" />
                          </span>
                          <span className="font-medium text-text">{shift.name}</span>
                        </div>
                      </td>
                      <td className="num text-muted">{shift.startTime}</td>
                      <td className="num text-muted">{shift.endTime}</td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <IconButton icon={Pencil} label="Edit" className="size-8" onClick={() => startEditing(shift)} />
                          <IconButton icon={Trash2} label="Delete" className="size-8 hover:border-absent hover:text-absent" onClick={() => handleDelete(shift.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Clock} title="No shifts yet" hint="Create your first shift using the form to define work schedules." />
          )}
        </Card>
      </div>

      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Edit shift"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Shift name" htmlFor="edit-name">
            <Input id="edit-name" type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} data-autofocus />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start time" htmlFor="edit-start">
              <Input id="edit-start" type="time" className="num" value={editData.startTime} onChange={e => setEditData({...editData, startTime: e.target.value})} />
            </Field>
            <Field label="End time" htmlFor="edit-end">
              <Input id="edit-end" type="time" className="num" value={editData.endTime} onChange={e => setEditData({...editData, endTime: e.target.value})} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
