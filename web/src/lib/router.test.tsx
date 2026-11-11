// Guards the page transitions: viewTransition on Link only reaches the router from real data
// routes. A splat route wrapping <Routes> (tried once) silently drops it.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, createRoutesFromElements, Link, Outlet, Route, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

describe('router', () => {
  it('passes viewTransition from Link to document.startViewTransition', async () => {
    const start = vi.fn((cb: () => unknown) => {
      const done = Promise.resolve(cb())
      return { finished: done, ready: done, updateCallbackDone: done, skipTransition() {} }
    })
    Object.assign(document, { startViewTransition: start })
    const router = createMemoryRouter(createRoutesFromElements(
      <Route element={<Outlet />}>
        <Route index element={<Link to="/b" viewTransition>go</Link>} />
        <Route path="b" element={<p>b</p>} />
      </Route>,
    ))
    const el = document.createElement('div')
    document.body.append(el)
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    await act(async () => createRoot(el).render(<RouterProvider router={router} />))
    await act(async () => el.querySelector('a')!.click())
    expect(start).toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/b')
  })
})
