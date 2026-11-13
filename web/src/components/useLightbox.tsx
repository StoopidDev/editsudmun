import { useState } from 'react'
import { Lightbox, type Opened } from './Lightbox'
import type { Viewable } from '@/lib/viewer'

// Owns the lightbox state. Render `node` once in the page; `openAt` takes the tile that was clicked.
export function useLightbox() {
  const [opened, setOpened] = useState<Opened | null>(null)
  const [open, setOpen] = useState(false)
  const openAt = (items: Viewable[], index: number, el: HTMLElement) => {
    if (index < 0) return // the tile is gone from the list
    setOpened({ items, index, from: el.getBoundingClientRect(), back: el })
    setOpen(true)
  }
  const node = opened && (
    <Lightbox opened={opened} open={open} onOpenChange={setOpen}
      onIndex={(index) => setOpened((o) => (o ? { ...o, index } : o))} />
  )
  return { openAt, node }
}
