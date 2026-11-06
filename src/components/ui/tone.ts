export type Tone = "present" | "late" | "absent" | "leave" | "accent";

export const toneClass: Record<Tone | "muted", string> = {
  present: "tone-present",
  late: "tone-late",
  absent: "tone-absent",
  leave: "tone-leave",
  accent: "tone-accent",
  muted: "tone-muted",
};

export const toneVar: Record<Tone, string> = {
  present: "var(--color-present)",
  late: "var(--color-late)",
  absent: "var(--color-absent)",
  leave: "var(--color-leave)",
  accent: "var(--color-acc-2)",
};
