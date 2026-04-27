"use client"

export const dynamic = "force-dynamic"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-background text-foreground">
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-xl border border-border/80 bg-card p-6 shadow-xl shadow-black/5">
            <h1 className="text-xl font-semibold">Sorry error internet</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {error.message || "Не удалось отобразить страницу."}
            </p>
            <button
              type="button"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
              onClick={reset}
            >
              Go
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
