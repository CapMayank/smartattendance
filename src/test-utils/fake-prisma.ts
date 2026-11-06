export type Fixtures = {
  staff: {
    id: string
    name: string
    shiftId: string | null
    createdAt?: Date
    shift: { id: string; name: string; startTime: string; endTime: string } | null
  }[]
  policy: Record<string, unknown> | null
  holidays: { date: Date; name: string }[]
  lockedPayrolls: { staffId: string; month: number; year: number }[]
  logs: { id: string; staffId: string; timestamp: Date; type: string }[]
  /** Optional; defaults to the distinct shifts carried by `staff[].shift`. */
  shifts?: { id: string; name: string; startTime: string; endTime: string }[]
  /** Optional; defaults to no assignments. */
  assignments?: { staffId: string; effectiveFrom: string; shiftId: string | null }[]
  /** Optional; stored daily records returned by `dailyRecord.findMany`. */
  dailyRecords?: { staffId: string; date: Date; status: string; lateMinutes: number }[]
  /** Optional; stored shift suggestions. */
  suggestions?: SuggestionRow[]
}

export type SuggestionRow = {
  id: string
  staffId: string
  status: string
  fromShiftId?: string | null
  suggestedShiftId?: string | null
  suggestedStart?: string
  suggestedEnd?: string
  medianIn?: string
  medianOut?: string | null
  daysObserved?: number
  daysWithinTolerance?: number
  lateDays?: number
  patternSince?: string
  direction?: string
  dismissedUntil?: string | null
  decidedByUserId?: string | null
  decidedAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

type TimeFilter = { gte?: Date; lte?: Date }
type AssignmentRow = {
  staffId: string
  effectiveFrom: string
  shiftId: string | null
  source?: string
  createdByUserId?: string | null
}
type AssignmentData = AssignmentRow & { source: string }
type StaffUpdate = { where: { id: string }; data: { shiftId?: string | null } }

export function createFakePrisma(fixtures: Fixtures): {
  client: unknown
  created: Record<string, unknown>[]
  deleteCalls: unknown[]
  /** Live assignment rows (fixture rows plus any created or upserted). */
  assignments: AssignmentRow[]
  staffUpdates: StaffUpdate[]
  /** Live shift rows (fixture shifts plus any created). */
  shiftRows: { id: string; name: string; startTime: string; endTime: string }[]
  /** Live suggestion rows. */
  suggestions: SuggestionRow[]
  /** Every policy create/update call. */
  policyWrites: { op: 'create' | 'update'; data: Record<string, unknown> }[]
} {
  const created: Record<string, unknown>[] = []
  const deleteCalls: unknown[] = []
  const staffUpdates: StaffUpdate[] = []
  // Copies, so writes never leak into fixture objects shared between tests
  const staffRows = fixtures.staff.map((s) => ({ ...s }))
  const assignments: AssignmentRow[] = (fixtures.assignments ?? []).map((a) => ({ ...a }))
  const suggestions: SuggestionRow[] = (fixtures.suggestions ?? []).map((r) => ({ ...r }))
  const policyWrites: { op: 'create' | 'update'; data: Record<string, unknown> }[] = []
  let policyRow: Record<string, unknown> | null = fixtures.policy ? { ...fixtures.policy } : null
  let shiftSeq = 0
  let suggestionSeq = 0
  const shiftRows: { id: string; name: string; startTime: string; endTime: string }[] = (() => {
    if (fixtures.shifts) return fixtures.shifts.map((x) => ({ ...x }))
    const byId = new Map<string, NonNullable<Fixtures['staff'][number]['shift']>>()
    for (const s of fixtures.staff) if (s.shift) byId.set(s.shift.id, s.shift)
    return [...byId.values()].map((x) => ({ ...x }))
  })()

  const matchValue = (v: unknown, cond: unknown): boolean => {
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime()
    if (cond && typeof cond === 'object') {
      const c = cond as { lt?: Date | string }
      if (!('lt' in c) || v === null || v === undefined || c.lt === undefined) return false
      const a = v instanceof Date ? v.getTime() : (v as string)
      const b = c.lt instanceof Date ? c.lt.getTime() : c.lt
      return a < b
    }
    return v === cond
  }
  const matchesWhere = (row: Record<string, unknown>, where?: Record<string, unknown>): boolean =>
    Object.entries(where ?? {}).every(([k, v]) =>
      k === 'OR' ? (v as Record<string, unknown>[]).some((w) => matchesWhere(row, w)) : matchValue(row[k], v),
    )
  const sortBy = <T extends Record<string, unknown>>(rows: T[], orderBy?: Record<string, 'asc' | 'desc'>) => {
    if (!orderBy) return rows
    const [key, dir] = Object.entries(orderBy)[0]
    const sign = dir === 'desc' ? -1 : 1
    return [...rows].sort((a, b) => {
      const av = a[key] as string | Date | undefined
      const bv = b[key] as string | Date | undefined
      if (av === bv) return 0
      if (av === undefined || av === null) return 1
      if (bv === undefined || bv === null) return -1
      return (av < bv ? -1 : 1) * sign
    })
  }

  const inRange = (t: Date, f?: TimeFilter) =>
    (!f?.gte || t.getTime() >= f.gte.getTime()) && (!f?.lte || t.getTime() <= f.lte.getTime())

  const sortedLogs = (where?: { timestamp?: TimeFilter; staffId?: string }) =>
    fixtures.logs
      .filter((l) => inRange(l.timestamp, where?.timestamp))
      .filter((l) => !where?.staffId || l.staffId === where.staffId)
      .map((l) => ({ id: l.id, staffId: l.staffId, timestamp: l.timestamp, type: l.type }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  const matchesId = (id: string, filter?: string | { in?: string[] }) => {
    if (filter === undefined) return true
    if (typeof filter === 'string') return id === filter
    return !filter.in || filter.in.includes(id)
  }

  const staffUpdate = async (arg: StaffUpdate) => {
    staffUpdates.push(arg)
    const row = staffRows.find((s) => s.id === arg.where.id)
    if (!row) throw new Error(`staff ${arg.where.id} not found`)
    if (arg.data.shiftId !== undefined) row.shiftId = arg.data.shiftId
    return row
  }

  const assignmentCreate = async ({ data }: { data: AssignmentData }) => {
    if (assignments.some((a) => a.staffId === data.staffId && a.effectiveFrom === data.effectiveFrom)) {
      throw new Error('unique constraint (staffId, effectiveFrom)')
    }
    const row = { ...data }
    assignments.push(row)
    return row
  }

  const assignmentUpsert = async (arg: {
    where: { staffId_effectiveFrom: { staffId: string; effectiveFrom: string } }
    update: Partial<AssignmentData>
    create: AssignmentData
  }) => {
    const { staffId, effectiveFrom } = arg.where.staffId_effectiveFrom
    const row = assignments.find((a) => a.staffId === staffId && a.effectiveFrom === effectiveFrom)
    if (row) {
      Object.assign(row, arg.update)
      return row
    }
    return assignmentCreate({ data: arg.create })
  }

  const client = {
    staff: {
      findMany: async (args?: { where?: { id?: string | { in?: string[] } } }) =>
        staffRows.filter((s) => matchesId(s.id, args?.where?.id)),
      findUnique: async (args: { where: { id: string } }) => staffRows.find((s) => s.id === args.where.id) ?? null,
      update: staffUpdate,
    },
    shift: {
      findMany: async () => shiftRows,
      create: async ({ data }: { data: { name: string; startTime: string; endTime: string } }) => {
        const row = { id: `new-shift-${++shiftSeq}`, ...data }
        shiftRows.push(row)
        return row
      },
    },
    shiftSuggestion: {
      findMany: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }) =>
        sortBy(suggestions.filter((r) => matchesWhere(r, args?.where)), args?.orderBy),
      findFirst: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }) =>
        sortBy(suggestions.filter((r) => matchesWhere(r, args?.where)), args?.orderBy)[0] ?? null,
      count: async (args?: { where?: Record<string, unknown> }) =>
        suggestions.filter((r) => matchesWhere(r, args?.where)).length,
      create: async ({ data }: { data: Omit<SuggestionRow, 'id'> }) => {
        const now = new Date()
        const row = { id: `sug-${++suggestionSeq}`, createdAt: now, updatedAt: now, ...data }
        suggestions.push(row)
        return row
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<SuggestionRow> }) => {
        const row = suggestions.find((r) => r.id === where.id)
        if (!row) throw new Error(`suggestion ${where.id} not found`)
        Object.assign(row, data, { updatedAt: new Date() })
        return row
      },
      // Synchronous check-and-write, so overlapping callers cannot both claim a row
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<SuggestionRow> }) => {
        const rows = suggestions.filter((r) => matchesWhere(r, where))
        for (const r of rows) Object.assign(r, data, { updatedAt: new Date() })
        return { count: rows.length }
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const i = suggestions.findIndex((r) => r.id === where.id)
        if (i < 0) throw new Error(`suggestion ${where.id} not found`)
        return suggestions.splice(i, 1)[0]
      },
    },
    shiftAssignment: {
      findMany: async (args?: { where?: { staffId?: string } }) =>
        assignments.filter((a) => !args?.where?.staffId || a.staffId === args.where.staffId),
    },
    dailyRecord: {
      findMany: async (args?: { where?: { staffId?: string; date?: TimeFilter } }) =>
        (fixtures.dailyRecords ?? [])
          .filter((r) => !args?.where?.staffId || r.staffId === args.where.staffId)
          .filter((r) => inRange(r.date, args?.where?.date)),
    },
    policy: {
      findFirst: async () => policyRow,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        policyWrites.push({ op: 'create', data })
        policyRow = { ...data }
        return policyRow
      },
      update: async ({ data }: { where: { id?: string }; data: Record<string, unknown> }) => {
        policyWrites.push({ op: 'update', data })
        policyRow = { ...(policyRow ?? {}), ...data }
        return policyRow
      },
      // Synchronous check-and-write, so overlapping callers cannot both claim the run
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!policyRow || !matchesWhere(policyRow, where)) return { count: 0 }
        policyWrites.push({ op: 'update', data })
        policyRow = { ...policyRow, ...data }
        return { count: 1 }
      },
    },
    holiday: {
      findMany: async (args?: { where?: { date?: TimeFilter } }) =>
        fixtures.holidays.filter((h) => inRange(h.date, args?.where?.date)),
    },
    monthlyPayroll: {
      findMany: async (args?: { where?: { staffId?: string } }) =>
        fixtures.lockedPayrolls.filter((p) => !args?.where?.staffId || p.staffId === args.where.staffId),
    },
    attendanceLog: {
      findMany: async (args?: { where?: { timestamp?: TimeFilter; staffId?: string } }) => sortedLogs(args?.where),
      findFirst: async (args?: { where?: { timestamp?: TimeFilter } }) => sortedLogs(args?.where)[0] ?? null,
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        dailyRecord: {
          deleteMany: async (arg: unknown) => {
            deleteCalls.push(arg)
            return { count: 0 }
          },
          createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
            created.push(...data)
            return { count: data.length }
          },
        },
        shiftAssignment: { create: assignmentCreate, upsert: assignmentUpsert },
        staff: { update: staffUpdate },
      }),
  }

  return { client, created, deleteCalls, assignments, staffUpdates, shiftRows, suggestions, policyWrites }
}
