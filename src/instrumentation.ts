export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureSchoolTimezone } = await import("./lib/timezone")
    ensureSchoolTimezone(process.env)
  }
}
