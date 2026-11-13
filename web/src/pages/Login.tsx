import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import * as api from '@/api/auth'
import { notViews, useMe } from '@/api/queries-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function Login() {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const location = useLocation()
  const [show, setShow] = useState(false)
  // Plain useMutation, not useAct: the error shows inline here, not as a toast.
  const act = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.login(email, password),
    onSuccess: () => qc.invalidateQueries(notViews),
  })

  // Only same-app paths: a bare '//host' would be a protocol-relative URL.
  const fromState = (location.state as { from?: unknown } | null)?.from
  const from = typeof fromState === 'string' && fromState.startsWith('/') && !fromState.startsWith('//') ? fromState : '/'

  if (me) return <Navigate to={from} replace />

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    act.mutate({ email: String(f.get('email')), password: String(f.get('password')) })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <form onSubmit={submit} className="enter flex w-full max-w-sm flex-col gap-4 rounded-card bg-bg p-8">
        <h1 className="text-center text-xl">Channel's Tool</h1>
        <div className="grid gap-1">
          <Label htmlFor="email">อีเมล</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" aria-invalid={!!act.error} aria-describedby={act.error ? 'login-error' : undefined} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="password">รหัสผ่าน</Label>
          <div className="relative">
            <Input id="password" name="password" type={show ? 'text' : 'password'} required autoComplete="current-password" aria-invalid={!!act.error} aria-describedby={act.error ? 'login-error' : undefined} className="pr-10" />
            <button type="button" aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={show} onClick={() => setShow(!show)} className="hover-tint absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-md text-sub max-md:w-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              <span className="relative block size-4">
                <Eye aria-hidden="true" className={`absolute inset-0 size-4 transition-[opacity,scale,filter] duration-150 ease-out ${show ? 'opacity-0 scale-75 blur-[4px]' : 'opacity-100 scale-100 blur-[0px]'}`} />
                <EyeOff aria-hidden="true" className={`absolute inset-0 size-4 transition-[opacity,scale,filter] duration-150 ease-out ${show ? 'opacity-100 scale-100 blur-[0px]' : 'opacity-0 scale-75 blur-[4px]'}`} />
              </span>
            </button>
          </div>
        </div>
        {act.error && <p id="login-error" role="alert" className="text-sm text-danger">{act.error.message}</p>}
        <Button type="submit" loading={act.isPending}>{act.isPending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</Button>
        <p className="text-center text-xs text-sub">ลืมรหัสผ่าน? ติดต่อเจ้าของช่องเพื่อรีเซ็ต</p>
      </form>
    </div>
  )
}
