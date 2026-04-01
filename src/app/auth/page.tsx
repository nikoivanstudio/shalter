import { AuthCard } from "@/features/auth/ui/auth-card"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"

export default function AuthPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(0_0%_100%/.12),transparent_35%),radial-gradient(circle_at_80%_0%,hsl(0_0%_100%/.08),transparent_30%)] dark:bg-[radial-gradient(circle_at_20%_20%,hsl(0_0%_100%/.06),transparent_35%),radial-gradient(circle_at_80%_0%,hsl(0_0%_100%/.04),transparent_30%)]" />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <AuthCard />
    </main>
  )
}
