// One Uppy instance for the whole app, so an upload keeps going when the user leaves the clip page.
// The browser sends bytes straight to R2 through presigned URLs from the media-upload Edge Function;
// the server marks the row ready only after `complete` checks the object (see api/index.ts).
import Uppy from '@uppy/core'
import AwsS3 from '@uppy/aws-s3'
import * as api from '@/api/index'
import { MULTIPART_AT, PART_BYTES } from '@/lib/media'
import type { ClipMedia } from '@/lib/types'

export type UploadMeta = { clipId: string; purpose: ClipMedia['purpose']; mediaId?: string; single?: boolean; retries?: number }

type Up = Uppy<UploadMeta, Record<string, never>>
type UFile = NonNullable<ReturnType<Up['getFile']>>

export function createUploader(onReady: (m: ClipMedia) => void) {
  const uppy: Up = new Uppy({ autoProceed: true })
  // setFileMeta wants the whole meta object, so merge into the current one.
  const patchMeta = (id: string, p: Partial<UploadMeta>) => uppy.setFileState(id, { meta: { ...uppy.getFile(id)?.meta, ...p } as UFile['meta'] })
  const startArgs = (f: { name?: string; type?: string; size: number | null }) =>
    ({ name: f.name ?? 'file', type: f.type ?? '', size: f.size ?? 0 })

  uppy.use(AwsS3<UploadMeta, Record<string, never>>, {
    shouldUseMultipart: (file) => (file.size ?? 0) >= MULTIPART_AT,
    getChunkSize: () => PART_BYTES,
    limit: 3,

    async getUploadParameters(file: UFile) {
      const s = await api.startUpload(file.meta.clipId, file.meta.purpose, startArgs(file))
      if (s.mode !== 'single') throw new Error('เริ่มอัปโหลดไม่สำเร็จ ลองอีกครั้ง')
      patchMeta(file.id, { mediaId: s.media.id, single: true })
      return { method: 'PUT', url: s.url, headers: s.headers }
    },

    async createMultipartUpload(file: UFile) {
      const s = await api.startUpload(file.meta.clipId, file.meta.purpose, startArgs(file), { multipart: true })
      if (s.mode !== 'multipart') throw new Error('เริ่มอัปโหลดไม่สำเร็จ ลองอีกครั้ง')
      patchMeta(file.id, { mediaId: s.media.id })
      return { uploadId: s.upload_id, key: s.media.id }
    },

    async signPart(_file: UFile, { uploadId, key, partNumber }: { uploadId: string; key: string; partNumber: number }) {
      const urls = await api.signUploadParts(key, uploadId, [partNumber])
      return { url: urls[partNumber] }
    },

    async listParts(_file: UFile, { uploadId, key }: { uploadId?: string; key: string }) {
      if (!uploadId) throw new Error('ไม่พบการอัปโหลด')
      return (await api.listUploadParts(key, uploadId)).map((p) => ({ PartNumber: p.part_number, ETag: p.etag, Size: p.size }))
    },

    async completeMultipartUpload(_file: UFile, { uploadId, key, parts }: { uploadId?: string; key: string; parts: { PartNumber?: number; ETag?: string }[] }) {
      if (!uploadId) throw new Error('ไม่พบการอัปโหลด')
      const media = await api.completeUpload(key, {
        uploadId,
        parts: parts.map((p) => ({ part_number: p.PartNumber!, etag: p.ETag! })),
      })
      onReady(media)
      return {}
    },

    async abortMultipartUpload(_file: UFile, { uploadId, key }: { uploadId?: string; key: string }) {
      await api.abortUpload(key, uploadId)
    },
  })

  // A single PUT has no "complete" hook in Uppy: confirm with the server here. If the server
  // rejects the file (size/type differ from init), surface it as an upload error.
  uppy.on('upload-success', async (file) => {
    if (!file?.meta.single || !file.meta.mediaId) return
    try {
      onReady(await api.completeUpload(file.meta.mediaId))
    } catch (e) {
      uppy.emit('upload-error', file, e as Error)
    }
  })

  // Each automatic retry bumps the count shown as "ครั้งที่ N" (Figma 112:3691).
  uppy.on('upload-retry', (file) => patchMeta(file.id, { retries: (file.meta.retries ?? 0) + 1 }))

  // Cancelling a single upload leaves a pending row; drop it. Multipart is aborted by the plugin.
  uppy.on('file-removed', (file) => {
    if (file.meta.single && file.meta.mediaId && file.progress.uploadComplete !== true)
      void api.abortUpload(file.meta.mediaId).catch(() => {})
  })

  return uppy
}
