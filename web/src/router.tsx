import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom'
import { RequireAuth, RequireOwner } from '@/components/guards'
import { AppShell } from '@/components/AppShell'
import { Calendar } from '@/pages/Calendar'
import { Categories } from '@/pages/Categories'
import { ClipDetail } from '@/pages/ClipDetail'
import { Home } from '@/pages/Home'
import { Login } from '@/pages/Login'
import { NotFound } from '@/pages/NotFound'
import { Search } from '@/pages/Search'
import { Users } from '@/pages/Users'

// Real data routes (not a splat wrapping <Routes>): only data routes pass viewTransition on Link
// and navigate through to the router, so page transitions run.
export const router = createBrowserRouter(createRoutesFromElements(
  <>
    <Route path="/login" element={<Login />} />
    <Route element={<RequireAuth />}>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="clips/:id" element={<ClipDetail />} />
        <Route path="search" element={<Search />} />
        <Route element={<RequireOwner />}>
          <Route path="categories" element={<Categories />} />
          <Route path="users" element={<Users />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Route>
  </>,
))
