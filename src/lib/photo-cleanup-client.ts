/** Fire-and-forget retention trigger for the Staff page; never throws, never reports. */
export function triggerPhotoCleanup(): void {
  try {
    fetch('/api/photos/cleanup', { method: 'POST' }).catch(() => {})
  } catch {
    // ignored on purpose: cleanup is best effort
  }
}
