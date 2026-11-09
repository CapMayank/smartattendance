'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Button,
} from '@/components/ui'
import { ScrollText, Search, RefreshCw, ShieldCheck, UserPlus, UserMinus, KeyRound, Fingerprint } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/format'

type AuditLogRow = {
  id: string
  at: string
  actorUserId: string | null
  actorName: string
  actorRole: string | null
  action: string
  targetType: string
  targetId: string | null
  details: string | null
  parsedDetails: Record<string, unknown> | null
}

const ACTION_META: Record<
  string,
  { label: string; tone: string }
> = {
  STAFF_JOIN: { label: 'Staff Onboarded', tone: 'tone-present' },
  STAFF_UPDATE: { label: 'Staff Updated', tone: 'tone-accent' },
  STAFF_EXIT: { label: 'Staff Exited', tone: 'tone-absent' },
  STAFF_REJOIN: { label: 'Staff Rejoined', tone: 'tone-present' },
  STAFF_DELETE: { label: 'Staff Deleted', tone: 'tone-absent' },
  PASSWORD_RESET: { label: 'Temp Password Issued', tone: 'tone-late' },
  PASSWORD_CHANGE: { label: 'Password Changed', tone: 'tone-accent' },
  UNMATCHED_PUNCH_ATTACHED: { label: 'Punch Attached', tone: 'tone-present' },
  UNMATCHED_PUNCH_DISMISSED: { label: 'Punch Dismissed', tone: 'tone-muted' },
  PUNCH_REQUEST_APPROVED: { label: 'Punch Request Approved', tone: 'tone-present' },
  PUNCH_REQUEST_REJECTED: { label: 'Punch Request Rejected', tone: 'tone-absent' },
  PROFILE_CHANGE_APPROVED: { label: 'Profile Change Approved', tone: 'tone-present' },
  PROFILE_CHANGE_REJECTED: { label: 'Profile Change Rejected', tone: 'tone-absent' },
  SETUP_COMPLETED: { label: 'Setup Completed', tone: 'tone-accent' },
}

function summarizeDetails(row: AuditLogRow): string {
  const d = row.parsedDetails
  if (!d) return row.details || '—'
  const parts: string[] = []
  if (typeof d.name === 'string') parts.push(d.name)
  if (typeof d.employeeCode === 'string') parts.push(`ID ${d.employeeCode}`)
  if (typeof d.machineId === 'string') parts.push(`Machine #${d.machineId}`)
  if (typeof d.joiningDate === 'string') parts.push(`Joined ${formatDate(d.joiningDate)}`)
  if (typeof d.lastWorkingDay === 'string') parts.push(`Last day ${formatDate(d.lastWorkingDay)}`)
  if (typeof d.exitReason === 'string') parts.push(`Reason: ${d.exitReason}`)
  if (typeof d.role === 'string') parts.push(`Role: ${d.role}`)
  if (typeof d.payGroup === 'string') parts.push(`Pay: ${d.payGroup}`)
  if (typeof d.staffName === 'string') parts.push(`Staff: ${d.staffName}`)
  if (typeof d.date === 'string') parts.push(`Date: ${formatDate(d.date)}`)
  if (typeof d.punchType === 'string') parts.push(`Punch: ${d.punchType}`)
  if (typeof d.decisionRemarks === 'string') parts.push(`Remarks: ${d.decisionRemarks}`)
  if (typeof d.reason === 'string') parts.push(`Reason: ${d.reason}`)
  if (d.appliedChanges && typeof d.appliedChanges === 'object') {
    const keys = Object.keys(d.appliedChanges)
    if (keys.length > 0) parts.push(`Updated: ${keys.join(', ')}`)
  }
  if (Array.isArray(d.deletedStaffIds)) parts.push(`Deleted ${d.deletedStaffIds.length} record(s)`)
  if (parts.length > 0) return parts.join(' · ')
  return row.details || '—'
}

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [targetFilter, setTargetFilter] = useState<string>('ALL')
  const [actionFilter, setActionFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/audit-logs?limit=250')
      if (res.ok) {
        const data = await res.json()
        return Array.isArray(data.items) ? (data.items as AuditLogRow[]) : []
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error)
    }
    return null
  }, [])

  const handleRefresh = useCallback(async () => {
    setLoading(true)
    const rows = await fetchAuditLogs()
    if (rows) setItems(rows)
    setLoading(false)
  }, [fetchAuditLogs])

  useEffect(() => {
    let active = true
    fetchAuditLogs().then((rows) => {
      if (!active) return
      if (rows) setItems(rows)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [fetchAuditLogs])

  const actions = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.action))).sort()
  }, [items])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return items.filter((item) => {
      if (targetFilter !== 'ALL' && item.targetType.toUpperCase() !== targetFilter) return false
      if (actionFilter && item.action !== actionFilter) return false
      if (!q) return true
      return (
        item.action.toLowerCase().includes(q) ||
        item.actorName.toLowerCase().includes(q) ||
        item.targetType.toLowerCase().includes(q) ||
        (item.details ?? '').toLowerCase().includes(q) ||
        summarizeDetails(item).toLowerCase().includes(q)
      )
    })
  }, [items, targetFilter, actionFilter, searchQuery])

  const counts = useMemo(() => {
    let staff = 0
    let user = 0
    let punch = 0
    for (const i of items) {
      const t = i.targetType.toUpperCase()
      if (t === 'STAFF') staff++
      else if (t === 'USER') user++
      else if (t === 'UNMATCHEDPUNCH' || t === 'PUNCH') punch++
    }
    return { all: items.length, staff, user, punch }
  }, [items])

  return (
    <div className="space-y-5">
      <PageHeader
        title="System audit logs"
        subtitle="Immutable security & lifecycle trail of staff onboarding, exits, credentials, and biometric punch resolutions"
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={handleRefresh} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col justify-between gap-3 border-b border-line-soft p-4 lg:flex-row lg:items-center">
          <ChipGroup label="Filter by target">
            <Chip pressed={targetFilter === 'ALL'} onClick={() => setTargetFilter('ALL')} count={counts.all}>
              All events
            </Chip>
            <Chip
              pressed={targetFilter === 'STAFF'}
              onClick={() => setTargetFilter('STAFF')}
              dot="present"
              count={counts.staff}
            >
              Staff lifecycle
            </Chip>
            <Chip
              pressed={targetFilter === 'USER'}
              onClick={() => setTargetFilter('USER')}
              dot="accent"
              count={counts.user}
            >
              Credentials &amp; auth
            </Chip>
            <Chip
              pressed={targetFilter === 'UNMATCHEDPUNCH'}
              onClick={() => setTargetFilter('UNMATCHEDPUNCH')}
              dot="late"
              count={counts.punch}
            >
              Biometric punches
            </Chip>
          </ChipGroup>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Select
              aria-label="Filter by action"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full sm:w-52"
            >
              <option value="">All action types</option>
              {actions.map((act) => (
                <option key={act} value={act}>
                  {ACTION_META[act]?.label || act}
                </option>
              ))}
            </Select>

            <div className="relative w-full sm:w-64">
              <Search
                size={15}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search actor, staff, SAR-ID..."
                aria-label="Search audit logs"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  {[...Array(6)].map((_, i) => (
                    <tr key={i}>
                      <td>
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td>
                        <Skeleton className="h-5 w-36 rounded-full" />
                      </td>
                      <td>
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td>
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td>
                        <Skeleton className="h-4 w-64" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={ScrollText}
                      title="No audit events match this filter"
                      hint="Staff onboarding, exits, password resets, and punch resolutions will appear here automatically."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const dt = new Date(row.at)
                  const meta = ACTION_META[row.action] || {
                    label: row.action.replace(/_/g, ' '),
                    tone: 'tone-muted',
                  }
                  return (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="num text-[13px] text-text">{formatDate(dt)}</span>
                          <span className="num text-xs text-subtle">{formatTime(dt)}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`tint-badge ${meta.tone} inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium`}
                        >
                          {row.action.includes('JOIN') ? (
                            <UserPlus size={12} aria-hidden="true" />
                          ) : row.action.includes('EXIT') || row.action.includes('DELETE') ? (
                            <UserMinus size={12} aria-hidden="true" />
                          ) : row.action.includes('PASSWORD') ? (
                            <KeyRound size={12} aria-hidden="true" />
                          ) : row.action.includes('PUNCH') ? (
                            <Fingerprint size={12} aria-hidden="true" />
                          ) : (
                            <ShieldCheck size={12} aria-hidden="true" />
                          )}
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium text-text">{row.actorName}</span>
                          {row.actorRole && <span className="text-[11px] text-subtle">{row.actorRole}</span>}
                        </div>
                      </td>
                      <td>
                        <span className="rounded-md border border-line-soft bg-canvas px-2 py-0.5 text-xs text-muted">
                          {row.targetType}
                        </span>
                      </td>
                      <td className="max-w-md">
                        <span className="text-[13px] text-muted">{summarizeDetails(row)}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
