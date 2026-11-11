import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Copy, Trash2 } from 'lucide-react'
import * as api from '@/api/index'
import { useAct, useCategories, useClip, useDeleteClip, useMedia } from '@/api/queries'
import { BackButton } from '@/components/BackButton'
import { ClipPager } from '@/components/ClipPager'
import { CopyDialog } from '@/components/CopyDialog'
import { ConfirmDialog, FileTile, UploadDisabled } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { isIsoDate, todayIso } from '@/lib/dates'
import { clearDraft, isBlank, readDraft, sameBrief, writeDraft } from '@/lib/draft'
import { daysLeft, WARN_DAYS } from '@/lib/media'
import type { ClipInput, ClipMedia } from '@/lib/types'
import { useLast } from '@/lib/useLast'
import { Review } from './Review'
import { toast } from 'sonner'

export function ClipForm({ clipId }: { clipId?: string }) {
  const { data: clip, isPending } = useClip(clipId ?? '')
  const { key } = useLocation()
  if (clipId && isPending) return <p className="text-sm text-sub">กำลังโหลด...</p>
  if (clipId && !clip) return <p>ไม่พบคลิป <Link to="/calendar" className="text-brand">กลับปฏิทิน</Link></p>
  return <Form key={clipId ?? key} clipId={clipId} initial={clip ?? undefined} />
}

function Form({ clipId, initial }: { clipId?: string; initial?: ClipInput }) {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const urlDate = params.get('date')
  const explicitDate = urlDate && isIsoDate(urlDate) ? urlDate : null
  const { data: cats = [] } = useCategories()
  const { data: media = [] } = useMedia(clipId ?? '')
  const [form, setForm] = useState<ClipInput>(initial
    ? { date: initial.date, category_id: initial.category_id, title: initial.title, script: initial.script, note: initial.note }
    : { date: explicitDate ?? todayIso(), category_id: params.get('cat') ?? '', title: '', script: '', note: '' })
  const [titleError, setTitleError] = useState(false)
  const [draft, setDraft] = useState(() => {
    const saved = readDraft(clipId)
    return saved && initial && sameBrief(saved, initial) ? null : saved
  })
  const [copying, setCopying] = useState(false)
  const [deletingFile, setDeletingFile] = useState<ClipMedia | null>(null)
  const lastFile = useLast(deletingFile)
  const del = useDeleteClip(() => nav(`/calendar?date=${form.date}`))
  const removeFile = useAct(api.deleteMedia)
  const save = useAct((input: ClipInput) => (clipId ? api.updateClip(clipId, input) : api.createClip(input)))

  const categoryId = cats.some((c) => c.id === form.category_id) ? form.category_id : (cats[0]?.id ?? '')
  const set = (patch: Partial<ClipInput>) => setForm((f) => ({ ...f, ...patch }))

  const pristine = initial ? sameBrief(form, initial) : isBlank(form)

  // Written on every change, not debounced: leaving right after typing must not lose the text.
  useEffect(() => {
    if (draft) return
    if (pristine) clearDraft(clipId)
    else writeDraft(form, clipId)
  }, [form, pristine, clipId, draft])

  const submit = (addAnother = false) => {
    if (!isIsoDate(form.date)) { toast.error('วันที่ไม่ถูกต้อง'); return }
    if (!form.title.trim()) return setTitleError(true)
    const { date, script, note } = form
    save.mutate({ date, script, note, category_id: categoryId, title: form.title.trim() }, {
      onSuccess: (c) => {
        clearDraft(clipId)
        toast.success('บันทึกแล้ว')
        if (addAnother) nav(`/clips/new?date=${date}&cat=${categoryId}`, { replace: true })
        else if (!clipId) nav(`/clips/${c.id}`, { replace: true })
      },
    })
  }

  const refs = media.filter((m) => m.purpose === 'reference')
  const expiring = media.filter((m) => daysLeft(m.expires_at) <= WARN_DAYS)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackButton fallback={`/calendar?date=${form.date}`} />
        {initial && clipId && <ClipPager clipId={clipId} date={initial.date} />}
        {!pristine && !draft && <span className="text-xs text-sub">✓ บันทึกร่างอัตโนมัติแล้ว</span>}
        <div className="flex flex-wrap gap-2">
          {clipId
            ? <Button variant="outline" onClick={() => setCopying(true)}><Copy />คัดลอกไปวันอื่น</Button>
            : <Button variant="outline" onClick={() => submit(true)} loading={save.isPending} disabled={cats.length === 0 || !!draft}>บันทึกและเพิ่มต่อ</Button>}
          <Button onClick={() => submit()} loading={save.isPending} disabled={cats.length === 0 || !!draft}>บันทึก</Button>
        </div>
      </div>

      {draft && (
        <div className="flex items-center justify-between rounded-card border border-note-line bg-note p-3 text-sm">
          พบร่างที่ยังไม่ได้บันทึก: {draft.title || 'ไม่มีหัวข้อ'}
          <span className="flex gap-2">
            <Button variant="outline" onClick={() => { clearDraft(clipId); setDraft(null) }}>ทิ้งร่าง</Button>
            <Button onClick={() => { setForm((f) => ({ ...draft, date: explicitDate ?? (isIsoDate(draft.date) ? draft.date : f.date) })); setDraft(null) }}>กู้คืนร่าง</Button>
          </span>
        </div>
      )}

      {expiring.length > 0 && (
        <div role="status" className="rounded-card border border-warn-line bg-warn-bg p-3 text-sm">
          มี {expiring.length} ไฟล์จะถูกลบใน {Math.min(...expiring.map((m) => daysLeft(m.expires_at)))} วัน
          <Button variant="link" disabled className="ml-2 h-auto p-0 max-md:min-h-11">ดาวน์โหลดทั้งหมด</Button>
        </div>
      )}

      <fieldset disabled={!!draft} className="contents">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="cat">ประเภท</Label>
              <select id="cat" value={categoryId} onChange={(e) => set({ category_id: e.target.value })} className="h-9 rounded-md border border-line bg-bg px-2 text-sm max-md:h-11">
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="date">วัน</Label>
              <Input id="date" type="date" value={form.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="title">หัวข้อ</Label>
            <Input id="title" autoFocus={!!params.get('cat')} aria-invalid={titleError} value={form.title} className="font-bold" onChange={(e) => { set({ title: e.target.value }); setTitleError(false) }} />
            {titleError && <p role="alert" className="text-xs text-danger">กรุณากรอกหัวข้อ</p>}
          </div>
          <div className="grid gap-1">
            <Label htmlFor="script">สคริปต์</Label>
            <Textarea id="script" rows={clipId ? 10 : 18} value={form.script} onChange={(e) => set({ script: e.target.value })} />
          </div>
          {clipId && <Review clipId={clipId} />}
        </div>

        <div className="flex flex-col gap-3">
          <section className="rounded-card border border-note-line bg-note p-3">
            <Label htmlFor="note" className="mb-1">หมายเหตุ</Label>
            <Textarea id="note" rows={5} placeholder="หนึ่งบรรทัดต่อหนึ่งข้อ" className="bg-bg" value={form.note} onChange={(e) => set({ note: e.target.value })} />
          </section>
          <section className="flex flex-col gap-2 rounded-card border border-line p-3">
            <h2 className="text-sm font-bold">ไฟล์อ้างอิง ({refs.length})</h2>
            <div className="grid grid-cols-2 gap-2">{refs.map((f) => <FileTile key={f.id} file={f} clipDate={form.date} onDelete={() => setDeletingFile(f)} />)}</div>
            <UploadDisabled label="ลากรูปมาวางหรือคลิกเพื่ออัปโหลด" />
          </section>
          {clipId && <Button variant="outline" className="self-start border-danger text-danger max-md:min-h-11" onClick={() => void del(clipId)}><Trash2 />ลบคลิป</Button>}
        </div>
      </div>
      </fieldset>

      {copying && clipId && <CopyDialog clip={{ id: clipId, title: form.title, date: form.date }} onClose={() => setCopying(false)} />}
      <ConfirmDialog open={!!deletingFile} title={`ลบไฟล์ “${lastFile?.file_name}”?`} body="ลบแล้วกู้คืนไม่ได้" confirm="ลบ"
        onConfirm={() => deletingFile && removeFile.mutateAsync(deletingFile.id)} loading={removeFile.isPending} onClose={() => setDeletingFile(null)} />
    </div>
  )
}
