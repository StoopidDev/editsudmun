import type { ComponentType } from 'react'
import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom'
import { RequireAuth, RequireOwner } from '@/components/guards'
import { RouteError } from '@/components/RouteError'
import { Login } from '@/pages/Login'

// Each page loads on demand; the login page and the guards stay in the entry chunk.
const page = <T,>(load: () => Promise<T>, pick: (m: T) => ComponentType) =>
  async () => ({ Component: pick(await load()) })

// Real data routes (not a splat wrapping <Routes>): only data routes pass viewTransition on Link
// and navigate through to the router, so page transitions run.
export const router = createBrowserRouter(createRoutesFromElements(
  // Pathless wrapper: its errorElement catches every route below (failed chunk loads included).
  <Route errorElement={<RouteError />}>
    <Route path="/login" element={<Login />} />
    <Route element={<RequireAuth />}>
      <Route lazy={page(() => import('@/components/AppShell'), (m) => m.AppShell)}>
        <Route index lazy={page(() => import('@/pages/Home'), (m) => m.Home)} />
        <Route path="calendar" lazy={page(() => import('@/pages/Calendar'), (m) => m.Calendar)} />
        <Route path="clips/:id" lazy={page(() => import('@/pages/ClipDetail'), (m) => m.ClipDetail)} />
        <Route path="search" lazy={page(() => import('@/pages/Search'), (m) => m.Search)} />
        <Route element={<RequireOwner />}>
          <Route path="categories" lazy={page(() => import('@/pages/Categories'), (m) => m.Categories)} />
          <Route path="users" lazy={page(() => import('@/pages/Users'), (m) => m.Users)} />
        </Route>
        <Route path="*" lazy={page(() => import('@/pages/NotFound'), (m) => m.NotFound)} />
      </Route>
    </Route>
  </Route>,
))
