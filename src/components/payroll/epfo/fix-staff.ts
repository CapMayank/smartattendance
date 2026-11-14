/**
 * Resolve the FULL staff record for the profile "Fix details" modal.
 * A partial EPFO member row has no linked user, so opening the modal from it
 * and saving could reset the person's role/email. Never fall back to it.
 */
export async function resolveFixStaff(
  staffId: string,
  cached: any[],
  fetchAll: () => Promise<any[]>
): Promise<{ staff: any | null; list: any[] }> {
  const hit = cached.find((s) => s.id === staffId);
  if (hit) return { staff: hit, list: cached };
  try {
    const list = await fetchAll();
    return { staff: list.find((s) => s.id === staffId) ?? null, list };
  } catch {
    return { staff: null, list: cached };
  }
}
