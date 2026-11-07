/** Profile picture url for a teacher, cache-busted by the photo id; undefined when there is none. */
export function staffPhotoUrl(staff: { id: string; profilePhotoId?: string | null }): string | undefined {
  if (!staff.profilePhotoId) return undefined
  return `/api/staff/${encodeURIComponent(staff.id)}/photo?v=${encodeURIComponent(staff.profilePhotoId)}`
}

/** Url of one punch photo; undefined when the punch has none. */
export function punchPhotoUrl(photoId: string | null | undefined): string | undefined {
  if (!photoId) return undefined
  return `/api/photos/${encodeURIComponent(photoId)}`
}
