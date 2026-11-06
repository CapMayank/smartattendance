'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, Button, Card, CardHeader, EmptyState, Field, IconButton, Input, Modal, PageHeader, Select, Skeleton } from '@/components/ui'
import { Plus, Users, Upload, Download, FileSpreadsheet, Trash2, Pencil, Calendar } from 'lucide-react'
import Papa from 'papaparse'
import { toast } from 'sonner'

type Staff = {
  id: string
  machineId: string
  name: string
  department?: { name: string }
  designation?: { name: string }
  shift?: { name: string, startTime: string, endTime: string }
}

export default function StaffPage() {
  const router = useRouter()
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [depts, setDepts] = useState<{id:string, name:string}[]>([])
  const [desigs, setDesigs] = useState<{id:string, name:string}[]>([])
  const [shifts, setShifts] = useState<{id:string, name:string}[]>([])

  const [formData, setFormData] = useState({
    name: '', machineId: '', departmentId: '', designationId: '', shiftId: ''
  })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', machineId: '', departmentId: '', designationId: '', shiftId: '' })

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const startEditing = (staff: Staff) => {
    setEditingId(staff.id)
    setEditData({
      name: staff.name,
      machineId: staff.machineId,
      departmentId: staff.department?.name ? depts.find(d => d.name === staff.department?.name)?.id || '' : '',
      designationId: staff.designation?.name ? desigs.find(d => d.name === staff.designation?.name)?.id || '' : '',
      shiftId: staff.shift?.name ? shifts.find(s => s.name === staff.shift?.name)?.id || '' : ''
    })
  }

  const saveEdit = async () => {
    const res = await fetch('/api/staff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, ...editData })
    })
    if (res.ok) {
      setEditingId(null)
      fetchData()
      toast.success("Staff member updated successfully")
    } else {
      toast.error("Failed to update staff member")
    }
  }

  const fetchData = async () => {
    const [sRes, dRes, desRes, shRes] = await Promise.all([
      fetch('/api/staff'), fetch('/api/departments'), fetch('/api/designations'), fetch('/api/shifts')
    ])
    if (sRes.ok) setStaffList(await sRes.json())
    if (dRes.ok) setDepts(await dRes.json())
    if (desRes.ok) setDesigs(await desRes.json())
    if (shRes.ok) setShifts(await shRes.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.machineId) return

    const payload = {
      name: formData.name,
      machineId: formData.machineId,
      departmentId: formData.departmentId || null,
      designationId: formData.designationId || null,
      shiftId: formData.shiftId || null,
    }

    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (res.ok) {
      setFormData({ name: '', machineId: '', departmentId: '', designationId: '', shiftId: '' })
      fetchData()
      toast.success("Staff member added successfully")
    } else {
      toast.error("Failed to add staff member")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return
    const res = await fetch(`/api/staff?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchData()
      toast.success("Staff member deleted")
    } else {
      toast.error("Failed to delete staff member")
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} staff members?`)) return
    const res = await fetch('/api/staff/bulk', { 
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds })
    })
    if (res.ok) {
      setSelectedIds([])
      fetchData()
      toast.success(`${selectedIds.length} staff members deleted`)
    } else {
      toast.error("Failed to delete staff members")
    }
  }

  const handleBulkAssignShift = async (shiftId: string) => {
    if (!shiftId) return
    const res = await fetch('/api/staff/bulk', { 
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds, shiftId })
    })
    if (res.ok) {
      setSelectedIds([])
      fetchData()
      toast.success(`${selectedIds.length} staff members assigned to new shift`)
    } else {
      toast.error("Failed to assign shift")
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === staffList.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(staffList.map(s => s.id))
    }
  }

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Name,Machine ID,Department,Designation,Shift\nJohn Doe,1001,Engineering,Developer,General Shift\nJane Smith,1002,HR,Manager,General Shift"
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "staff_template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await fetch('/api/staff/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: results.data })
          })
          if (res.ok) {
            const data = await res.json()
            toast.success(`Successfully imported ${data.processedCount} staff members!`)
            fetchData()
          } else {
            toast.error('Failed to import data. Please check the format.')
          }
        } catch (error) {
          toast.error('An error occurred during import.')
        } finally {
          setUploading(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      },
      error: () => {
        toast.error('Failed to parse CSV file.')
        setUploading(false)
      }
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Staff" subtitle="Manage staff details, machine IDs, and shifts" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Add new staff" />
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="new-name">
                <Input id="new-name" type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. John Doe" required />
              </Field>
              <Field label="Machine ID" htmlFor="new-machine">
                <Input id="new-machine" type="text" value={formData.machineId} onChange={e => setFormData({...formData, machineId: e.target.value})} placeholder="e.g. 101" required />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Department" htmlFor="new-dept">
                <Select id="new-dept" value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: e.target.value})}>
                  <option value="">No Dept...</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Designation" htmlFor="new-desig">
                <Select id="new-desig" value={formData.designationId} onChange={e => setFormData({...formData, designationId: e.target.value})}>
                  <option value="">No Role...</option>
                  {desigs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Shift" htmlFor="new-shift">
                <Select id="new-shift" value={formData.shiftId} onChange={e => setFormData({...formData, shiftId: e.target.value})}>
                  <option value="">No Shift...</option>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
            </div>

            <Button type="submit" icon={Plus} className="w-full">Add Staff Member</Button>
          </form>
        </Card>

        <Card className="flex flex-col justify-center gap-5">
          <div className="flex items-center gap-4">
            <span className="grid size-11 flex-none place-items-center rounded-xl border border-line bg-card-hi text-muted">
              <FileSpreadsheet size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[15px] font-medium text-text">Bulk master sheet upload</h2>
              <p className="mt-0.5 text-[13px] text-subtle">Import multiple staff members instantly via CSV format.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button variant="secondary" icon={Download} onClick={downloadTemplate}>Download Template</Button>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-line px-4 text-[13.5px] font-medium text-muted transition-colors duration-150 hover:border-subtle hover:text-text has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-acc-2 has-disabled:cursor-not-allowed has-disabled:opacity-50">
              <Upload size={16} aria-hidden="true" /> {uploading ? 'Uploading...' : 'Upload CSV File'}
              <input
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={handleFileUpload}
                ref={fileInputRef}
                disabled={uploading}
              />
            </label>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden !p-0">
        {selectedIds.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-b border-line-soft bg-card-hi px-5 py-3 sm:flex-row">
            <span className="num shrink-0 text-[13px] text-text">
              {selectedIds.length} staff selected
            </span>
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
              <Select
                aria-label="Bulk assign shift"
                onChange={(e) => handleBulkAssignShift(e.target.value)}
                value=""
                className="w-full sm:w-auto"
              >
                <option value="" disabled>Bulk Assign Shift...</option>
                {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>

              <Button variant="danger" icon={Trash2} onClick={handleBulkDelete} className="w-full sm:w-auto">
                Bulk Delete
              </Button>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    aria-label="Select all staff"
                    className="size-4 cursor-pointer accent-acc-2"
                    checked={staffList.length > 0 && selectedIds.length === staffList.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Staff name</th>
                <th>Machine ID</th>
                <th>Department / Role</th>
                <th>Shift</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton className="size-4" /></td>
                      <td>
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-[38px] rounded-xl" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </td>
                      <td><Skeleton className="h-4 w-16" /></td>
                      <td><Skeleton className="h-4 w-28" /></td>
                      <td><Skeleton className="h-4 w-24" /></td>
                      <td><Skeleton className="ml-auto h-8 w-24" /></td>
                    </tr>
                  ))}
                </>
              ) : staffList.length > 0 ? (
                staffList.map((staff) => (
                  <tr key={staff.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${staff.name}`}
                        className="size-4 cursor-pointer accent-acc-2"
                        checked={selectedIds.includes(staff.id)}
                        onChange={() => toggleSelect(staff.id)}
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={staff.name} />
                        <span className="font-medium text-text">{staff.name}</span>
                      </div>
                    </td>
                    <td className="num text-muted">{staff.machineId}</td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-text">{staff.department?.name || <span className="text-subtle">No Dept</span>}</span>
                        <span className="text-xs text-subtle">{staff.designation?.name || 'Unassigned Role'}</span>
                      </div>
                    </td>
                    <td>
                      {staff.shift ? (
                        <span className="text-muted">{staff.shift.name}</span>
                      ) : (
                        <span className="text-subtle">-</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <IconButton icon={Calendar} label="View Attendance" className="size-8" onClick={() => router.push(`/reports/member-attendance?staffId=${staff.id}`)} />
                        <IconButton icon={Pencil} label="Edit Staff" className="size-8" onClick={() => startEditing(staff)} />
                        <IconButton icon={Trash2} label="Delete Staff" className="size-8 hover:border-absent hover:text-absent" onClick={() => handleDelete(staff.id)} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={Users} title="No staff found" hint="Add your first staff member using the form above or import them via CSV." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Edit staff member"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name" htmlFor="edit-name">
            <Input id="edit-name" type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
          </Field>
          <Field label="Machine ID" htmlFor="edit-machine">
            <Input id="edit-machine" type="text" value={editData.machineId} onChange={e => setEditData({...editData, machineId: e.target.value})} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Department" htmlFor="edit-dept">
              <Select id="edit-dept" value={editData.departmentId} onChange={e => setEditData({...editData, departmentId: e.target.value})}>
                <option value="">No Dept</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Designation" htmlFor="edit-desig">
              <Select id="edit-desig" value={editData.designationId} onChange={e => setEditData({...editData, designationId: e.target.value})}>
                <option value="">No Role</option>
                {desigs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Assigned shift" htmlFor="edit-shift">
            <Select id="edit-shift" value={editData.shiftId} onChange={e => setEditData({...editData, shiftId: e.target.value})}>
              <option value="">No Shift</option>
              {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
