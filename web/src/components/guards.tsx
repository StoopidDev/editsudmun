import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useMe } from '@/api/queries-auth'

export function RequireAuth() {
  const { data: me, isPending } = useMe()
  const location = useLocation()
  if (isPending) return null
  return me ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
}

export function RequireOwner() {
  const { data: me } = useMe()
  return me?.role === 'owner' ? <Outlet /> : <Navigate to="/" replace />
}
