// One Uppy instance for the whole app, so an upload keeps going when the user leaves the clip page.
// The browser sends bytes straight to R2 through presigned URLs from the media-upload Edge Function;
// the server marks the row ready only after `complete` checks the object (see api/index.ts).
import Uppy from '@uppy/core'
import AwsS3 from '@uppy/aws-s3'
import * as api from '@/api/index'
import { MULTIPART_AT, PART_BYTES, partNumbers } from '@/lib/media'
import type { ClipMedia } from '@/lib/types'

export type UploadMeta = { clipId: string; purpose: ClipMedia['purpose']; mediaId?: string; uploadId?: string; single?: boolean; retries?: number }

type Up = Uppy<UploadMeta, Record<string, never>>
type UFile = NonNullable<ReturnType<Up['getFile']>>

// Retry a file. A multipart file with an uploadId resumes: Uppy's aws-s3 plugin reads `s3Multipart`
// and calls listParts, so only the parts R2 lacks are sent again.
function keepResumable(uppy: Up, id: string) {
  const f = uppy.getFile(id)
  if (f?.meta.uploadId && f.meta.mediaId)
    uppy.setFileState(id, { s3Multipart: { uploadId: f.meta.uploadId, key: f.meta.mediaId } } as Partial<UFile & { s3Multipart: { uploadId: string; key: string } }>)
}

export function retryFile(uppy: Up, id: string) {
  keepResumable(uppy, id)
  void uppy.retryUpload(id)
}

export function createUploader(onReady: (m: ClipMedia) => void) {
  const uppy: Up = new Uppy({ autoProceed: true })
  // setFileMeta wants the whole meta object, so merge into the current one.
  const patchMeta = (id: string, p: Partial<UploadMeta>) => uppy.setFileState(id, { meta: { ...uppy.getFile(id)?.meta, ...p } as UFile['meta'] })
  const startArgs = (f: { name?: string; type?: string; size: number | null }) =>
    ({ name: f.name ?? 'file', type: f.type ?? '', size: f.size ?? 0 })
  // Cancelled while the server was creating the row: file-removed saw no mediaId yet, so abort here.
  const dropIfCancelled = (id: string, mediaId: string, uploadId?: string) => {
    if (uppy.getFile(id)) return
    void api.abortUpload(mediaId, uploadId).catch(() => {})
    throw new Error('ยกเลิกแล้ว')
  }
  // Presigned part URLs per media key, signed in one call (the promise is shared by concurrent parts).
  const partUrls = new Map<string, Promise<Record<number, string>>>()

  // Uppy marks a file done when its bytes are in. A single PUT stays "not done" until our complete call confirms.
  const markDone = (id: string, done: boolean) => {
    const f = uppy.getFile(id)
    if (f) uppy.setFileState(id, { progress: { ...f.progress, uploadComplete: done, complete: done } as UFile['progress'] })
  }
  const failWith = (id: string, e: unknown) => {
    markDone(id, false)
    if (uppy.getFile(id)) uppy.setFileState(id, { error: (e instanceof Error && e.message) || 'ยืนยันไฟล์ไม่สำเร็จ ลองอีกครั้ง' })
  }

  uppy.use(AwsS3<UploadMeta, Record<string, never>>, {
    shouldUseMultipart: (file) => (file.size ?? 0) >= MULTIPART_AT,
    getChunkSize: () => PART_BYTES,
    limit: 3,

    async getUploadParameters(file: UFile) {
      // A retry or resume makes a new row; drop the one the failed attempt left behind.
      if (file.meta.mediaId) void api.abortUpload(file.meta.mediaId).catch(() => {})
      const s = await api.startUpload(file.meta.clipId, file.meta.purpose, startArgs(file))
      if (s.mode !== 'single') throw new Error('เริ่มอัปโหลดไม่สำเร็จ ลองอีกครั้ง')
      dropIfCancelled(file.id, s.media.id)
      patchMeta(file.id, { mediaId: s.media.id, single: true })
      return { method: 'PUT', url: s.url, headers: s.headers }
    },

    async createMultipartUpload(file: UFile) {
      const s = await api.startUpload(file.meta.clipId, file.meta.purpose, startArgs(file), { multipart: true })
      if (s.mode !== 'multipart') throw new Error('เริ่มอัปโหลดไม่สำเร็จ ลองอีกครั้ง')
      dropIfCancelled(file.id, s.media.id, s.upload_id)
      patchMeta(file.id, { mediaId: s.media.id, uploadId: s.upload_id })
      return { uploadId: s.upload_id, key: s.media.id }
    },

    async signPart(file: UFile, { uploadId, key, partNumber }: { uploadId: string; key: string; partNumber: number }) {
      let signed = partUrls.get(key)
      if (!signed) {
        signed = api.signUploadParts(key, uploadId, partNumbers(file.size ?? 0)).catch((e: unknown) => { partUrls.delete(key); throw e })
        partUrls.set(key, signed)
      }
      const urls = await signed
      return { url: urls[partNumber] ?? (await api.signUploadParts(key, uploadId, [partNumber]))[partNumber] }
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
      partUrls.delete(key)
      onReady(media)
      return {}
    },

    // Uppy calls this on any error too, not only on cancel. Keeping the server upload is what makes
    // a retry resume; the real abort happens in file-removed.
    async abortMultipartUpload() {
      return
    },
  })

  // A single PUT has no "complete" hook in Uppy: confirm with the server here. Uppy has already
  // marked the file uploaded, so flip it back until the server answers. Multipart is complete by now.
  uppy.on('upload-success', async (file) => {
    if (!file || !uppy.getFile(file.id)) return
    if (file.meta.single && file.meta.mediaId) {
      markDone(file.id, false)
      try {
        onReady(await api.completeUpload(file.meta.mediaId))
      } catch (e) {
        failWith(file.id, e)
        return
      }
      markDone(file.id, true)
    }
    if (uppy.getFile(file.id)) uppy.removeFile(file.id)
  })

  // Uppy clears s3Multipart on any error, so every retry path (row button, retryAll on 'online',
  // the retry Uppy runs when another file is added) would start over. Put it back to resume.
  uppy.on('upload-error', (file) => { if (file) keepResumable(uppy, file.id) })

  // Each automatic retry bumps the count shown as "ครั้งที่ N" (Figma 112:3691).
  uppy.on('upload-retry', (file) => patchMeta(file.id, { retries: (file.meta.retries ?? 0) + 1 }))

  // Cancel or "ยกเลิกไฟล์นี้" on an unfinished file: abort the server row (and the R2 multipart).
  // Finished files are removed by us after success, so they are skipped.
  uppy.on('file-removed', (file) => {
    if (file.progress.complete) return
    if (file.meta.mediaId) {
      partUrls.delete(file.meta.mediaId)
      void api.abortUpload(file.meta.mediaId, file.meta.uploadId).catch(() => {})
    }
  })

  return uppy
}
