'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Clock, Pencil, Lightbulb, RefreshCw, Check, X, AlertTriangle, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardHeader, EmptyState, Field, IconButton, Input, Modal, PageHeader, SectionLabel, Skeleton } from '@/components/ui'
import { previewHeadline, transitionRows } from '@/lib/shift-preview-text'
import type { PreviewSummary } from '@/lib/shift-change'

type Shift = {
  id: string
  name: string
  startTime: string
  endTime: string
}

type Suggestion = {
  id: string
  staffId: string
  staffName: string
  fromShiftName: string | null
  medianIn: string
  medianOut: string | null
  daysObserved: number
  daysWithinTolerance: number
  lateDays: number
  patternSince: string
  direction: string
  suggestedShiftId: string | null
  suggestedStart: string
  suggestedEnd: string
}

type Review = {
  suggestion: Suggestion
  startDate: string
  status: 'loading' | 'ok' | 'error'
  summary?: PreviewSummary
  error?: string
}

type Unrecalculated = { suggestion: Suggestion; startDate: string; message: string }

const ALWAYS_DAY = '2000-01-01'

async function errorOf(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null)
  return body && typeof body.error === 'string' ? body.error : fallback
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [name, setName] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', startTime: '', endTime: '' })

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [sugLoading, setSugLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [startDates, setStartDates] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [review, setReview] = useState<Review | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [unrecalculated, setUnrecalculated] = useState<Unrecalculated | null>(null)

  const fetchSuggestions = async (refresh = false) => {
    try {
      const res = await fetch(refresh ? '/api/shifts/suggestions?refresh=1' : '/api/shifts/suggestions')
      if (res.ok) {
        const body = await res.json()
        setSuggestions(Array.isArray(body.suggestions) ? body.suggestions : [])
      } else if (refresh) {
        toast.error(await errorOf(res, 'Could not check for suggestions'))
      }
    } catch {
      if (refresh) toast.error('Could not check for suggestions')
    } finally {
      setSugLoading(false)
    }
  }

  const checkNow = async () => {
    setChecking(true)
    await fetchSuggestions(true)
    setChecking(false)
  }

  const startDateOf = (sg: Suggestion) => startDates[sg.id] ?? sg.patternSince

  const setBusyFor = (id: string, v: boolean) => setBusy(b => ({ ...b, [id]: v }))

  const openReview = async (sg: Suggestion) => {
    const startDate = startDateOf(sg)
    if (!startDate || startDate < ALWAYS_DAY) {
      toast.error('Choose a start date on or after 2000-01-01')
      return
    }
    setBusyFor(sg.id, true)
    setReview({ suggestion: sg, startDate, status: 'loading' })
    try {
      const res = await fetch(`/api/shifts/suggestions/${sg.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, dryRun: true })
      })
      if (res.ok) {
        setReview({ suggestion: sg, startDate, status: 'ok', summary: await res.json() })
      } else {
        setReview({ suggestion: sg, startDate, status: 'error', error: await errorOf(res, 'Could not preview this change') })
      }
    } catch {
      setReview({ suggestion: sg, startDate, status: 'error', error: 'Could not preview this change' })
    }
    setBusyFor(sg.id, false)
  }

  const sendApprove = async (sg: Suggestion, startDate: string) => {
    setConfirming(true)
    setBusyFor(sg.id, true)
    try {
      const res = await fetch(`/api/shifts/suggestions/${sg.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate })
      })
      if (res.status === 409) {
        toast.error('This suggestion is already being decided.')
        setReview(null)
        return
      }
      if (!res.ok) {
        toast.error(await errorOf(res, 'Could not approve this suggestion'))
        return
      }
      const body = await res.json()
      setReview(null)
      if (body.assignmentSaved && body.recalculated === false) {
        setUnrecalculated({
          suggestion: sg,
          startDate,
          message: body.error || 'The new shift was saved, but past days were not recalculated yet.'
        })
      } else {
        setUnrecalculated(null)
        toast.success(`${sg.staffName}'s shift change is saved`)
      }
      await Promise.all([fetchSuggestions(), fetchShifts()])
    } catch {
      toast.error('Could not approve this suggestion')
    } finally {
      setConfirming(false)
      setBusyFor(sg.id, false)
    }
  }

  const dismiss = async (sg: Suggestion) => {
    setBusyFor(sg.id, true)
    try {
      const res = await fetch(`/api/shifts/suggestions/${sg.id}/dismiss`, { method: 'POST' })
      if (res.ok) {
        setSuggestions(list => list.filter(x => x.id !== sg.id))
        toast.success('Suggestion dismissed')
      } else {
        toast.error(await errorOf(res, 'Could not dismiss this suggestion'))
      }
    } catch {
      toast.error('Could not dismiss this suggestion')
    }
    setBusyFor(sg.id, false)
  }

  const startEditing = (shift: Shift) => {
    setEditingId(shift.id)
    setEditData({ name: shift.name, startTime: shift.startTime, endTime: shift.endTime })
  }

  const saveEdit = async () => {
    if (!editData.name || !editData.startTime || !editData.endTime) return
    const res = await fetch('/api/shifts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, ...editData })
    })
    if (res.ok) {
      setEditingId(null)
      fetchShifts()
    }
  }

  const fetchShifts = async () => {
    const res = await fetch('/api/shifts')
    if (res.ok) {
      setShifts(await res.json())
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchShifts()
    fetch('/api/shifts/suggestions')
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (body && Array.isArray(body.suggestions)) setSuggestions(body.suggestions)
      })
      .catch(() => {})
      .finally(() => setSugLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !startTime || !endTime) return

    const res = await fetch('/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, startTime, endTime })
    })

    if (res.ok) {
      setName('')
      fetchShifts()
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchShifts()
    } else {
      toast.error(await errorOf(res, 'Could not delete this shift'))
    }
  }

  const editingShift = shifts.find(x => x.id === editingId)
  const timesChanged =
    !!editingShift && (editData.startTime !== editingShift.startTime || editData.endTime !== editingShift.endTime)

  return (
    <div className="space-y-5">
      <PageHeader title="Shifts" subtitle="Configure work schedules and timeframes" />

      <section aria-label="Suggestions" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Suggestions</SectionLabel>
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={checking} onClick={checkNow}>Check now</Button>
        </div>

        {unrecalculated && (
          <div role="alert" className="space-y-2 rounded-xl border border-late bg-card-hi p-3 text-[13px] text-text">
            <p className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 flex-none text-late" aria-hidden="true" />
              <span><b>Saved, not recalculated.</b> {unrecalculated.message}</span>
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={!!busy[unrecalculated.suggestion.id]}
                onClick={() => sendApprove(unrecalculated.suggestion, unrecalculated.startDate)}
              >Retry</Button>
              <Button size="sm" variant="ghost" onClick={() => setUnrecalculated(null)}>Close</Button>
            </div>
          </div>
        )}

        {sugLoading ? (
          <Skeleton className="h-28" />
        ) : suggestions.length === 0 ? (
          <Card>
            <EmptyState icon={Lightbulb} title="No suggestions right now" hint="A suggestion shows up when a teacher's real arrival time differs from their shift for weeks." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {suggestions.map(sg => {
              const inFlight = !!busy[sg.id]
              const fromShift = shifts.find(x => x.name === sg.fromShiftName)
              const proposedName = sg.suggestedShiftId ? (shifts.find(x => x.id === sg.suggestedShiftId)?.name ?? 'Existing shift') : 'New shift'
              return (
                <Card key={sg.id} className="space-y-3">
                  <CardHeader title={sg.staffName} />
                  <p className="text-[13px] text-muted">
                    Usually arrives about <span className="num text-text">{sg.medianIn}</span>{' '}
                    (<span className="num">{sg.daysWithinTolerance} of {sg.daysObserved}</span> days within 15 minutes),
                    shift is <span className="num text-text">{fromShift ? `${fromShift.startTime}–${fromShift.endTime}` : (sg.fromShiftName ?? 'not set')}</span>,
                    late on <span className="num text-text">{sg.lateDays}</span> of <span className="num text-text">{sg.daysObserved}</span> days.
                  </p>
                  <p className="text-[13px] text-text">
                    Proposed: <b>{proposedName}</b>{' '}
                    <span className="num">{sg.suggestedStart}–{sg.suggestedEnd}</span>
                  </p>
                  <Field label="Starts on" htmlFor={`start-${sg.id}`}>
                    <Input
                      id={`start-${sg.id}`}
                      type="date"
                      className="num"
                      min={ALWAYS_DAY}
                      value={startDateOf(sg)}
                      onChange={e => setStartDates(d => ({ ...d, [sg.id]: e.target.value }))}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" icon={Check} loading={inFlight} disabled={inFlight} onClick={() => openReview(sg)}>Approve</Button>
                    <Button size="sm" variant="secondary" icon={X} disabled={inFlight} onClick={() => dismiss(sg)}>Dismiss</Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-1 self-start">
          <CardHeader title="Add shift" />
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Shift name" htmlFor="new-name">
              <Input id="new-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Shift" required />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Start time" htmlFor="new-start">
                <Input id="new-start" type="time" className="num" value={startTime} onChange={e => setStartTime(e.target.value)} required />
              </Field>
              <Field label="End time" htmlFor="new-end">
                <Input id="new-end" type="time" className="num" value={endTime} onChange={e => setEndTime(e.target.value)} required />
              </Field>
            </div>

            <Button type="submit" icon={Plus} className="w-full">Create Shift</Button>
          </form>
        </Card>

        <Card className="overflow-hidden !p-0 md:col-span-2">
          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : shifts.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Shift</th>
                    <th>Start</th>
                    <th>End</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map(shift => (
                    <tr key={shift.id}>
                      <td className="w-full">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 flex-none place-items-center rounded-[10px] border border-line bg-card-hi text-muted">
                            <Clock size={16} aria-hidden="true" />
                          </span>
                          <span className="font-medium text-text">{shift.name}</span>
                        </div>
                      </td>
                      <td className="num text-muted">{shift.startTime}</td>
                      <td className="num text-muted">{shift.endTime}</td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <IconButton icon={Pencil} label="Edit" className="size-8" onClick={() => startEditing(shift)} />
                          <IconButton icon={Trash2} label="Delete" className="size-8 hover:border-absent hover:text-absent" onClick={() => handleDelete(shift.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Clock} title="No shifts yet" hint="Create your first shift using the form to define work schedules." />
          )}
        </Card>
      </div>

      <Modal
        open={review !== null}
        onClose={() => { if (!confirming) setReview(null) }}
        title={review ? `Change ${review.suggestion.staffName}'s shift` : 'Change shift'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReview(null)} disabled={confirming}>Cancel</Button>
            <Button
              loading={confirming}
              disabled={review?.status !== 'ok' || confirming}
              onClick={() => review && sendApprove(review.suggestion, review.startDate)}
            >Confirm</Button>
          </>
        }
      >
        {review && (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto text-[13px]">
            <p className="text-muted">
              Starts on <span className="num text-text">{review.startDate}</span> with{' '}
              <span className="num text-text">{review.suggestion.suggestedStart}–{review.suggestion.suggestedEnd}</span>.
            </p>
            {review.status === 'loading' && <Skeleton className="h-16" />}
            {review.status === 'error' && (
              <p role="alert" className="flex items-start gap-2 text-absent">
                <AlertTriangle size={16} className="mt-0.5 flex-none" aria-hidden="true" />
                <span>{review.error}</span>
              </p>
            )}
            {review.status === 'ok' && review.summary && (
              <div className="space-y-1">
                <p className="num text-text">{previewHeadline(review.summary)}</p>
                {transitionRows(review.summary.transitions).length > 0 && (
                  <ul className="space-y-0.5 text-muted">
                    {transitionRows(review.summary.transitions).map(r => (
                      <li key={r.label}>{r.label}: <span className="num text-text">{r.count}</span></li>
                    ))}
                  </ul>
                )}
                {review.summary.lockedSkippedDays > 0 && (
                  <p className="text-muted">
                    <span className="num">{review.summary.lockedSkippedDays}</span> locked {review.summary.lockedSkippedDays === 1 ? 'day' : 'days'} left alone
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Edit shift"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Shift name" htmlFor="edit-name">
            <Input id="edit-name" type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} data-autofocus />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start time" htmlFor="edit-start">
              <Input id="edit-start" type="time" className="num" value={editData.startTime} onChange={e => setEditData({...editData, startTime: e.target.value})} />
            </Field>
            <Field label="End time" htmlFor="edit-end">
              <Input id="edit-end" type="time" className="num" value={editData.endTime} onChange={e => setEditData({...editData, endTime: e.target.value})} />
            </Field>
          </div>
          {timesChanged && (
            <p role="note" className="flex items-start gap-2 rounded-xl border border-late bg-card-hi p-3 text-[13px] text-text">
              <Info size={16} className="mt-0.5 flex-none text-late" aria-hidden="true" />
              <span>Changing these times changes every day that used this shift, including past months. To keep history, create a new shift and move teachers to it.</span>
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
