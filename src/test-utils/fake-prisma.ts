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

  const sortedLogs = (where?: { timestamp?: TimeFilter }) =>
    fixtures.logs
      .filter((l) => inRange(l.timestamp, where?.timestamp))
      .map((l) => ({ id: l.id, staffId: l.staffId, timestamp: l.timestamp, type: l.type }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  const client = {
    staff: { findMany: async () => fixtures.staff },
    policy: { findFirst: async () => fixtures.policy },
    holiday: {
      findMany: async (args?: { where?: { date?: TimeFilter } }) =>
        fixtures.holidays.filter((h) => inRange(h.date, args?.where?.date)),
    },
    monthlyPayroll: { findMany: async () => fixtures.lockedPayrolls },
    attendanceLog: {
      findMany: async (args?: { where?: { timestamp?: TimeFilter } }) => sortedLogs(args?.where),
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
