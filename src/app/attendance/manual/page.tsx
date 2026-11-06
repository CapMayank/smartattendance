'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Clock, Users, Calendar, Check, Search, X } from 'lucide-react'

type Staff = {
  id: string
  name: string
  machineId: string
}

export default function ManualPunchPage() {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single')
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Single Punch State
  const [singleStaffId, setSingleStaffId] = useState('')
  const [singleDate, setSingleDate] = useState('')
  const [singleTime, setSingleTime] = useState('')
  const [singleType, setSingleType] = useState<'IN' | 'OUT'>('IN')

  // Bulk Punch State
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set())
  const [bulkStartDate, setBulkStartDate] = useState('')
  const [bulkEndDate, setBulkEndDate] = useState('')
  const [bulkTime, setBulkTime] = useState('')
  const [bulkType, setBulkType] = useState<'IN' | 'OUT'>('IN')

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/staff')
      if (!res.ok) throw new Error('Failed to fetch staff')
      const data = await res.json()
      setStaffList(data)
    } catch (error) {
      console.error(error)
      toast.error('Could not load staff members')
    }
  }

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!singleStaffId || !singleDate || !singleTime) {
      toast.error('Please fill in all fields')
      return
    }

    setIsLoading(true)
    try {
      // Create full ISO timestamp
      const timestamp = new Date(`${singleDate}T${singleTime}`).toISOString()
      
      const res = await fetch('/api/punches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: singleStaffId,
          timestamp,
          type: singleType
        })
      })

      if (!res.ok) throw new Error('Failed to create punch')
      
      toast.success('Manual punch added successfully')
      // Reset form
      setSingleStaffId('')
      setSingleDate('')
      setSingleTime('')
    } catch (error) {
      console.error(error)
      toast.error('Error adding punch')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedStaffIds.size === 0 || !bulkStartDate || !bulkEndDate || !bulkTime) {
      toast.error('Please fill in all fields and select at least one staff member')
      return
    }

    if (new Date(bulkStartDate) > new Date(bulkEndDate)) {
      toast.error('Start date must be before end date')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/punches/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffIds: Array.from(selectedStaffIds),
          startDate: bulkStartDate,
          endDate: bulkEndDate,
          time: bulkTime,
          type: bulkType
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create bulk punches')
      }
      
      const data = await res.json()
      toast.success(`Successfully created ${data.createdCount} punches`)
      
      // Reset form
      setSelectedStaffIds(new Set())
      setBulkStartDate('')
      setBulkEndDate('')
      setBulkTime('')
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Error adding bulk punches')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredStaff = staffList.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.machineId.includes(search)
  )

  const toggleStaffSelection = (id: string) => {
    const newSelected = new Set(selectedStaffIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedStaffIds(newSelected)
  }

  const selectAllStaff = () => {
    if (selectedStaffIds.size === filteredStaff.length) {
      setSelectedStaffIds(new Set())
    } else {
      setSelectedStaffIds(new Set(filteredStaff.map(s => s.id)))
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pt-24 min-h-screen text-slate-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Manual Punch
          </h1>
          <p className="text-slate-400 mt-2">Add missing punches for staff members</p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-1 overflow-hidden">
        <div className="flex bg-black/20 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('single')}
            className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'single'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Single Punch
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'bulk'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Bulk Punch
          </button>
        </div>
      </div>

      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
        {activeTab === 'single' ? (
          <form onSubmit={handleSingleSubmit} className="max-w-xl mx-auto space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Staff Member</label>
                <select
                  value={singleStaffId}
                  onChange={(e) => setSingleStaffId(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                >
                  <option value="">Select a staff member</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      [{staff.machineId}] {staff.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={singleDate}
                      onChange={(e) => setSingleDate(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Time</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="time"
                      value={singleTime}
                      onChange={(e) => setSingleTime(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Punch Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSingleType('IN')}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      singleType === 'IN' 
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                        : 'bg-black/50 border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    IN
                  </button>
                  <button
                    type="button"
                    onClick={() => setSingleType('OUT')}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      singleType === 'OUT' 
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' 
                        : 'bg-black/50 border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    OUT
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Add Punch'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleBulkSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-300">Select Staff Members</label>
                <button
                  type="button"
                  onClick={selectAllStaff}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  {selectedStaffIds.size === filteredStaff.length && filteredStaff.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div className="bg-black/50 border border-white/10 rounded-xl h-72 overflow-y-auto custom-scrollbar p-2">
                {filteredStaff.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                    No staff found
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredStaff.map((staff) => (
                      <div
                        key={staff.id}
                        onClick={() => toggleStaffSelection(staff.id)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          selectedStaffIds.has(staff.id) ? 'bg-blue-500/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                          selectedStaffIds.has(staff.id) ? 'bg-blue-500 border-blue-500' : 'border-white/20'
                        }`}>
                          {selectedStaffIds.has(staff.id) && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-sm font-medium">[{staff.machineId}] {staff.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-sm text-slate-400 text-right">
                {selectedStaffIds.size} selected
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={bulkStartDate}
                      onChange={(e) => setBulkStartDate(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={bulkEndDate}
                      onChange={(e) => setBulkEndDate(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Time</label>
                <div className="relative max-w-[50%]">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="time"
                    value={bulkTime}
                    onChange={(e) => setBulkTime(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Punch Type</label>
                <div className="grid grid-cols-2 gap-3 max-w-[50%]">
                  <button
                    type="button"
                    onClick={() => setBulkType('IN')}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      bulkType === 'IN' 
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                        : 'bg-black/50 border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    IN
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkType('OUT')}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      bulkType === 'OUT' 
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' 
                        : 'bg-black/50 border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    OUT
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Saving Bulk Punches...' : 'Add Bulk Punches'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
