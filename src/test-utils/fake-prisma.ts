export type Fixtures = {
  staff: {
    id: string
    name: string
    shiftId: string | null
    createdAt?: Date
    shift: { id: string; name: string; startTime: string; endTime: string } | null
    machineId?: string
    profilePhotoId?: string | null
    profilePhotoPinned?: boolean
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
  dailyRecords?: { id?: string; staffId: string; date: Date; status: string; lateMinutes?: number; workMinutes?: number; checkIn?: Date | null; checkOut?: Date | null; overtimeMinutes?: number }[]
  /** Optional; stored shift suggestions. */
  suggestions?: SuggestionRow[]
  /** Optional; stored punch requests. */
  punchRequests?: PunchRequestRow[]
  /** Optional; stored users. */
  users?: UserRow[]
  /** Optional; stored system settings. */
  systemSettings?: { key: string; value: string }[]
}

export type UserRow = {
  id: string
  name: string
  email: string
  role: string
  disabledAt?: Date | null
  mustChangePassword?: boolean
  staffId?: string | null
  staff?: unknown
  approverDepartments?: { departmentId: string }[]
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

type TimeFilter = { gte?: Date; lte?: Date; lt?: Date; gt?: Date }
type AssignmentRow = {
  staffId: string
  effectiveFrom: string
  shiftId: string | null
  source?: string
  createdByUserId?: string | null
}
type AssignmentData = AssignmentRow & { source: string }
type StaffUpdate = {
  where: { id: string }
  data: { shiftId?: string | null; profilePhotoId?: string | null; profilePhotoPinned?: boolean }
}
export type PunchRequestRow = {
  id: string
  staffId: string
  date: string
  punchType: string
  requestedTime?: string | null
  requestedInTime?: string | null
  requestedOutTime?: string | null
  reason: string
  explanation?: string | null
  status: string
  decidedByUserId?: string | null
  decidedAt?: Date | null
  decisionRemarks?: string | null
  createdAt?: Date
  updatedAt?: Date
  staff?: {
    id: string
    name: string
    employeeCode?: string | null
    machineId?: string
    departmentId?: string | null
    department?: { id: string; name: string } | null
  }
}

export type PunchPhotoRow = {
  id: string
  staffId: string
  logId: string | null
  takenAt: Date
  data: Buffer
  isProfile: boolean
  createdAt?: Date
}

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
  /** Live punch photo rows (push to seed). */
  punchPhotos: PunchPhotoRow[]
  punchRequests: PunchRequestRow[]
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
  const punchPhotos: PunchPhotoRow[] = []
  let photoSeq = 0
  let suggestionSeq = 0
  const punchRequests: PunchRequestRow[] = (fixtures.punchRequests ?? []).map((r) => ({ ...r }))
  let punchRequestSeq = 0
  const shiftRows: { id: string; name: string; startTime: string; endTime: string }[] = (() => {
    if (fixtures.shifts) return fixtures.shifts.map((x) => ({ ...x }))
    const byId = new Map<string, NonNullable<Fixtures['staff'][number]['shift']>>()
    for (const s of fixtures.staff) if (s.shift) byId.set(s.shift.id, s.shift)
    return [...byId.values()].map((x) => ({ ...x }))
  })()

  const matchValue = (v: unknown, cond: unknown): boolean => {
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime()
    if (cond && typeof cond === 'object') {
      const c = cond as { lt?: Date | string; lte?: Date | string; gt?: Date | string; gte?: Date | string; in?: unknown[]; startsWith?: string }
      if (Array.isArray(c.in)) return c.in.includes(v)
      if (c.startsWith !== undefined && typeof v === 'string') return v.startsWith(c.startsWith)
      if (v === null || v === undefined) return false
      const a = v instanceof Date ? v.getTime() : (v as string)
      const val = (x: Date | string) => (x instanceof Date ? x.getTime() : x)
      if ('gte' in c && c.gte !== undefined && a < val(c.gte)) return false
      if ('gt' in c && c.gt !== undefined && a <= val(c.gt)) return false
      if ('lte' in c && c.lte !== undefined && a > val(c.lte)) return false
      if ('lt' in c && c.lt !== undefined && a >= val(c.lt)) return false
      if ('gte' in c || 'gt' in c || 'lte' in c || 'lt' in c) return true
    }
    return v === cond
  }
  const matchesWhere = (row: Record<string, unknown>, where?: Record<string, unknown>): boolean =>
    Object.entries(where ?? {}).every(([k, v]) => {
      if (k === 'OR') return (v as Record<string, unknown>[]).some((w) => matchesWhere(row, w))
      // PunchPhoto relation filter: `profileOf: { none: {} }` means no Staff points at this photo
      if (k === 'profileOf' && v && typeof v === 'object' && 'none' in v) {
        return !staffRows.some((s) => s.profilePhotoId === row.id)
      }
      if (k === 'staff' && v && typeof v === 'object') {
        const sRow = (row.staff ?? staffRows.find((s) => s.id === row.staffId)) as Record<string, unknown> | undefined
        if (!sRow) return false
        return matchesWhere(sRow, v as Record<string, unknown>)
      }
      return matchValue(row[k], v)
    })
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

const resolvePunchRequest = (
    r: PunchRequestRow,
    include?: { staff?: boolean | { include?: Record<string, boolean>; select?: Record<string, boolean> } }
  ) => {
    if (!include?.staff) return { ...r }
    const s = (r.staff ?? staffRows.find((x) => x.id === r.staffId))
    return {
      ...r,
      staff: s ? { ...s } : null,
    }
  }

  const inRange = (t: Date, f?: TimeFilter) =>
    (!f?.gte || t.getTime() >= f.gte.getTime()) && (!f?.gt || t.getTime() > f.gt.getTime()) && (!f?.lte || t.getTime() <= f.lte.getTime()) && (!f?.lt || t.getTime() < f.lt.getTime())

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
    if (arg.data.profilePhotoId !== undefined) row.profilePhotoId = arg.data.profilePhotoId
    if (arg.data.profilePhotoPinned !== undefined) row.profilePhotoPinned = arg.data.profilePhotoPinned
    return row
  }

  // Prisma treats an unset optional column as null; fixtures leave them undefined.
  const staffMatches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => {
      const actual = row[k] ?? (k === 'profilePhotoPinned' ? false : null)
      return v === null ? actual === null : matchValue(actual, v)
    })

  // P2002 mirrors Prisma's unique-constraint error code on PunchPhoto.logId.
  const punchPhotoCreate = async ({ data }: { data: Omit<PunchPhotoRow, 'id'> & { id?: string } }) => {
    if (data.logId && punchPhotos.some((p) => p.logId === data.logId)) {
      throw Object.assign(new Error('Unique constraint failed on the fields: (`logId`)'), { code: 'P2002' })
    }
    const row: PunchPhotoRow = {
      id: data.id ?? `photo-${++photoSeq}`,
      createdAt: new Date(),
      ...data,
      logId: data.logId ?? null,
      isProfile: data.isProfile ?? false,
    }
    punchPhotos.push(row)
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
    user: {
      findUnique: async (args: { where: { id?: string; email?: string } }) => {
        if (fixtures.users) {
          const u = fixtures.users.find(
            (usr) => (args.where.id && usr.id === args.where.id) || (args.where.email && usr.email === args.where.email)
          )
          if (u) {
            const staffObj = (u.staff ?? (u.staffId ? staffRows.find((s) => s.id === u.staffId) : null)) as Record<string, unknown> | null
            return {
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              disabledAt: u.disabledAt ?? null,
              mustChangePassword: u.mustChangePassword ?? false,
              staffId: u.staffId ?? null,
              staff: staffObj ? { ...staffObj, employmentPeriods: (staffObj.employmentPeriods as unknown[]) ?? [] } : null,
              approverDepartments: u.approverDepartments ?? [],
            }
          }
        }
        return {
          id: args.where.id ?? "u1",
          name: "Admin User",
          email: args.where.email ?? "admin@example.com",
          role: "ADMIN",
          disabledAt: null,
          mustChangePassword: false,
          staff: null,
          approverDepartments: [],
        }
      },
      findFirst: async () => null,
      findMany: async () => [],
      count: async () => 1,
    },
    staff: {
      findMany: async (args?: { where?: { id?: string | { in?: string[] } } }) =>
        staffRows.filter((s) => matchesId(s.id, args?.where?.id)),
      findUnique: async (args: { where: { id: string } }) => {
        const row = staffRows.find((s) => s.id === args.where.id)
        return row ? { ...row } : null // a snapshot, like Prisma, never the live row
      },
      update: staffUpdate,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: StaffUpdate['data'] }) => {
        const rows = staffRows.filter((r) => staffMatches(r as unknown as Record<string, unknown>, where))
        for (const r of rows) await staffUpdate({ where: { id: r.id }, data })
        return { count: rows.length }
      },
      count: async (args?: { where?: Record<string, unknown> }) =>
        staffRows.filter((r) => matchesWhere(r as unknown as Record<string, unknown>, args?.where)).length,
    },
    shift: {
      findMany: async () => shiftRows,
      findUnique: async (args: { where: { id: string } }) => shiftRows.find((r) => r.id === args.where.id) ?? null,
      delete: async ({ where }: { where: { id: string } }) => {
        const i = shiftRows.findIndex((r) => r.id === where.id)
        if (i < 0) throw new Error(`shift ${where.id} not found`)
        return shiftRows.splice(i, 1)[0]
      },
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
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const doomed = suggestions.filter((r) => matchesWhere(r, where))
        for (const r of doomed) suggestions.splice(suggestions.indexOf(r), 1)
        return { count: doomed.length }
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
      count: async (args?: { where?: Record<string, unknown> }) =>
        assignments.filter((a) => matchesWhere(a as unknown as Record<string, unknown>, args?.where)).length,
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
    punchPhoto: {
      create: punchPhotoCreate,
      findUnique: async ({ where }: { where: { id: string } }) => punchPhotos.find((p) => p.id === where.id) ?? null,
      findFirst: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }) =>
        sortBy(punchPhotos.filter((p) => matchesWhere(p, args?.where)), args?.orderBy)[0] ?? null,
      findMany: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'>; take?: number }) =>
        sortBy(punchPhotos.filter((p) => matchesWhere(p, args?.where)), args?.orderBy).slice(0, args?.take),
      delete: async ({ where }: { where: { id: string } }) => {
        const i = punchPhotos.findIndex((p) => p.id === where.id)
        if (i < 0) throw Object.assign(new Error(`punchPhoto ${where.id} not found`), { code: 'P2025' })
        return punchPhotos.splice(i, 1)[0]
      },
      deleteMany: async ({ where }: { where?: Record<string, unknown> } = {}) => {
        const doomed = punchPhotos.filter((p) => matchesWhere(p, where))
        for (const p of doomed) punchPhotos.splice(punchPhotos.indexOf(p), 1)
        return { count: doomed.length }
      },
    },
    holiday: {
      findMany: async (args?: { where?: { date?: TimeFilter } }) =>
        fixtures.holidays.filter((h) => inRange(h.date, args?.where?.date)),
    },
    monthlyPayroll: {
      findUnique: async (args: { where: { staffId_month_year: { staffId: string; month: number; year: number } } }) => {
        const { staffId, month, year } = args.where.staffId_month_year
        const row = fixtures.lockedPayrolls.find((p) => p.staffId === staffId && p.month === month && p.year === year)
        return row ? { ...row, isLocked: true } : null
      },
      findFirst: async (args?: { where?: { staffId?: string; month?: number; year?: number; isLocked?: boolean } }) => {
        const row = fixtures.lockedPayrolls.find(
          (p) =>
            (!args?.where?.staffId || p.staffId === args.where.staffId) &&
            (!args?.where?.month || p.month === args.where.month) &&
            (!args?.where?.year || p.year === args.where.year)
        )
        return row ? { ...row, isLocked: true } : null
      },
      findMany: async (args?: { where?: { staffId?: string } }) =>
        fixtures.lockedPayrolls.filter((p) => !args?.where?.staffId || p.staffId === args.where.staffId).map((p) => ({ ...p, isLocked: true })),
    },
    punchRequest: {
      findMany: async (args?: {
        where?: Record<string, unknown>
        orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[]
        include?: { staff?: boolean | Record<string, unknown> }
        take?: number
        skip?: number
      }) => {
        let rows = punchRequests.filter((r) => matchesWhere(r as unknown as Record<string, unknown>, args?.where))
        if (args?.orderBy) {
          const order = Array.isArray(args.orderBy) ? args.orderBy[0] : args.orderBy
          rows = sortBy(rows, order)
        }
        if (args?.skip) rows = rows.slice(args.skip)
        if (args?.take) rows = rows.slice(0, args.take)
        return rows.map((r) => resolvePunchRequest(r, args?.include))
      },
      findUnique: async (args: { where: { id: string }; include?: { staff?: boolean | Record<string, unknown> } }) => {
        const row = punchRequests.find((r) => r.id === args.where.id)
        return row ? resolvePunchRequest(row, args?.include) : null
      },
      findFirst: async (args?: {
        where?: Record<string, unknown>
        orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[]
        include?: { staff?: boolean | Record<string, unknown> }
      }) => {
        let rows = punchRequests.filter((r) => matchesWhere(r as unknown as Record<string, unknown>, args?.where))
        if (args?.orderBy) {
          const order = Array.isArray(args.orderBy) ? args.orderBy[0] : args.orderBy
          rows = sortBy(rows, order)
        }
        const row = rows[0] ?? null
        return row ? resolvePunchRequest(row, args?.include) : null
      },
      count: async (args?: { where?: Record<string, unknown> }) =>
        punchRequests.filter((r) => matchesWhere(r as unknown as Record<string, unknown>, args?.where)).length,
      create: async ({
        data,
        include,
      }: {
        data: Omit<PunchRequestRow, 'id' | 'status'> & { id?: string; status?: string }
        include?: { staff?: boolean | Record<string, unknown> }
      }) => {
        const now = new Date()
        const row: PunchRequestRow = {
          id: data.id ?? `pr-${++punchRequestSeq}`,
          createdAt: now,
          updatedAt: now,

          status: data.status ?? 'PENDING',
          requestedTime: null,
          requestedInTime: null,
          requestedOutTime: null,
          explanation: null,
          decidedByUserId: null,
          decidedAt: null,
          decisionRemarks: null,
          ...data,
        }
        punchRequests.push(row)
        return resolvePunchRequest(row, include)
      },
      update: async ({
        where,
        data,
        include,
      }: {
        where: { id: string }
        data: Partial<PunchRequestRow>
        include?: { staff?: boolean | Record<string, unknown> }
      }) => {
        const row = punchRequests.find((r) => r.id === where.id)
        if (!row) throw new Error(`punchRequest ${where.id} not found`)
        Object.assign(row, data, { updatedAt: new Date() })
        return resolvePunchRequest(row, include)
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<PunchRequestRow> }) => {
        const rows = punchRequests.filter((r) => matchesWhere(r as unknown as Record<string, unknown>, where))
        for (const r of rows) Object.assign(r, data, { updatedAt: new Date() })
        return { count: rows.length }
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const i = punchRequests.findIndex((r) => r.id === where.id)
        if (i < 0) throw new Error(`punchRequest ${where.id} not found`)
        return punchRequests.splice(i, 1)[0]
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const doomed = punchRequests.filter((r) => matchesWhere(r as unknown as Record<string, unknown>, where))
        for (const r of doomed) punchRequests.splice(punchRequests.indexOf(r), 1)
        return { count: doomed.length }
      },
    },
    systemSetting: {
      findUnique: async (args: { where: { key: string } }) => {
        const st = (fixtures.systemSettings ?? []).find((x) => x.key === args.where.key)
        return st ? { id: `ss-${st.key}`, ...st } : null
      },
      findFirst: async (args?: { where?: { key?: string } }) => {
        const st = (fixtures.systemSettings ?? []).find((x) => !args?.where?.key || x.key === args.where.key)
        return st ? { id: `ss-${st.key}`, ...st } : null
      },
      findMany: async () => (fixtures.systemSettings ?? []).map((st) => ({ id: `ss-${st.key}`, ...st })),
      upsert: async ({ where, create, update }: { where: { key: string }; create: { key: string; value: string }; update: { value: string } }) => {
        let st = (fixtures.systemSettings ?? []).find((x) => x.key === where.key)
        if (st) {
          st.value = update.value
        } else {
          st = { ...create, key: where.key }
          if (fixtures.systemSettings) fixtures.systemSettings.push(st)
        }
        return { id: `ss-${st.key}`, ...st }
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: `audit-${Date.now()}`,
        at: new Date(),
        ...data,
      }),
      findMany: async () => [],
    },
    attendanceLog: {
      findMany: async (args?: {
        where?: { timestamp?: TimeFilter; staffId?: string }
        include?: { photo?: { select?: { id?: boolean } } }
        orderBy?: { timestamp?: 'asc' | 'desc' } | Array<{ timestamp?: 'asc' | 'desc' }>
        take?: number
      }) => {
        let logs = sortedLogs(args?.where)
        if (args?.orderBy) {
          const isDesc = Array.isArray(args.orderBy) ? args.orderBy.some((o) => o.timestamp === 'desc') : args.orderBy?.timestamp === 'desc'
          if (isDesc) logs = [...logs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        }
        if (typeof args?.take === 'number') logs = logs.slice(0, args.take)
        if (!args?.include?.photo) return logs
        // Mirrors `include: { photo: { select: { id: true } } }`: only the linked photo's id, never its bytes.
        return logs.map((l) => {
          const photo = punchPhotos.find((p) => p.logId === l.id)
          return { ...l, photo: photo ? { id: photo.id } : null }
        })
      },
      findFirst: async (args?: { where?: { timestamp?: TimeFilter; staffId?: string } }) => sortedLogs(args?.where)[0] ?? null,
      create: async ({ data }: { data: { staffId: string; timestamp: Date; type: string; id?: string } }) => {
        const row = { id: data.id ?? `log-${fixtures.logs.length + 1}`, ...data }
        fixtures.logs.push(row)
        return row
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      // Roll back photo rows and staff photo pointers when the callback throws.
      const photoSnapshot = punchPhotos.map((p) => ({ ...p }))
      const pointerSnapshot = staffRows.map((s) => ({
        id: s.id,
        profilePhotoId: s.profilePhotoId,
        profilePhotoPinned: s.profilePhotoPinned,
      }))
      try {
        return await runTransaction(fn)
      } catch (e) {
        punchPhotos.splice(0, punchPhotos.length, ...photoSnapshot)
        for (const snap of pointerSnapshot) {
          const row = staffRows.find((s) => s.id === snap.id)
          if (row) {
            row.profilePhotoId = snap.profilePhotoId
            row.profilePhotoPinned = snap.profilePhotoPinned
          }
        }
        throw e
      }
    },
  }

  const runTransaction = (fn: (tx: unknown) => Promise<unknown>) =>
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
        staff: {
          update: staffUpdate,
          // Delegate at call time so tests can override the client methods.
          findUnique: (arg: { where: { id: string } }) => client.staff.findUnique(arg),
          updateMany: (arg: { where: Record<string, unknown>; data: StaffUpdate['data'] }) =>
            client.staff.updateMany(arg),
        },
        get user() { return client.user },
        get punchPhoto() {
          return client.punchPhoto
        },
        get punchRequest() {
          return client.punchRequest
        },
        get attendanceLog() {
          return client.attendanceLog
        },
        get monthlyPayroll() {
          return client.monthlyPayroll
        },
        get systemSetting() {
          return client.systemSetting
        },
        get auditLog() {
          return client.auditLog
        },
      })

  return { client, created, deleteCalls, assignments, staffUpdates, shiftRows, suggestions, policyWrites, punchPhotos, punchRequests }
}
