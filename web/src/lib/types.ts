// shortcut: hand-written rows, replace with Buddy's generated types when the backend connects.
export type Role = 'owner' | 'creator'
export type ClipStatus = 'todo' | 'submitted' | 'approved' | 'revision'

export interface Profile {
  id: string
  role: Role
  display_name: string
  email: string // assumption: not in profiles; the real value comes from auth
  created_at: string
}

export interface Category {
  id: string
  name: string
  position: number
  color: string // assumption: open question 1, ask Buddy to add
}

export interface Clip {
  id: string
  date: string // yyyy-MM-dd
  position: number
  category_id: string
  title: string
  script: string
  note: string
  created_by: string
  updated_at: string
  brief_updated_at: string // assumption: not in spec, see plan 2026-11-05 Part C
  status: ClipStatus // assumption: not in spec, confirm with client
  revision_note: string // assumption: not in spec
  deleted_at: string | null // agreed with Buddy (D3), not yet in spec
}

export interface ClipMedia {
  id: string
  clip_id: string
  kind: 'image' | 'video'
  purpose: 'reference' | 'submission'
  r2_key: string
  file_name: string // assumption: spec has only r2_key
  mime: string
  size_bytes: number
  status: 'pending' | 'ready'
  uploaded_by: string
  created_at: string
  expires_at: string
}

export type ClipCardRow = Clip & { imageCount: number }
export type ClipInput = Pick<Clip, 'date' | 'category_id' | 'title' | 'script' | 'note'>
