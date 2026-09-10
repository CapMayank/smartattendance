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
    <div className="p-6 max-w-7xl mx-auto min-h-screen pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl border border-white/5 shadow-lg shadow-blue-500/10">
            <Users className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Staff Management
            </h1>
            <p className="text-slate-400 mt-1 font-medium">Manage staff details, machine IDs, and shifts</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Create Form Container */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <h2 className="text-xl font-bold text-white mb-6 relative z-10 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" />
            Add New Staff
          </h2>
          
          <form onSubmit={handleCreate} className="relative z-10 flex-grow flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Full Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner" placeholder="e.g. John Doe" required />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Machine ID</label>
                  <input type="text" value={formData.machineId} onChange={e => setFormData({...formData, machineId: e.target.value})} className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner" placeholder="e.g. 101" required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Department</label>
                  <select value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: e.target.value})} className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner appearance-none cursor-pointer">
                    <option value="">No Dept...</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Designation</label>
                  <select value={formData.designationId} onChange={e => setFormData({...formData, designationId: e.target.value})} className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner appearance-none cursor-pointer">
                    <option value="">No Role...</option>
                    {desigs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Shift</label>
                  <select value={formData.shiftId} onChange={e => setFormData({...formData, shiftId: e.target.value})} className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner appearance-none cursor-pointer">
                    <option value="">No Shift...</option>
                    {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <button type="submit" className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5">
              <Plus className="w-5 h-5" /> Add Staff Member
            </button>
          </form>
        </div>

        {/* Bulk Upload Widget */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-center gap-8 h-full">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 relative z-10">
            <div className="p-4 bg-emerald-500/20 rounded-2xl border border-emerald-500/20 shadow-inner shrink-0">
              <FileSpreadsheet className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Bulk Master Sheet Upload</h3>
              <p className="text-slate-400 mt-1 font-medium">Import multiple staff members instantly via CSV format.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
            <button
              onClick={downloadTemplate}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 transition-colors"
            >
              <Download className="w-5 h-5" /> Download Template
            </button>
            <label className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5">
              <Upload className="w-5 h-5" /> {uploading ? 'Uploading...' : 'Upload CSV File'}
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

      {/* Staff List Table */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        
        {/* Bulk Actions Header */}
        {selectedIds.length > 0 && (
          <div className="bg-rose-500/10 px-6 py-4 flex items-center justify-between border-b border-rose-500/20 animate-in slide-in-from-top-2">
            <span className="text-sm text-rose-200 font-bold tracking-wide">
              {selectedIds.length} STAFF SELECTED
            </span>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white hover:bg-rose-400 rounded-xl transition-colors text-sm font-bold shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40"
            >
              <Trash2 className="w-4 h-4" /> Bulk Delete
            </button>
          </div>
        )}

        <div className="overflow-x-auto custom-scrollbar flex-1">
          <table className="w-full text-left text-sm text-slate-400 whitespace-nowrap">
            <thead className="bg-slate-950/80 text-slate-300 text-xs uppercase font-semibold tracking-wider sticky top-0 z-10 backdrop-blur-md border-b border-white/10">
              <tr>
                <th className="px-6 py-5 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="rounded border-white/20 bg-slate-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer w-4 h-4"
                    checked={staffList.length > 0 && selectedIds.length === staffList.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-5">Staff Name</th>
                <th className="px-6 py-5">Machine ID</th>
                <th className="px-6 py-5">Department / Role</th>
                <th className="px-6 py-5">Shift</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                      <p className="text-slate-400 font-medium animate-pulse">Loading staff directory...</p>
                    </div>
                  </td>
                </tr>
              ) : staffList.length > 0 ? (
                staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-white/20 bg-slate-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity"
                        checked={selectedIds.includes(staff.id)}
                        onChange={() => toggleSelect(staff.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-lg border border-white/10 shrink-0">
                          {staff.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-200 text-base">{staff.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/50 border border-white/5 font-medium text-slate-300">
                        <Hash className="w-3 h-3 text-blue-400" />
                        {staff.machineId}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-300 font-medium">{staff.department?.name || <span className="text-slate-600 italic">No Dept</span>}</span>
                        <span className="text-xs text-slate-500 font-semibold">{staff.designation?.name || 'Unassigned Role'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {staff.shift ? (
                        <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-300 rounded-md border border-indigo-500/20 text-xs font-semibold">
                          {staff.shift.name}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-medium">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditing(staff)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 bg-slate-900 border border-white/5 rounded-lg transition-all shadow-sm" title="Edit Staff">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(staff.id)} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 bg-slate-900 border border-white/5 rounded-lg transition-all shadow-sm" title="Delete Staff">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Users className="w-12 h-12 text-slate-600 mb-2" />
                      <p className="text-slate-300 font-semibold text-lg">No Staff Found</p>
                      <p className="text-slate-500 text-sm max-w-sm">Add your first staff member using the form above or import them via CSV.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-slate-800/30">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" /> Edit Staff Member
              </h3>
              <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Full Name</label>
                <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Machine ID</label>
                <input type="text" value={editData.machineId} onChange={e => setEditData({...editData, machineId: e.target.value})} className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Department</label>
                  <select value={editData.departmentId} onChange={e => setEditData({...editData, departmentId: e.target.value})} className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner appearance-none">
                    <option value="">No Dept</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Designation</label>
                  <select value={editData.designationId} onChange={e => setEditData({...editData, designationId: e.target.value})} className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner appearance-none">
                    <option value="">No Role</option>
                    {desigs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Assigned Shift</label>
                <select value={editData.shiftId} onChange={e => setEditData({...editData, shiftId: e.target.value})} className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner appearance-none">
                  <option value="">No Shift</option>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3 bg-slate-800/20">
              <button onClick={() => setEditingId(null)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors border border-white/5">
                Cancel
              </button>
              <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5">
                <Check className="w-5 h-5" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
