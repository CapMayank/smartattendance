'use client'

import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, Trash2, Plus, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Card, Field, IconButton, Input, Modal, PageHeader } from '@/components/ui'
import { cn } from '@/lib/cn'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns'

type Holiday = {
  id: string
  name: string
  date: string
}

export default function CalendarPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [newHolidayName, setNewHolidayName] = useState('')
  const [message, setMessage] = useState('')

  const fetchHolidays = async (start: Date, end: Date) => {
    setLoading(true)
    try {
      const startStr = format(start, 'yyyy-MM-dd')
      const endStr = format(end, 'yyyy-MM-dd')
      const res = await fetch(`/api/holidays?startDate=${startStr}&endDate=${endStr}`)
      if (res.ok) {
        setHolidays(await res.json())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const gridStart = startOfWeek(monthStart)
    const gridEnd = endOfWeek(monthEnd)
    
    fetchHolidays(gridStart, gridEnd)
  }, [currentMonth])

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const goToToday = () => setCurrentMonth(new Date())

  const handleDayClick = (day: Date) => {
    // Check if it's already a holiday
    const existingHoliday = holidays.find(h => isSameDay(new Date(h.date), day))
    if (existingHoliday) {
      if (confirm(`Do you want to delete the holiday: ${existingHoliday.name}?`)) {
        handleDelete(existingHoliday.id)
      }
      return
    }

    setSelectedDate(day)
    setNewHolidayName('')
    setIsModalOpen(true)
    setMessage('')
  }

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    
    if (!newHolidayName || !selectedDate) return

    try {
      // Need to format date properly for API to interpret in local time correctly, or just send YYYY-MM-DD
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHolidayName, date: dateStr })
      })

      if (res.ok) {
        setNewHolidayName('')
        setIsModalOpen(false)
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(monthStart)
        fetchHolidays(startOfWeek(monthStart), endOfWeek(monthEnd))
      } else {
        setMessage('Failed to add holiday')
      }
    } catch (e) {
      setMessage('Error adding holiday')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/holidays?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(monthStart)
        fetchHolidays(startOfWeek(monthStart), endOfWeek(monthEnd))
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Generate calendar grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)
  
  const dateFormat = "d"
  const days = eachDayOfInterval({
    start: startDate,
    end: endDate
  })
  
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="space-y-5">
      <PageHeader title="Holiday Calendar" subtitle="Manage public holidays and non-working days." />

      <Card className="!p-0">
        {/* Calendar Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <h2 className="flex items-center gap-2 text-[17px] font-medium text-text">
            <CalendarDays size={18} className="text-acc-1" aria-hidden="true" />
            <span className="num">{format(currentMonth, 'MMMM yyyy')}</span>
          </h2>
          <div className="flex items-center gap-2">
            <IconButton icon={ChevronLeft} label="Previous month" className="size-9" onClick={prevMonth} />
            <Button variant="secondary" onClick={goToToday}>Today</Button>
            <IconButton icon={ChevronRight} label="Next month" className="size-9" onClick={nextMonth} />
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-3 sm:p-5">
          <div className="mb-2 grid grid-cols-7 gap-1.5 sm:gap-2.5">
            {weekDays.map(day => (
              <div key={day} className="py-2 text-center text-xs uppercase tracking-wider text-subtle">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
            {days.map((day) => {
              const holiday = holidays.find(h => isSameDay(new Date(h.date), day))
              const isCurrentMonth = isSameMonth(day, monthStart)
              const isTodayDate = isToday(day)

              return (
                <div
                  key={day.toString()}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    'group relative min-h-[72px] cursor-pointer rounded-xl border p-2 transition-colors duration-150 sm:min-h-[104px] sm:p-3',
                    !isCurrentMonth ? 'border-transparent bg-transparent opacity-40' : 'border-line bg-ground hover:border-subtle',
                    holiday && 'border-line bg-card-hi',
                    isTodayDate && 'ring-2 ring-acc-2 ring-offset-0',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span className={cn(
                      'num flex size-7 items-center justify-center rounded-full text-sm',
                      isTodayDate ? 'bg-acc-2 font-medium text-ground' : holiday ? 'text-muted' : 'text-muted',
                    )}>
                      {format(day, dateFormat)}
                    </span>
                    {holiday && (
                      <button
                        aria-label={`Remove holiday ${holiday.name}`}
                        className="rounded-lg p-1 text-subtle opacity-0 transition-colors duration-150 hover:text-absent focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {holiday && (
                    <div className="mt-2">
                      <p className="line-clamp-2 text-xs leading-snug text-muted">
                        {holiday.name}
                      </p>
                    </div>
                  )}

                  {/* Plus Icon On Hover (Empty Day) */}
                  {!holiday && isCurrentMonth && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <div className="rounded-full border border-line bg-card-hi p-2 text-muted">
                        <Plus size={16} aria-hidden="true" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Add Holiday Modal */}
      <Modal
        open={isModalOpen && !!selectedDate}
        onClose={() => setIsModalOpen(false)}
        title="Mark Holiday"
      >
        {selectedDate && (
          <>
            {message && (
              <p role="alert" className="mb-4 rounded-[10px] border border-absent/30 bg-absent/10 px-3 py-2 text-sm text-absent">
                {message}
              </p>
            )}

            <div className="mb-4 flex items-center gap-3 rounded-[10px] border border-line bg-card-hi px-3 py-3 text-muted">
              <CalendarIcon size={18} aria-hidden="true" />
              <span className="num text-sm font-medium">{format(selectedDate, 'EEEE, MMMM do, yyyy')}</span>
            </div>

            <form onSubmit={handleAddHoliday} className="space-y-4">
              <Field label="Holiday name" htmlFor="holiday-name">
                <Input
                  id="holiday-name"
                  type="text"
                  required
                  data-autofocus
                  placeholder="e.g. Independence Day"
                  value={newHolidayName}
                  onChange={e => setNewHolidayName(e.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" icon={Plus}>Save Holiday</Button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </div>
  )
}
