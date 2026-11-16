import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Copy, Trash2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import * as api from '@/api/index'
import { useAct, useCategories, useClip, useDeleteClip, useMedia } from '@/api/queries'
import { BackButton } from '@/components/BackButton'
import { ClipPager } from '@/components/ClipPager'
import { CopyDialog } from '@/components/CopyDialog'
import { ConfirmDialog, Delayed, FileTile, Skeleton } from '@/components/bits'
import { DateField } from '@/components/DateField'
import { MarkdownField } from '@/components/MarkdownField'
import { DownloadAll } from '@/components/media'
import { useLightbox } from '@/components/useLightbox'
import { UploadZone } from '@/components/UploadZone'
import { dialogOpen, shortcutKey } from '@/lib/shortcut'
import { Ctx } from '@/lib/upload-state'
import { useViewUrls, viewables } from '@/lib/viewer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isIsoDate, todayIso } from '@/lib/dates'
import { clearDraft, isBlank, readDraft, sameBrief, writeDraft } from '@/lib/draft'
import { daysLeft, readyIds, WARN_DAYS } from '@/lib/media'
import type { ClipInput, ClipMedia } from '@/lib/types'
import { useLast } from '@/lib/useLast'
import { Review } from './Review'
import { toast } from 'sonner'

export function ClipForm({ clipId }: { clipId?: string }) {
  const { data: clip, isPending } = useClip(clipId ?? '')
  const { key } = useLocation()
  if (clipId && isPending) return (
    <Delayed>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3"><Skeleton className="h-9 w-2/3" /><Skeleton className="h-64" /></div>
        <div className="flex w-full flex-col gap-3 md:w-80"><Skeleton className="h-32" /><Skeleton className="h-40" /></div>
      </div>
    </Delayed>
  )
  if (clipId && !clip) return <p>ไม่พบคลิป <Link viewTransition to="/calendar" className="link-action"><ArrowLeft size={14} aria-hidden />กลับปฏิทิน</Link></p>
  return <Form key={clipId ?? key} clipId={clipId} initial={clip ?? undefined} />
}

function Form({ clipId, initial }: { clipId?: string; initial?: ClipInput }) {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const urlDate = params.get('date')
  const explicitDate = urlDate && isIsoDate(urlDate) ? urlDate : null
  const { data: cats = [], isSuccess: catsLoaded } = useCategories()
  const { data: media = [] } = useMedia(clipId ?? '')
  const urls = useViewUrls(readyIds(media))
  const lb = useLightbox()
  const [form, setForm] = useState<ClipInput>(initial
    ? { date: initial.date, category_id: initial.category_id, title: initial.title, script: initial.script, note: initial.note }
    : { date: explicitDate ?? todayIso(), category_id: params.get('cat') ?? '', title: '', script: '', note: '' })
  const [titleError, setTitleError] = useState(false)
  const [draft, setDraft] = useState(() => {
    const saved = readDraft(clipId)
    return saved && initial && sameBrief(saved, initial) ? null : saved
  })
  const [copying, setCopying] = useState(false)
  const [saving, setSaving] = useState<'save' | 'more' | null>(null)
  // The save button says so for 1.5 s after a successful save: the answer sits where the eye is.
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 1500)
    return () => clearTimeout(t)
  }, [saved])
  // Files dropped before a new clip exists; they belong to this unsaved form only.
  const [parked, setParked] = useState<File[]>([])
  const hub = useContext(Ctx)
  // The create in flight, so a drop and a save click make one clip.
  const pending = useRef<Promise<string | null> | null>(null)
  const [deletingFile, setDeletingFile] = useState<ClipMedia | null>(null)
  const lastFile = useLast(deletingFile)
  const del = useDeleteClip(() => nav(`/calendar?date=${form.date}`, { viewTransition: true }))
  const removeFile = useAct(api.deleteMedia)
  const save = useAct((input: ClipInput) => (clipId ? api.updateClip(clipId, input) : api.createClip(input)))

  const categoryId = cats.some((c) => c.id === form.category_id) ? form.category_id : (cats[0]?.id ?? '')
  const set = (patch: Partial<ClipInput>) => {
    setSaved(false)
    setForm((f) => ({ ...f, ...patch }))
  }

  const pristine = initial ? sameBrief(form, initial) : isBlank(form)

  // Written on every change, not debounced: leaving right after typing must not lose the text.
  useEffect(() => {
    if (draft) return
    if (pristine) clearDraft(clipId)
    else writeDraft(form, clipId)
  }, [form, pristine, clipId, draft])

  // A new clip is created by its first file (D2) or its first save. Without a title nothing is created.
  const createNew = async (): Promise<string | null> => {
    if (!isIsoDate(form.date)) { toast.error('วันที่ไม่ถูกต้อง'); return null }
    if (!form.title.trim()) { setTitleError(true); document.getElementById('title')?.focus(); return null }
    const { date, script, note } = form
    try {
      const c = await save.mutateAsync({ date, script, note, category_id: categoryId, title: form.title.trim() })
      clearDraft(undefined)
      if (hub && parked.length) {
        const refused = hub.add(parked, c.id, 'reference')
        if (refused.length) toast.error(refused[0].message)
      }
      setParked([])
      nav(`/clips/${c.id}`, { replace: true, viewTransition: true })
      return c.id
    } catch {
      setParked([]) // useAct already showed the error
      return null
    }
  }

  const ensureClip = (): Promise<string | null> => {
    if (clipId) return Promise.resolve(clipId)
    pending.current ??= createNew().finally(() => { pending.current = null })
    return pending.current
  }

  const submit = (addAnother = false) => {
    if (!isIsoDate(form.date)) { toast.error('วันที่ไม่ถูกต้อง'); return }
    if (!form.title.trim()) { setTitleError(true); document.getElementById('title')?.focus(); return }
    setSaving(addAnother ? 'more' : 'save')
    if (!clipId) {
      void ensureClip()
        .then((id) => {
          if (!id) return
          toast.success('บันทึกแล้ว')
          if (addAnother) nav(`/clips/new?date=${form.date}&cat=${categoryId}`, { replace: true, viewTransition: true })
        })
        .finally(() => setSaving(null))
      return
    }
    const { date, script, note } = form
    save.mutate({ date, script, note, category_id: categoryId, title: form.title.trim() }, {
      onSuccess: () => {
        clearDraft(clipId)
        toast.success('บันทึกแล้ว')
        setSaved(true)
      },
      onSettled: () => setSaving(null),
    })
  }

  const blocked = save.isPending || cats.length === 0 || !!draft
  // Ctrl/Cmd+S saves: the owner enters many clips a day. Bound on every render so it sees the current form.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || shortcutKey(e) !== 's') return
      e.preventDefault()
      if (!blocked && !dialogOpen()) submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const refs = media.filter((m) => m.purpose === 'reference')
  const refViews = viewables(refs, urls)
  const expiring = media.filter((m) => daysLeft(m.expires_at) <= WARN_DAYS)
  // Files R2 keeps 30 days from upload; on a saved clip the soonest-expiring reference sets the line.
  const refDays = refs.length ? Math.min(...refs.map((f) => daysLeft(f.expires_at))) : 30

  // Fixed minimum widths: the spinner and the "saved" label must not resize the buttons.
  const actions: ReactNode = (
    <>
      {clipId
        ? <Button variant="outline" onClick={() => setCopying(true)}><Copy />คัดลอกไปวันอื่น</Button>
        : <Button variant="outline" className="min-w-40" onClick={() => submit(true)} loading={saving === 'more'} disabled={blocked}>บันทึกและเพิ่มต่อ</Button>}
      <Button className="min-w-28" onClick={() => submit()} loading={saving === 'save'} disabled={blocked}>{saved ? 'บันทึกแล้ว ✓' : 'บันทึก'}</Button>
    </>
  )

  return (
    <div className="flex flex-col gap-3 max-md:pb-16">
      <div className="flex items-center gap-2">
        <BackButton fallback={`/calendar?date=${form.date}`} />
        {initial && clipId && <ClipPager clipId={clipId} date={initial.date} />}
        {/* Always in the layout (invisible while there is nothing to say), so the toolbar never shifts when the first edit is made. */}
        <span role="status" className={`ml-auto text-right text-xs text-sub ${!pristine && !draft ? '' : 'invisible'}`}>
          ยังไม่ได้บันทึก<span className="max-sm:hidden"> · เก็บร่างไว้ในเครื่องนี้แล้ว</span>
        </span>
        <div className="flex gap-2 max-md:hidden">{actions}</div>
      </div>
      {/* Phones: the save actions sit above the tab bar, in reach of the thumb and on screen however long the script is. Portalled so the page transition does not carry them. */}
      {createPortal(
        <div data-savebar className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 flex gap-2 border-t border-line bg-bg px-4 py-2 md:hidden [&>:last-child]:flex-1">{actions}</div>,
        document.body,
      )}

      {draft && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-note-line bg-note p-3 text-sm">
          พบร่างที่ยังไม่ได้บันทึก: {draft.title || 'ไม่มีหัวข้อ'}
          <span className="flex gap-2">
            <Button variant="outline" onClick={() => { clearDraft(clipId); setDraft(null) }}>ทิ้งร่าง</Button>
            <Button onClick={() => { setSaved(false); setForm((f) => ({ ...draft, date: explicitDate ?? (isIsoDate(draft.date) ? draft.date : f.date) })); setDraft(null) }}>กู้คืนร่าง</Button>
          </span>
        </div>
      )}

      {expiring.length > 0 && (
        <div role="status" className="rounded-card border border-warn-line bg-warn-bg p-3 text-sm">
          มี {expiring.length} ไฟล์จะถูกลบใน {Math.min(...expiring.map((m) => daysLeft(m.expires_at)))} วัน
          <span className="ml-2 inline-block"><DownloadAll ids={readyIds(expiring)} /></span>
        </div>
      )}

      {catsLoaded && cats.length === 0 && (
        <p role="status" className="rounded-card border border-warn-line bg-warn-bg p-3 text-sm">
          ยังไม่มีประเภทคลิป จึงยังบันทึกไม่ได้ <Link viewTransition to="/categories" className="link-action">สร้างประเภทคลิป</Link>
        </p>
      )}

      <fieldset disabled={!!draft} className="contents">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="cat">ประเภท</Label>
              <div className="relative">
                <select id="cat" value={categoryId} onChange={(e) => set({ category_id: e.target.value })} className="h-9 w-full appearance-none rounded-md border border-line bg-bg pr-8 pl-2.5 text-sm max-md:h-11">
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sub" />
              </div>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="date">วัน</Label>
              <DateField id="date" value={form.date} onChange={(v) => set({ date: v })} />
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="title">หัวข้อ</Label>
            <Input id="title" autoFocus={!!params.get('cat')} aria-invalid={titleError} value={form.title} className="font-bold" style={clipId ? { viewTransitionName: `title-${clipId}` } : undefined} onChange={(e) => { set({ title: e.target.value }); setTitleError(false) }} />
            {titleError && <p role="alert" className="text-xs text-danger">กรุณากรอกหัวข้อ</p>}
          </div>
          <div className="grid gap-1">
            <Label htmlFor="script">สคริปต์</Label>
            <MarkdownField id="script" className={clipId ? 'min-h-60' : 'min-h-96'} value={form.script} onChange={(v) => set({ script: v })} />
          </div>
          {clipId && <Review clipId={clipId} urls={urls} />}
        </div>

        <div className="flex flex-col gap-3">
          <section className="rounded-card border border-note-line bg-note p-3">
            <Label htmlFor="note" className="mb-1">หมายเหตุ</Label>
            <MarkdownField id="note" note placeholder="หนึ่งบรรทัดต่อหนึ่งข้อ" className="min-h-32 bg-bg" value={form.note} onChange={(v) => set({ note: v })} />
          </section>
          <section className="flex flex-col gap-2 rounded-card border border-line p-3">
            <h2 className="text-sm font-bold">ไฟล์อ้างอิง ({refs.length})</h2>
            <div className="grid grid-cols-2 gap-2">
              {/* Every file, not capped: the owner must reach each one to delete it (the creator view caps tiles). */}
              {refs.map((f) => (
                <FileTile key={f.id} file={f} clipDate={form.date} url={urls[f.id]} onDelete={() => setDeletingFile(f)}
                  onOpen={urls[f.id] ? (el) => lb.openAt(refViews, refViews.findIndex((v) => v.id === f.id), el) : undefined} />
              ))}
            </div>
            <UploadZone clipId={clipId ?? ''} purpose="reference" ensureClipId={ensureClip} parked={parked} setParked={setParked} />
            <p className="text-xs text-sub">ไฟล์อ้างอิงจะถูกลบอัตโนมัติใน {refDays} วัน · ดาวน์โหลดไว้ก่อนได้</p>
          </section>
          {clipId && <Button variant="outline" className="self-start border-danger text-danger max-md:min-h-11" onClick={() => void del(clipId)}><Trash2 />ลบคลิป</Button>}
        </div>
      </div>
      </fieldset>

      {lb.node}
      {copying && clipId && <CopyDialog clip={{ id: clipId, title: form.title, date: form.date }} onClose={() => setCopying(false)} />}
      <ConfirmDialog open={!!deletingFile} title={`ลบไฟล์ “${lastFile?.file_name}”?`} body="ลบแล้วกู้คืนไม่ได้" confirm="ลบ"
        onConfirm={() => deletingFile && removeFile.mutateAsync(deletingFile.id)} loading={removeFile.isPending} onClose={() => setDeletingFile(null)} />
    </div>
  )
}
