// Upload rules. web/src/lib/media.ts mirrors these for early checks in the browser; the
// server is the one that decides. Spec §1: finished edits are H.264 ≤1080p, 2 GB per file by
// default (confirm with the client).
export const MAX_VIDEO_BYTES = Number(Deno.env.get('MEDIA_MAX_VIDEO_BYTES') ?? 2 * 1024 ** 3)
export const MAX_IMAGE_BYTES = 50 * 1024 ** 2

// Files at or above this go multipart (spec §6.1). A client may also ask for multipart on
// smaller files, down to the 5 MB S3 minimum part size.
export const MULTIPART_THRESHOLD = 100 * 1024 ** 2
export const MIN_PART_BYTES = 5 * 1024 ** 2
const PART_BYTES = 50 * 1024 ** 2

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
// quicktime covers ProRes .mov: allowed, but browsers cannot play it (the UI offers download).
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/x-m4v']

export const kindOf = (mime: string) =>
  IMAGE_TYPES.includes(mime) ? 'image' : VIDEO_TYPES.includes(mime) ? 'video' : null

export const maxBytes = (kind: 'image' | 'video') => (kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)

export function partPlan(size: number, wantMultipart: boolean) {
  const multipart = size >= MULTIPART_THRESHOLD || (wantMultipart && size > MIN_PART_BYTES)
  if (!multipart) return null
  const part_size = size >= MULTIPART_THRESHOLD ? PART_BYTES : MIN_PART_BYTES
  return { part_size, part_count: Math.ceil(size / part_size) }
}
