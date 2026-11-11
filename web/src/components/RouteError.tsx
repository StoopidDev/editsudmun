// Shown when a route or its page chunk fails to load or render.
export function RouteError() {
  return (
    <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center text-ink">
      <p className="text-base">เกิดข้อผิดพลาด</p>
      <button type="button" onClick={() => location.reload()}
        className="press min-h-11 rounded-card bg-brand px-4 text-sm text-white">โหลดใหม่</button>
    </div>
  )
}
