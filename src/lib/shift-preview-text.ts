import type { PreviewSummary } from "./shift-change"

const WORDS: Record<string, string> = {
  ON_TIME: "on time",
  LATE: "late",
  HALF_DAY: "half day",
  ABSENT: "absent",
  PRESENT: "present",
  HOLIDAY: "holiday",
  WEEKOFF: "week off",
  NONE: "no record",
}

function word(key: string): string {
  return WORDS[key] ?? key.toLowerCase().replace(/_/g, " ")
}

/** "LATE->ON_TIME" becomes "late → on time". */
export function transitionLabel(key: string): string {
  const [from, to] = key.split("->")
  return to === undefined ? word(key) : `${word(from)} → ${word(to)}`
}

/** Transitions that actually move a day to a different label, biggest first. */
export function transitionRows(transitions: Record<string, number>): { label: string; count: number }[] {
  return Object.entries(transitions)
    .filter(([key, n]) => {
      const [from, to] = key.split("->")
      return n > 0 && from !== to
    })
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ label: transitionLabel(key), count }))
}

export function previewHeadline(s: PreviewSummary): string {
  const days = `${s.recalculatedDays} working ${s.recalculatedDays === 1 ? "day" : "days"} recalculated`
  return `${days} · ${s.changedDays} change`
}
