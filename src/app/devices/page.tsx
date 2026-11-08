'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Server, Trash2, Pencil, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardHeader, EmptyState, Field, IconButton, Input, Modal, PageHeader, Skeleton, StatusBadge } from '@/components/ui'
import { isDeviceOnline } from '@/lib/dashboard-calc'
import { formatDateLong, formatPing } from '@/lib/format'

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

  const loadDevices = useCallback(async () => {
    const res = await fetch('/api/devices')
    if (res.ok) return (await res.json()) as Device[]
    return null
  }, [])

  const fetchDevices = useCallback(async () => {
    const rows = await loadDevices()
    if (rows) setDevices(rows)
    setLoading(false)
  }, [loadDevices])

  useEffect(() => {
    let active = true
    loadDevices().then((rows) => {
      if (!active) return
      if (rows) setDevices(rows)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [loadDevices])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
    const data = await res.json().catch(() => null)
    if (res.ok) {
      setFormData({ name: '', ipAddress: '', port: '' })
      fetchDevices()
      toast.success('Device registered')
    } else {
      toast.error(data?.error || 'Failed to register device')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this device configuration?')) return
    const res = await fetch(`/api/devices?id=${id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => null)
    if (res.ok) {
      fetchDevices()
      toast.success('Device deleted')
    } else {
      toast.error(data?.error || 'Failed to delete device')
    }
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
    const data = await res.json().catch(() => null)
    if (res.ok) {
      setEditingId(null)
      fetchDevices()
      toast.success('Device updated')
    } else {
      toast.error(data?.error || 'Failed to update device')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Devices"
        subtitle="Configure and monitor biometric devices"
        actions={<Button variant="secondary" icon={RefreshCw} onClick={fetchDevices}>Refresh Status</Button>}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="self-start lg:col-span-1">
          <CardHeader title="Register device" />
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Device name" htmlFor="new-name">
              <Input id="new-name" type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Front Door D01" required />
            </Field>
            <Field label="IP address (optional)" htmlFor="new-ip">
              <Input id="new-ip" type="text" className="num" value={formData.ipAddress} onChange={e => setFormData({...formData, ipAddress: e.target.value})} placeholder="e.g. 192.168.1.100" />
            </Field>
            <Field label="Port (optional)" htmlFor="new-port">
              <Input id="new-port" type="text" className="num" value={formData.port} onChange={e => setFormData({...formData, port: e.target.value})} placeholder="e.g. 4370" />
            </Field>
            <Button type="submit" icon={Plus} className="w-full">Add Device</Button>
          </form>
        </Card>

        <Card className="overflow-hidden !p-0 lg:col-span-2">
          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : devices.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Network</th>
                    <th>Status</th>
                    <th>Last ping</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => {
                    const lastPing = new Date(device.lastPing)
                    const isOnline = isDeviceOnline(lastPing, new Date())

                    return (
                      <tr key={device.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 flex-none place-items-center rounded-[10px] border border-line bg-card-hi text-muted">
                              <Server size={16} aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-text">{device.name}</p>
                              <p className="num text-xs text-subtle">ID: {device.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="num text-muted">
                          {device.ipAddress ? `${device.ipAddress}${device.port ? `:${device.port}` : ''}` : <span className="font-sans text-subtle">No IP</span>}
                        </td>
                        <td><StatusBadge status={isOnline ? 'online' : 'offline'} /></td>
                        <td className="num text-muted" title={formatDateLong(lastPing)}>{formatPing(lastPing, new Date())}</td>
                        <td>
                          <div className="flex items-center justify-end gap-2">
                            <IconButton icon={Pencil} label="Edit device" className="size-8" onClick={() => startEditing(device)} />
                            <IconButton icon={Trash2} label="Delete device" className="size-8 hover:border-absent hover:text-absent" onClick={() => handleDelete(device.id)} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Server} title="No devices configured" hint="Add your first biometric attendance device." />
          )}
        </Card>
      </div>

      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Edit device"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Device name" htmlFor="edit-name">
            <Input id="edit-name" type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} data-autofocus />
          </Field>
          <Field label="IP address" htmlFor="edit-ip">
            <Input id="edit-ip" type="text" className="num" value={editData.ipAddress} onChange={e => setEditData({...editData, ipAddress: e.target.value})} />
          </Field>
          <Field label="Port" htmlFor="edit-port">
            <Input id="edit-port" type="text" className="num" value={editData.port} onChange={e => setEditData({...editData, port: e.target.value})} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
