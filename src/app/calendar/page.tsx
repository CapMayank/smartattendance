'use client'

import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, Trash2, Plus, CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
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
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-400" />
            Holiday Calendar
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage public holidays by clicking on any date.</p>
        </div>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        
        {/* Calendar Header */}
        <div className="bg-slate-800/30 px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-white/5">
            <button 
              onClick={prevMonth}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-md transition-colors"
            >
              Today
            </button>
            <button 
              onClick={nextMonth}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-semibold text-slate-400 uppercase py-2">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {days.map((day, i) => {
              const holiday = holidays.find(h => isSameDay(new Date(h.date), day))
              const isCurrentMonth = isSameMonth(day, monthStart)
              const isTodayDate = isToday(day)
              
              return (
                <div 
                  key={day.toString()} 
                  onClick={() => handleDayClick(day)}
                  className={`
                    min-h-[80px] sm:min-h-[100px] p-2 rounded-xl transition-all cursor-pointer relative group border
                    ${!isCurrentMonth ? 'opacity-40 bg-transparent border-transparent' : 'bg-slate-950/50 border-white/5 hover:border-blue-500/30'}
                    ${holiday ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-inset ring-blue-500/20' : ''}
                    ${isTodayDate && !holiday ? 'border-indigo-500/50 bg-indigo-500/5' : ''}
                  `}
                >
                  <div className="flex justify-between items-start">
                    <span className={`
                      text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full
                      ${isTodayDate ? 'bg-indigo-500 text-white' : holiday ? 'text-blue-400' : 'text-slate-300'}
                    `}>
                      {format(day, dateFormat)}
                    </span>
                    {holiday && (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3.5 h-3.5 text-rose-400 hover:text-rose-300" />
                      </span>
                    )}
                  </div>
                  
                  {holiday && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-blue-300 leading-tight line-clamp-2">
                        {holiday.name}
                      </p>
                    </div>
                  )}
                  
                  {/* Plus Icon On Hover (Empty Day) */}
                  {!holiday && isCurrentMonth && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-blue-500/20 text-blue-400 p-1.5 rounded-full">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Add Holiday Modal */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-800/50">
              <h3 className="text-lg font-bold text-white">Mark Holiday</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {message && (
                <div className="mb-4 p-3 rounded-lg text-sm bg-red-500/20 text-red-400 border border-red-500/20">
                  {message}
                </div>
              )}
              
              <div className="mb-6 flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                <CalendarIcon className="w-5 h-5" />
                <span className="font-medium">{format(selectedDate, 'EEEE, MMMM do, yyyy')}</span>
              </div>
              
              <form onSubmit={handleAddHoliday} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Holiday Name</label>
                  <input 
                    type="text" 
                    required
                    autoFocus
                    placeholder="e.g. Independence Day"
                    value={newHolidayName}
                    onChange={e => setNewHolidayName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg font-medium"
                  >
                    Save Holiday
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
