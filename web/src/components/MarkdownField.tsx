import { useRef, useState, type ComponentProps } from 'react'
import { Bold, Eye, Heading2, Italic, List, Pencil } from 'lucide-react'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { noteToMarkdown } from '@/lib/markdown'
import { prefixLines, wrapSelection, type Edit } from '@/lib/mdEdit'
import { shortcutKey } from '@/lib/shortcut'

type Tool = { label: string; icon: typeof Bold; run: (v: string, s: number, e: number) => Edit; key?: string }
const TOOLS: Tool[] = [
  { label: 'ตัวหนา', icon: Bold, key: 'b', run: (v, s, e) => wrapSelection(v, s, e, '**') },
  { label: 'ตัวเอียง', icon: Italic, key: 'i', run: (v, s, e) => wrapSelection(v, s, e, '*') },
  { label: 'หัวข้อย่อย', icon: Heading2, run: (v, s, e) => prefixLines(v, s, e, '## ') },
  { label: 'รายการ', icon: List, run: (v, s, e) => prefixLines(v, s, e, '- ') },
]

// A textarea that takes Markdown: format buttons (typing ** on a Thai phone keyboard is slow) and a preview of what the creator will see.
// note: preview the text the way the notes box shows it (one bullet per line).
export function MarkdownField({ value, onChange, note, className = '', ...props }: Omit<ComponentProps<'textarea'>, 'value' | 'onChange'> & { value: string; onChange: (v: string) => void; note?: boolean }) {
  const area = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)

  const apply = (tool: Tool) => {
    const el = area.current
    if (!el) return
    const next = tool.run(el.value, el.selectionStart, el.selectionEnd)
    el.focus()
    el.select()
    // insertText keeps the browser's undo history; where it is refused, set the value directly.
    if (!document.execCommand('insertText', false, next.value)) onChange(next.value)
    requestAnimationFrame(() => el.setSelectionRange(next.start, next.end))
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        {TOOLS.map((t) => (
          <Button key={t.label} variant="outline" size="icon-sm" aria-label={t.label} title={t.label} disabled={preview}
            onMouseDown={(e) => e.preventDefault()} onClick={() => apply(t)}><t.icon /></Button>
        ))}
        <Button variant="outline" size="sm" className="ml-auto" aria-pressed={preview} onClick={() => setPreview(!preview)}>
          {preview ? <Pencil /> : <Eye />}{preview ? 'แก้ไขต่อ' : 'ดูตัวอย่าง'}
        </Button>
      </div>
      {/* The textarea stays in the layout under the preview, so switching never changes the height of the page. */}
      <div className="relative">
        <Textarea ref={area} value={value} aria-hidden={preview || undefined} tabIndex={preview ? -1 : undefined}
          className={`${className} ${preview ? 'invisible' : ''}`}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            const tool = (e.ctrlKey || e.metaKey) && !e.altKey ? TOOLS.find((t) => t.key === shortcutKey(e)) : undefined
            if (tool) { e.preventDefault(); apply(tool) }
          }}
          {...props} />
        {preview && (
          <div className="absolute inset-0 overflow-y-auto rounded-lg border border-line bg-bg px-2.5 py-2 text-base md:text-sm">
            {value.trim() ? <Markdown text={note ? noteToMarkdown(value) : value} /> : <p className="text-sub">ยังไม่มีข้อความ</p>}
          </div>
        )}
      </div>
    </div>
  )
}
