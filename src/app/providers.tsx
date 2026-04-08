"use client"

import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/features/theme/model/theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  )
}
