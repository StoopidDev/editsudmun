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

export type ClipCardRow = Clip & { imageCount: number }
export type ClipInput = Pick<Clip, 'date' | 'category_id' | 'title' | 'script' | 'note'>
