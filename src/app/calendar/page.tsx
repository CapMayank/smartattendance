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
    <div className="p-6 max-w-6xl mx-auto min-h-screen pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl border border-white/5 shadow-lg shadow-indigo-500/10">
            <CalendarDays className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Holiday Calendar
            </h1>
            <p className="text-slate-400 mt-1 font-medium">Manage public holidays and non-working days.</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        {/* Calendar Header */}
        <div className="bg-slate-800/30 px-8 py-6 border-b border-white/10 flex items-center justify-between relative z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-white/10 shadow-inner">
            <button 
              onClick={prevMonth}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={goToToday}
              className="px-4 py-2 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all uppercase tracking-wider"
            >
              Today
            </button>
            <button 
              onClick={nextMonth}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-4 sm:p-8 relative z-10">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 mb-4">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest py-2 bg-slate-950/30 rounded-lg border border-white/5">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2 sm:gap-4">
            {days.map((day, i) => {
              const holiday = holidays.find(h => isSameDay(new Date(h.date), day))
              const isCurrentMonth = isSameMonth(day, monthStart)
              const isTodayDate = isToday(day)
              
              return (
                <div 
                  key={day.toString()} 
                  onClick={() => handleDayClick(day)}
                  className={`
                    min-h-[100px] sm:min-h-[120px] p-3 rounded-2xl transition-all cursor-pointer relative group border shadow-sm
                    ${!isCurrentMonth ? 'opacity-40 bg-transparent border-transparent' : 'bg-slate-950/50 border-white/10 hover:border-indigo-500/50 hover:shadow-indigo-500/20 hover:-translate-y-0.5'}
                    ${holiday ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/40 ring-1 ring-inset ring-indigo-500/30' : ''}
                    ${isTodayDate && !holiday ? 'border-emerald-500/50 bg-emerald-500/10 shadow-emerald-500/10' : ''}
                  `}
                >
                  <div className="flex justify-between items-start">
                    <span className={`
                      text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full transition-colors
                      ${isTodayDate ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : holiday ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-300 group-hover:bg-white/10'}
                    `}>
                      {format(day, dateFormat)}
                    </span>
                    {holiday && (
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-rose-500/20 rounded-lg text-rose-400 hover:text-rose-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {holiday && (
                    <div className="mt-3">
                      <p className="text-xs font-bold text-indigo-300 leading-snug line-clamp-2">
                        {holiday.name}
                      </p>
                    </div>
                  )}
                  
                  {/* Plus Icon On Hover (Empty Day) */}
                  {!holiday && isCurrentMonth && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                      <div className="bg-indigo-500/20 text-indigo-400 p-2.5 rounded-full shadow-lg shadow-indigo-500/20 border border-indigo-500/30 transform scale-75 group-hover:scale-100 transition-transform">
                        <Plus className="w-5 h-5" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modern Add Holiday Modal */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-slate-800/30">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-400" /> Mark Holiday
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {message && (
                <div className="mb-6 p-4 rounded-xl text-sm font-bold flex items-center justify-center bg-red-500/20 text-red-400 border border-red-500/20 shadow-lg shadow-red-500/10">
                  {message}
                </div>
              )}
              
              <div className="mb-6 flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 shadow-inner">
                <CalendarIcon className="w-6 h-6" />
                <span className="font-bold text-lg">{format(selectedDate, 'EEEE, MMMM do, yyyy')}</span>
              </div>
              
              <form onSubmit={handleAddHoliday} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Holiday Name</label>
                  <input 
                    type="text" 
                    required
                    autoFocus
                    placeholder="e.g. Independence Day"
                    value={newHolidayName}
                    onChange={e => setNewHolidayName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3.5 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
                  />
                </div>
                <div className="flex gap-3 pt-2 border-t border-white/10 mt-6 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors border border-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
                  >
                    <Plus className="w-5 h-5" /> Save Holiday
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
