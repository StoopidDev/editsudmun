import type { MouseEvent } from 'react'

// The clicked card lends its title to the detail heading. Set before navigation starts, so the old snapshot has it.
export function shareTitle(e: MouseEvent<HTMLElement>, id: string) {
  const title = e.currentTarget.querySelector<HTMLElement>('[data-title]')
  if (!title) return
  title.style.viewTransitionName = `title-${id}`
  // Cleared after the transition: a second copy of this clip on screen must not share the name.
  setTimeout(() => { title.style.viewTransitionName = '' }, 1000)
}
