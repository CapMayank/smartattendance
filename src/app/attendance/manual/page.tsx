'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Clock, Calendar, Check, Search } from 'lucide-react'
import { Button, Card, Chip, ChipGroup, Field, Input, PageHeader, Select, Tabs } from '@/components/ui'
import { cn } from '@/lib/cn'

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
    <div className="space-y-5">
      <PageHeader title="Manual Punch" subtitle="Add missing punches for staff members" />

      <Tabs
        tabs={[
          { id: 'single', label: 'Single Punch' },
          { id: 'bulk', label: 'Bulk Punch' },
        ]}
        value={activeTab}
        onChange={(id) => setActiveTab(id as 'single' | 'bulk')}
      />

      <Card>
        {activeTab === 'single' ? (
          <form onSubmit={handleSingleSubmit} className="mx-auto max-w-xl space-y-5">
            <Field label="Staff member" htmlFor="single-staff">
              <Select
                id="single-staff"
                value={singleStaffId}
                onChange={(e) => setSingleStaffId(e.target.value)}
                required
              >
                <option value="">Select a staff member</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    [{staff.machineId}] {staff.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Date" htmlFor="single-date">
                <div className="relative">
                  <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
                  <Input
                    id="single-date"
                    type="date"
                    className="num pl-10"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    required
                  />
                </div>
              </Field>
              <Field label="Time" htmlFor="single-time">
                <div className="relative">
                  <Clock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
                  <Input
                    id="single-time"
                    type="time"
                    className="num pl-10"
                    value={singleTime}
                    onChange={(e) => setSingleTime(e.target.value)}
                    required
                  />
                </div>
              </Field>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] text-muted">Punch type</span>
              <ChipGroup label="Punch type">
                <Chip pressed={singleType === 'IN'} dot="present" onClick={() => setSingleType('IN')}>IN</Chip>
                <Chip pressed={singleType === 'OUT'} dot="absent" onClick={() => setSingleType('OUT')}>OUT</Chip>
              </ChipGroup>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Saving...' : 'Add Punch'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleBulkSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-muted">Select staff members</span>
                <button
                  type="button"
                  onClick={selectAllStaff}
                  className="rounded text-xs text-acc-1 transition-colors duration-150 hover:text-text"
                >
                  {selectedStaffIds.size === filteredStaff.length && filteredStaff.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
                <Input
                  type="text"
                  aria-label="Search staff"
                  placeholder="Search staff..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="h-72 overflow-y-auto rounded-[10px] border border-line bg-ground p-2">
                {filteredStaff.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-subtle">
                    No staff found
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredStaff.map((staff) => (
                      <div
                        key={staff.id}
                        onClick={() => toggleStaffSelection(staff.id)}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-colors duration-150',
                          selectedStaffIds.has(staff.id) ? 'bg-card-hi' : 'hover:bg-card',
                        )}
                      >
                        <div className={cn(
                          'flex size-5 items-center justify-center rounded border',
                          selectedStaffIds.has(staff.id) ? 'border-acc-2 bg-acc-2' : 'border-line',
                        )}>
                          {selectedStaffIds.has(staff.id) && <Check size={12} className="text-ground" aria-hidden="true" />}
                        </div>
                        <span className="text-sm text-text"><span className="num">[{staff.machineId}]</span> {staff.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="num text-right text-sm text-muted">
                {selectedStaffIds.size} selected
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Start date" htmlFor="bulk-start">
                  <div className="relative">
                    <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
                    <Input
                      id="bulk-start"
                      type="date"
                      className="num pl-10"
                      value={bulkStartDate}
                      onChange={(e) => setBulkStartDate(e.target.value)}
                      required
                    />
                  </div>
                </Field>
                <Field label="End date" htmlFor="bulk-end">
                  <div className="relative">
                    <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
                    <Input
                      id="bulk-end"
                      type="date"
                      className="num pl-10"
                      value={bulkEndDate}
                      onChange={(e) => setBulkEndDate(e.target.value)}
                      required
                    />
                  </div>
                </Field>
              </div>

              <div className="min-w-40 max-w-[50%]">
                <Field label="Time" htmlFor="bulk-time">
                  <div className="relative">
                    <Clock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
                    <Input
                      id="bulk-time"
                      type="time"
                      className="num pl-10"
                      value={bulkTime}
                      onChange={(e) => setBulkTime(e.target.value)}
                      required
                    />
                  </div>
                </Field>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[12.5px] text-muted">Punch type</span>
                <ChipGroup label="Punch type">
                  <Chip pressed={bulkType === 'IN'} dot="present" onClick={() => setBulkType('IN')}>IN</Chip>
                  <Chip pressed={bulkType === 'OUT'} dot="absent" onClick={() => setBulkType('OUT')}>OUT</Chip>
                </ChipGroup>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? 'Saving Bulk Punches...' : 'Add Bulk Punches'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
