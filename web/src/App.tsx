import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useMe } from '@/api/queries'
import { AppShell } from '@/components/AppShell'
import { Calendar } from '@/pages/Calendar'
import { Categories } from '@/pages/Categories'
import { ClipDetail } from '@/pages/ClipDetail'
import { Home } from '@/pages/Home'
import { Login } from '@/pages/Login'
import { NotFound } from '@/pages/NotFound'
import { Search } from '@/pages/Search'
import { Users } from '@/pages/Users'

function RequireAuth() {
  const { data: me, isPending } = useMe()
  const location = useLocation()
  if (isPending) return null
  return me ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
}

function RequireOwner() {
  const { data: me } = useMe()
  return me?.role === 'owner' ? <Outlet /> : <Navigate to="/" replace />
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
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
      </Routes>
    </BrowserRouter>
  )
}
