// Row types come from the generated web/src/types/database.ts (regenerate with `npm run types`
// in supabase/, never edit it by hand). Text columns with a check constraint are generated as
// string, so they are narrowed here to the values the constraints allow.
import type { Tables } from '@/types/database'

export type Role = 'owner' | 'creator'
export type ClipStatus = 'todo' | 'submitted' | 'approved' | 'revision'

type Narrow<T, O> = Omit<T, keyof O> & O

export type Profile = Narrow<Tables<'profiles'>, { role: Role }>
export type Category = Tables<'categories'>
// created_by is null once the author's account is deleted; round goes up on each revision request.
export type Clip = Narrow<Tables<'clips'>, { status: ClipStatus }>
// uploaded_by is null once the uploader's account is deleted (uploader_name keeps the name);
// ready_at is when the upload finished and the 10-minute withdraw window starts.
export type ClipMedia = Narrow<
  Tables<'clip_media'>,
  { kind: 'image' | 'video'; purpose: 'reference' | 'submission'; status: 'pending' | 'ready' }
>

// What each list reads (the select strings in api/index.ts match these; the typed client checks them).
export type ClipCardRow = Pick<Clip, 'id' | 'date' | 'position' | 'category_id' | 'status' | 'title' | 'script' | 'note'> & { imageCount: number }
// One row per day and category (RPC clip_day_counts); n is the number of live clips.
export type ClipDayCount = Pick<Clip, 'date' | 'category_id'> & { n: number }
export type ClipRecent = Pick<Clip, 'id' | 'title' | 'category_id' | 'brief_updated_at'>
export type ClipSearchRow = Pick<Clip, 'id' | 'date' | 'category_id' | 'title' | 'script' | 'note'>
export type ClipInput = Pick<Clip, 'date' | 'category_id' | 'title' | 'script' | 'note'>
