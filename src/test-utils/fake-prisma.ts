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
} {
  const created: Record<string, unknown>[] = []
  const deleteCalls: unknown[] = []
  const staffUpdates: StaffUpdate[] = []
  // Copies, so writes never leak into fixture objects shared between tests
  const staffRows = fixtures.staff.map((s) => ({ ...s }))
  const assignments: AssignmentRow[] = (fixtures.assignments ?? []).map((a) => ({ ...a }))

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
      findMany: async () => {
        if (fixtures.shifts) return fixtures.shifts
        const byId = new Map<string, NonNullable<Fixtures['staff'][number]['shift']>>()
        for (const s of fixtures.staff) if (s.shift) byId.set(s.shift.id, s.shift)
        return [...byId.values()]
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
    policy: { findFirst: async () => fixtures.policy },
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

  return { client, created, deleteCalls, assignments, staffUpdates }
}
