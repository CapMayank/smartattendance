// Pure decision for the Shift cell of a CSV staff import row.

export type CsvShiftDecision = { action: "keep" } | { action: "set"; shiftId: string }

/**
 * A new teacher gets the named shift, else the default. An existing teacher changes shift only
 * when the cell names a known shift different from their current one; a missing, blank or
 * unknown cell keeps their shift.
 */
export function resolveCsvShift(args: {
  isNew: boolean
  existingShiftId: string | null
  shiftCell: unknown
  shiftsByName: ReadonlyMap<string, string>
  defaultShiftId: string
}): CsvShiftDecision {
  const name = typeof args.shiftCell === "string" ? args.shiftCell.trim() : ""
  const known = name ? args.shiftsByName.get(name) : undefined
  if (args.isNew) return { action: "set", shiftId: known ?? args.defaultShiftId }
  if (known === undefined || known === args.existingShiftId) return { action: "keep" }
  return { action: "set", shiftId: known }
}
