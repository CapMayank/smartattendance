/**
 * True when a dialog event was fired by the dialog whose handler is running. React 19 dispatches a
 * nested <dialog>'s `close` and `cancel` through every React ancestor, so an outer Modal must ignore
 * them or it closes together with a lightbox opened on top of it.
 */
export function isOwnDialogEvent(e: { target: unknown; currentTarget: unknown }): boolean {
  return e.target != null && e.target === e.currentTarget
}
