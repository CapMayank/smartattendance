'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import {
  Calendar as CalendarIcon,
  Trash2,
  Plus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CalendarCheck2,
  CalendarRange,
  Building,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  isSunday,
  differenceInCalendarDays,
} from 'date-fns'

type Holiday = {
  id: string
  name: string
  date: string
}

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function CalendarPage() {
  const { data: session } = useSession()
  const isApprover = session?.user?.role === 'APPROVER'

  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'SINGLE' | 'RANGE'>('SINGLE')
  const [singleDate, setSingleDate] = useState<string>('')
  const [rangeStartDate, setRangeStartDate] = useState<string>('')
  const [rangeEndDate, setRangeEndDate] = useState<string>('')
  const [holidayName, setHolidayName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

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
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    fetchHolidays(gridStart, gridEnd)
  }, [currentMonth])

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const goToToday = () => setCurrentMonth(new Date())

  // Refresh current view
  const refreshCurrentView = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    fetchHolidays(
      startOfWeek(monthStart, { weekStartsOn: 1 }),
      endOfWeek(monthEnd, { weekStartsOn: 1 })
    )
  }

  const openAddModal = (date?: Date) => {
    if (isApprover) return
    const dStr = date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
    setSingleDate(dStr)
    setRangeStartDate(dStr)
    setRangeEndDate(dStr)
    setHolidayName('')
    setModalMode('SINGLE')
    setErrorMessage('')
    setIsModalOpen(true)
  }

  const openRangeModal = () => {
    if (isApprover) return
    const dStr = format(new Date(), 'yyyy-MM-dd')
    setRangeStartDate(dStr)
    setRangeEndDate(dStr)
    setHolidayName('')
    setModalMode('RANGE')
    setErrorMessage('')
    setIsModalOpen(true)
  }

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!holidayName.trim()) {
      setErrorMessage('Holiday name is required')
      return
    }

    setIsSubmitting(true)
    try {
      let body: Record<string, string>

      if (modalMode === 'RANGE') {
        if (!rangeStartDate || !rangeEndDate) {
          setErrorMessage('Please select both start and end dates')
          setIsSubmitting(false)
          return
        }
        if (rangeEndDate < rangeStartDate) {
          setErrorMessage('End date cannot be earlier than start date')
          setIsSubmitting(false)
          return
        }
        body = {
          name: holidayName.trim(),
          startDate: rangeStartDate,
          endDate: rangeEndDate,
        }
      } else {
        if (!singleDate) {
          setErrorMessage('Please select a date')
          setIsSubmitting(false)
          return
        }
        body = {
          name: holidayName.trim(),
          date: singleDate,
        }
      }

      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (res.ok) {
        setIsModalOpen(false)
        setHolidayName('')
        if (modalMode === 'RANGE') {
          toast.success(`Successfully marked ${data.count || 'holiday'} days for ${body.name}`)
        } else {
          toast.success(`Marked holiday: ${body.name}`)
        }
        refreshCurrentView()
      } else {
        setErrorMessage(data.error || 'Failed to save holiday')
      }
    } catch {
      setErrorMessage('Network error occurred while saving holiday')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove the holiday "${name}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/holidays?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`Removed holiday: ${name}`)
        refreshCurrentView()
      } else {
        toast.error('Failed to delete holiday')
      }
    } catch (e) {
      console.error(e)
      toast.error('Network error while deleting holiday')
    }
  }

  // Calculate Month Boundaries & Days
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Calculate month metrics
  const monthDaysList = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const totalMonthDays = monthDaysList.length

  const holidaysInThisMonth = useMemo(() => {
    return holidays.filter((h) => isSameMonth(new Date(h.date), monthStart))
  }, [holidays, monthStart])

  const holidaysCount = holidaysInThisMonth.length

  const sundaysCount = useMemo(() => {
    return monthDaysList.filter((d) => isSunday(d)).length
  }, [monthDaysList])

  // Overlap: holidays that fall on a Sunday
  const holidaysOnSundayCount = useMemo(() => {
    return holidaysInThisMonth.filter((h) => isSunday(new Date(h.date))).length
  }, [holidaysInThisMonth])

  const netWorkingDays = Math.max(
    0,
    totalMonthDays - sundaysCount - (holidaysCount - holidaysOnSundayCount)
  )

  // Range duration calculation in modal
  const rangeDurationDays = useMemo(() => {
    if (!rangeStartDate || !rangeEndDate) return 0
    try {
      const diff = differenceInCalendarDays(new Date(rangeEndDate), new Date(rangeStartDate))
      return diff >= 0 ? diff + 1 : 0
    } catch {
      return 0
    }
  }, [rangeStartDate, rangeEndDate])

  return (
    <div className="mx-auto max-w-[1480px] p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-acc-2/15 text-acc-2">
              <CalendarIcon className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-text sm:text-2xl">
              Attendance &amp; Holiday Calendar
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted">
            Sarvodaya English Higher Secondary School, Lakhnadon · Manage school holidays, vacations, and academic off-days.
          </p>
        </div>

        {/* Month Selector & Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prevMonth}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card hover:bg-card-hi transition-colors disabled:opacity-50"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4 text-text" />
            </button>

            <div className="flex items-center rounded-lg border border-line bg-card px-3.5 py-1.5 shadow-sm">
              <CalendarDays className="mr-2 h-4 w-4 text-acc-2" />
              <span className="num text-sm font-semibold tracking-tight text-text">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card hover:bg-card-hi transition-colors disabled:opacity-50"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4 text-text" />
            </button>
          </div>

          <Button variant="secondary" onClick={goToToday} className="h-9">
            Today
          </Button>

          {!isApprover && (
            <Button
              onClick={() => openAddModal()}
              className="h-9 gap-1.5"
              icon={Plus}
            >
              Add Holiday / Range
            </Button>
          )}
        </div>
      </div>

      {isApprover && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-line-soft bg-card-hi p-3.5 text-xs text-muted shadow-2xs">
          <Info size={16} className="text-acc-2 flex-none" />
          <span>Read-only view. Only administrators have permission to schedule or delete school holidays.</span>
        </div>
      )}

      {/* Color Legend (Modeled directly on ToSchool) */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-card p-3.5 text-xs text-text shadow-2xs">
        <span className="font-bold text-text uppercase tracking-wider text-[11px] mr-1">
          Legend:
        </span>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400 ring-2 ring-indigo-200 dark:ring-indigo-900/60" />
          <span className="font-semibold text-text">School Holiday</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-500 dark:bg-slate-400 ring-2 ring-slate-200 dark:ring-slate-800" />
          <span className="font-semibold text-text">Sunday Off</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400 ring-2 ring-indigo-200 dark:ring-indigo-900/60" />
          <span className="font-semibold text-text">Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600 dark:bg-slate-300 ring-2 ring-slate-200 dark:ring-slate-800" />
          <span className="font-semibold text-text">Working Day</span>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left Column: Calendar Grid */}
        <div className="flex-1 overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-line bg-card-hi/80 text-center text-xs font-bold text-text">
            {WEEKDAY_NAMES.map((name, i) => (
              <div
                key={name}
                className={`py-3 text-[11.5px] uppercase tracking-wider ${
                  i === 6
                    ? 'text-muted font-bold'
                    : 'text-text font-bold'
                }`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-line">
            {days.map((day) => {
              const holiday = holidays.find((h) => isSameDay(new Date(h.date), day))
              const isCurrentMonth = isSameMonth(day, monthStart)
              const isTodayDate = isToday(day)
              const isSundayDate = isSunday(day)

              let cellBg = 'bg-card hover:bg-card-hi/40'
              let borderAccent = ''

              if (!isCurrentMonth) {
                cellBg = 'bg-canvas/50'
              } else if (isTodayDate) {
                cellBg = 'bg-indigo-50/40 hover:bg-indigo-50/60 dark:bg-indigo-950/25'
                borderAccent = 'ring-2 ring-indigo-600 dark:ring-indigo-400 z-10'
              } else if (holiday) {
                cellBg = 'bg-indigo-50/50 hover:bg-indigo-100/50 dark:bg-indigo-950/30'
                borderAccent = 'ring-1 ring-inset ring-indigo-300 dark:ring-indigo-700/60'
              } else if (isSundayDate) {
                cellBg = 'bg-card-hi/30 hover:bg-card-hi/50'
              }

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => {
                    if (holiday) {
                      handleDelete(holiday.id, holiday.name)
                    } else if (isCurrentMonth) {
                      openAddModal(day)
                    }
                  }}
                  className={cn(
                    'group relative flex min-h-[110px] flex-col justify-between p-2.5 transition-colors duration-150 sm:min-h-[125px] cursor-pointer',
                    cellBg,
                    borderAccent
                  )}
                >
                  {/* Top Row: Day Number + Status Badge */}
                  <div className="flex items-start justify-between">
                    {isTodayDate ? (
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-xs dark:bg-indigo-500 num">
                        {format(day, 'dd')}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'num text-sm font-black tracking-tight',
                          !isCurrentMonth
                            ? 'text-subtle/50'
                            : holiday
                              ? 'text-indigo-950 dark:text-indigo-200'
                              : isSundayDate
                                ? 'text-text/75 font-bold'
                                : 'text-text font-black'
                        )}
                      >
                        {format(day, 'dd')}
                      </span>
                    )}

                    {/* Status Pill Badge */}
                    {holiday ? (
                      <span className="rounded-md border border-indigo-200 bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-900 shadow-2xs dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                        Holiday
                      </span>
                    ) : isTodayDate ? (
                      <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs dark:bg-indigo-500">
                        Today
                      </span>
                    ) : isSundayDate && isCurrentMonth ? (
                      <span className="rounded-md border border-line bg-card-hi px-1.5 py-0.5 text-[10px] font-bold text-muted shadow-2xs">
                        Sunday
                      </span>
                    ) : null}
                  </div>

                  {/* Middle Content */}
                  <div className="my-2 flex flex-col gap-1">
                    {holiday ? (
                      <div className="flex items-center justify-between gap-1.5 rounded-lg border border-indigo-200 bg-indigo-100/80 px-2.5 py-1.5 text-xs font-bold text-indigo-950 shadow-xs dark:border-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="size-1.5 rounded-full bg-indigo-600 shrink-0 dark:bg-indigo-400" />
                          <span className="truncate">{holiday.name}</span>
                        </div>
                        {!isApprover && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(holiday.id, holiday.name)
                            }}
                            className="shrink-0 rounded p-1 text-indigo-800 hover:bg-rose-100 hover:text-rose-700 dark:text-indigo-300 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 transition-colors cursor-pointer"
                            title={`Delete holiday: ${holiday.name}`}
                            aria-label={`Delete ${holiday.name}`}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ) : isSundayDate ? (
                      <span className="text-xs font-bold text-muted">
                        Sunday Off
                      </span>
                    ) : isCurrentMonth ? (
                      <div className="flex items-center gap-1 text-xs font-semibold text-text/80">
                        <Building className="h-3.5 w-3.5 flex-none text-muted" />
                        <span className="truncate">Working Day</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Bottom Hover Action (when empty day) */}
                  <div className="mt-auto pt-1">
                    {!holiday && isCurrentMonth && (
                      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <span className="inline-flex items-center gap-1 rounded-md border border-line bg-card-hi px-2 py-0.5 text-[10.5px] font-bold text-text shadow-2xs hover:bg-card">
                          <Plus size={11} aria-hidden="true" />
                          Mark
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Sidebar (Metrics & Holiday List) */}
        <div className="flex w-full flex-col gap-5 lg:w-80">
          {/* Monthly Overview Card */}
          <Card className="rounded-2xl p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between border-b border-line-soft pb-3">
              <div>
                <h3 className="text-[15px] font-bold tracking-tight text-text">
                  Monthly Overview
                </h3>
                <p className="text-xs text-muted">
                  {format(currentMonth, 'MMMM yyyy')} academic days
                </p>
              </div>
              <span className="rounded-lg bg-acc-2/10 p-2 text-acc-2">
                <CalendarCheck2 className="h-4 w-4" />
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-line bg-card-hi p-3 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Total Days</span>
                <b className="num mt-1 block text-lg font-bold text-slate-900 dark:text-slate-100">
                  {totalMonthDays}
                </b>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 shadow-2xs dark:border-indigo-800/80 dark:bg-indigo-950/40">
                <span className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-300">School Holidays</span>
                <b className="num mt-1 block text-lg font-bold text-indigo-950 dark:text-indigo-200">
                  {holidaysCount}
                </b>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900/40">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Sundays</span>
                <b className="num mt-1 block text-lg font-bold text-slate-800 dark:text-slate-200">
                  {sundaysCount}
                </b>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-2xs dark:border-emerald-800/80 dark:bg-emerald-950/40">
                <span className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-300">Net Working Days</span>
                <b className="num mt-1 block text-lg font-bold text-emerald-950 dark:text-emerald-200">
                  {netWorkingDays}
                </b>
              </div>
            </div>

            <div className="mt-4 border-t border-line-soft pt-3">
              <Button
                variant="secondary"
                onClick={openRangeModal}
                className="w-full gap-2 text-xs"
                icon={CalendarRange}
              >
                Mark Holiday Range
              </Button>
            </div>
          </Card>

          {/* This Month's Holidays List Card */}
          <Card className="rounded-2xl p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-line-soft pb-3">
              <h3 className="text-[15px] font-bold tracking-tight text-text">
                Holidays in {format(currentMonth, 'MMMM')}
              </h3>
              <span className="rounded-full border border-line bg-card-hi px-2 py-0.5 text-xs font-semibold text-text">
                {holidaysCount}
              </span>
            </div>

            {holidaysInThisMonth.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted">
                <Sparkles className="mx-auto mb-2 h-6 w-6 text-subtle" />
                No holidays recorded for this month.
                <button
                  type="button"
                  onClick={() => openAddModal()}
                  className="mt-2 block w-full text-xs font-medium text-acc-2 hover:underline"
                >
                  + Add first holiday
                </button>
              </div>
            ) : (
              <div className="divide-y divide-line-soft max-h-[380px] overflow-y-auto pr-1">
                {holidaysInThisMonth.map((h) => {
                  const d = new Date(h.date)
                  return (
                    <div
                      key={h.id}
                      className="flex items-center justify-between py-2.5 transition-colors hover:bg-canvas/30 px-1 rounded-lg"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex size-9 flex-none flex-col items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-950 shadow-2xs dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200">
                          <span className="num text-xs font-bold leading-none">
                            {format(d, 'dd')}
                          </span>
                          <span className="text-[9px] uppercase font-bold leading-tight">
                            {format(d, 'MMM')}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="truncate text-xs font-semibold text-text">
                            {h.name}
                          </h4>
                          <p className="text-[11px] text-muted">
                            {format(d, 'EEEE')}
                          </p>
                        </div>
                      </div>

                      {!isApprover && (
                        <button
                          type="button"
                          onClick={() => handleDelete(h.id, h.name)}
                          className="rounded-lg p-1.5 text-subtle hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                          title="Delete holiday"
                          aria-label={`Delete ${h.name}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Add Holiday / Range Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'RANGE' ? 'Mark Holiday Range' : 'Mark School Holiday'}
      >
        <form onSubmit={handleSaveHoliday} className="space-y-4">
          {errorMessage && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 rounded-xl border border-line bg-card p-1 text-xs font-medium text-muted">
            <button
              type="button"
              onClick={() => setModalMode('SINGLE')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors',
                modalMode === 'SINGLE'
                  ? 'bg-card-hi font-semibold text-text shadow-sm'
                  : 'hover:text-text'
              )}
            >
              <CalendarIcon size={14} aria-hidden="true" />
              Single Day
            </button>
            <button
              type="button"
              onClick={() => setModalMode('RANGE')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors',
                modalMode === 'RANGE'
                  ? 'bg-card-hi font-semibold text-text shadow-sm'
                  : 'hover:text-text'
              )}
            >
              <CalendarRange size={14} aria-hidden="true" />
              Date Range (Vacation)
            </button>
          </div>

          <Field label="Holiday Name / Occasion" htmlFor="holiday-name">
            <Input
              id="holiday-name"
              type="text"
              required
              data-autofocus
              placeholder={
                modalMode === 'RANGE'
                  ? 'e.g. Diwali Vacation, Winter Break'
                  : 'e.g. Republic Day, Ambedkar Jayanti'
              }
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
            />
          </Field>

          {modalMode === 'SINGLE' ? (
            <Field label="Holiday Date" htmlFor="single-date">
              <Input
                id="single-date"
                type="date"
                required
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
              />
            </Field>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Start Date" htmlFor="range-start">
                  <Input
                    id="range-start"
                    type="date"
                    required
                    value={rangeStartDate}
                    onChange={(e) => setRangeStartDate(e.target.value)}
                  />
                </Field>

                <Field label="End Date" htmlFor="range-end">
                  <Input
                    id="range-end"
                    type="date"
                    required
                    value={rangeEndDate}
                    onChange={(e) => setRangeEndDate(e.target.value)}
                  />
                </Field>
              </div>

              {rangeDurationDays > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                  <span>Selected Range Duration:</span>
                  <b className="num font-bold">{rangeDurationDays} Days</b>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              icon={Plus}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : modalMode === 'RANGE' ? 'Save Holiday Range' : 'Save Holiday'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
