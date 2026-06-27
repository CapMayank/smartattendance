'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Users, Hash, Upload, Download, FileSpreadsheet, Trash2, Edit2, Check, X } from 'lucide-react'
import Papa from 'papaparse'

type Staff = {
  id: string
  machineId: string
  name: string
  department?: { name: string }
  designation?: { name: string }
  shift?: { name: string, startTime: string, endTime: string }
}

export default function StaffPage() {
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
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return
    const res = await fetch(`/api/staff?id=${id}`, { method: 'DELETE' })
    if (res.ok) fetchData()
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} staff members?`)) return
    const res = await fetch(`/api/staff?ids=${selectedIds.join(',')}`, { method: 'DELETE' })
    if (res.ok) {
      setSelectedIds([])
      fetchData()
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
            alert(`Successfully imported ${data.processedCount} staff members!`)
            fetchData()
          } else {
            alert('Failed to import data. Please check the format.')
          }
        } catch (error) {
          alert('An error occurred during import.')
        } finally {
          setUploading(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      },
      error: () => {
        alert('Failed to parse CSV file.')
        setUploading(false)
      }
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-white">Staff Management</h1>
        <p className="text-slate-400 text-sm mt-1">Manage staff details and shift assignments.</p>
      </div>

      <div className="space-y-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create Form */}
          <div>
            <form onSubmit={handleCreate} className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 h-full flex flex-col">
              <h2 className="text-lg font-semibold text-white mb-4">Add New Staff</h2>
              
              <div className="space-y-4 flex-grow">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white" required />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Machine ID</label>
                    <input type="text" value={formData.machineId} onChange={e => setFormData({...formData, machineId: e.target.value})} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white" required />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Department</label>
                    <select value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: e.target.value})} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white">
                      <option value="">No Dept...</option>
                      {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Designation</label>
                    <select value={formData.designationId} onChange={e => setFormData({...formData, designationId: e.target.value})} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white">
                      <option value="">No Role...</option>
                      {desigs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Shift</label>
                    <select value={formData.shiftId} onChange={e => setFormData({...formData, shiftId: e.target.value})} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white">
                      <option value="">No Shift...</option>
                      {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors mt-6">
                <Plus className="w-4 h-4" /> Add Staff
              </button>
            </form>
          </div>

          {/* Bulk Upload Widget */}
          <div>
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 h-full flex flex-col justify-center gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-emerald-500/20 rounded-xl">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Bulk Master Sheet Upload</h3>
                  <p className="text-sm text-slate-400 mt-1">Import multiple staff members instantly via CSV.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={downloadTemplate}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors"
                >
                  <Download className="w-5 h-5" /> Download Template
                </button>
                <label className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <Upload className="w-5 h-5" /> {uploading ? 'Uploading...' : 'Upload CSV'}
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Staff List Table */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
          
          {/* Bulk Actions Header */}
          {selectedIds.length > 0 && (
            <div className="bg-white/5 px-6 py-3 flex items-center justify-between border-b border-white/10">
              <span className="text-sm text-slate-300 font-medium">
                {selectedIds.length} selected
              </span>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" /> Bulk Delete
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="bg-white/5 text-slate-300 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4 w-12">
                    <input 
                      type="checkbox" 
                      className="rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                      checked={staffList.length > 0 && selectedIds.length === staffList.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Machine ID</th>
                  <th className="px-6 py-4">Department / Role</th>
                  <th className="px-6 py-4">Shift</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={6} className="p-12 text-center">Loading...</td></tr>
                ) : staffList.length > 0 ? (
                  staffList.map((staff) => {
                    const isEditing = editingId === staff.id;
                    return (
                    <tr key={staff.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          className="rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                          checked={selectedIds.includes(staff.id)}
                          onChange={() => toggleSelect(staff.id)}
                        />
                      </td>
                      <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-xs text-white shadow-lg shrink-0">
                          {staff.name.substring(0, 2).toUpperCase()}
                        </div>
                        {isEditing ? (
                          <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-sm" />
                        ) : staff.name}
                      </td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input type="text" value={editData.machineId} onChange={e => setEditData({...editData, machineId: e.target.value})} className="w-24 bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-sm" />
                        ) : (
                          <span className="flex items-center gap-1.5"><Hash className="w-3 h-3 text-slate-500"/>{staff.machineId}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <select value={editData.departmentId} onChange={e => setEditData({...editData, departmentId: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-xs">
                              <option value="">No Dept</option>
                              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <select value={editData.designationId} onChange={e => setEditData({...editData, designationId: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-xs">
                              <option value="">No Role</option>
                              {desigs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-slate-300">{staff.department?.name || '-'}</span>
                            <span className="text-xs text-slate-500">{staff.designation?.name || '-'}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <select value={editData.shiftId} onChange={e => setEditData({...editData, shiftId: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-xs">
                            <option value="">No Shift</option>
                            {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        ) : staff.shift ? (
                          <span className="px-2 py-1 bg-white/5 rounded-md border border-white/10 text-xs">
                            {staff.shift.name}
                          </span>
                        ) : <span className="text-slate-600">-</span>}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/40 transition-colors"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-rose-500/20 text-rose-400 rounded hover:bg-rose-500/40 transition-colors"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEditing(staff)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors" title="Edit Staff"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(staff.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors" title="Delete Staff"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </td>
                    </tr>
                    )
                  })
                ) : (
                  <tr><td colSpan={6} className="p-12 text-center">No staff found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
