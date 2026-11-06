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
}

type TimeFilter = { gte?: Date; lte?: Date }

export function createFakePrisma(fixtures: Fixtures): {
  client: unknown
  created: Record<string, unknown>[]
  deleteCalls: unknown[]
} {
  const created: Record<string, unknown>[] = []
  const deleteCalls: unknown[] = []

  const inRange = (t: Date, f?: TimeFilter) =>
    (!f?.gte || t.getTime() >= f.gte.getTime()) && (!f?.lte || t.getTime() <= f.lte.getTime())

  const sortedLogs = (where?: { timestamp?: TimeFilter; staffId?: string }) =>
    fixtures.logs
      .filter((l) => inRange(l.timestamp, where?.timestamp))
      .filter((l) => !where?.staffId || l.staffId === where.staffId)
      .map((l) => ({ id: l.id, staffId: l.staffId, timestamp: l.timestamp, type: l.type }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  const client = {
    staff: {
      findMany: async (args?: { where?: { id?: string } }) =>
        fixtures.staff.filter((s) => !args?.where?.id || s.id === args.where.id),
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
        (fixtures.assignments ?? []).filter((a) => !args?.where?.staffId || a.staffId === args.where.staffId),
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
      }),
  }

  return { client, created, deleteCalls }
}
