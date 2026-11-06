// Cloudflare R2 through its S3 API. Secrets live in Supabase (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET); the browser only ever sees presigned URLs.
import { AwsClient } from 'npm:aws4fetch@1.0.20'

const env = (name: string) => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} is not set`)
  return v
}

const client = new AwsClient({
  accessKeyId: env('R2_ACCESS_KEY_ID'),
  secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  service: 's3',
  region: 'auto',
})
const base = `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}`

// Keys are built by the clip_media insert trigger from ASCII-safe parts, but encode anyway.
const objectUrl = (key: string) => new URL(`${base}/${key.split('/').map(encodeURIComponent).join('/')}`)

async function presign(method: string, url: URL, seconds: number, headers: Record<string, string> = {}) {
  url.searchParams.set('X-Amz-Expires', String(seconds))
  // allHeaders: aws4fetch leaves Content-Type out of the signature unless told otherwise.
  const signed = await client.sign(new Request(url, { method, headers }), { aws: { signQuery: true, allHeaders: true } })
  return signed.url
}

async function call(method: string, url: URL, init: { body?: string; headers?: Record<string, string> } = {}) {
  const res = await client.fetch(url, { method, ...init })
  if (!res.ok && res.status !== 404) throw new Error(`R2 ${method} ${res.status}: ${await res.text()}`)
  return res
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]

// Upload URLs live longer than view URLs: a 2 GB upload on a slow line can take hours.
export const UPLOAD_URL_SECONDS = 6 * 3600
export const VIEW_URL_SECONDS = 3600

// Content-Type is signed, so the browser must send exactly this type.
export const presignPut = (key: string, mime: string) =>
  presign('PUT', objectUrl(key), UPLOAD_URL_SECONDS, { 'Content-Type': mime })

export function presignGet(key: string, fileName: string, download: boolean) {
  const url = objectUrl(key)
  // RFC 6266 / 5987: an ASCII fallback plus the real (Thai) name in UTF-8.
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_')
  url.searchParams.set(
    'response-content-disposition',
    `${download ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  )
  return presign('GET', url, VIEW_URL_SECONDS)
}

export async function createMultipart(key: string, mime: string) {
  const url = objectUrl(key)
  url.search = 'uploads'
  const xml = await (await call('POST', url, { headers: { 'Content-Type': mime } })).text()
  const uploadId = tag(xml, 'UploadId')
  if (!uploadId) throw new Error(`R2 CreateMultipartUpload: no UploadId in ${xml}`)
  return uploadId
}

export function presignPart(key: string, uploadId: string, partNumber: number) {
  const url = objectUrl(key)
  url.searchParams.set('partNumber', String(partNumber))
  url.searchParams.set('uploadId', uploadId)
  return presign('PUT', url, UPLOAD_URL_SECONDS)
}

export async function listParts(key: string, uploadId: string) {
  const url = objectUrl(key)
  url.searchParams.set('uploadId', uploadId)
  url.searchParams.set('max-parts', '1000')
  const res = await call('GET', url)
  if (res.status === 404) return null
  const xml = await res.text()
  return [...xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)].map(([, p]) => ({
    part_number: Number(tag(p, 'PartNumber')),
    etag: tag(p, 'ETag') ?? '',
    size: Number(tag(p, 'Size')),
  }))
}

export async function completeMultipart(key: string, uploadId: string, parts: { part_number: number; etag: string }[]) {
  const url = objectUrl(key)
  url.searchParams.set('uploadId', uploadId)
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const body = `<CompleteMultipartUpload>${[...parts]
    .sort((a, b) => a.part_number - b.part_number)
    .map((p) => `<Part><PartNumber>${p.part_number}</PartNumber><ETag>${esc(p.etag)}</ETag></Part>`)
    .join('')}</CompleteMultipartUpload>`
  const res = await call('POST', url, { body, headers: { 'Content-Type': 'application/xml' } })
  // S3 can answer 200 with an <Error> body.
  const xml = await res.text()
  if (res.status === 404 || xml.includes('<Error>')) throw new Error(`R2 CompleteMultipartUpload failed: ${xml}`)
}

export async function abortMultipart(key: string, uploadId: string) {
  const url = objectUrl(key)
  url.searchParams.set('uploadId', uploadId)
  await call('DELETE', url)
}

// null when the object does not exist.
export async function head(key: string) {
  const res = await call('HEAD', objectUrl(key))
  if (res.status === 404) return null
  return { size: Number(res.headers.get('content-length')), type: res.headers.get('content-type') ?? '' }
}

export async function remove(key: string) {
  await call('DELETE', objectUrl(key))
}
