// Static shell for the first load (route chunks and session still arriving). Same geometry as AppShell
// (rail from md, full sidebar from lg, 64 px header), no text and no spinner, so the swap shifts nothing.
// Imports nothing from the app: it stays in the entry chunk.
export function Splash() {
  return (
    <div aria-hidden className="flex min-h-dvh">
      <div className="hidden w-16 shrink-0 bg-surface md:block lg:w-60" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-16 border-b border-line bg-bg" />
        <div className="flex flex-col gap-6 bg-bg p-4 md:p-6">
          <div className="skeleton h-9 w-2/3 md:h-10" />
          <div className="skeleton h-28" />
        </div>
      </div>
    </div>
  )
}
