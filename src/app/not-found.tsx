export const dynamic = "force-dynamic"

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border/80 bg-card p-6 text-center shadow-xl shadow-black/5">
        <h1 className="text-xl font-semibold">Страница не найдена</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Такой страницы не существует или она была перемещена.
        </p>
      </div>
    </main>
  )
}
