/** JPEG response for stored photo bytes (copied into a plain Uint8Array for the Response body). */
export function jpegResponse(data: Uint8Array): Response {
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
