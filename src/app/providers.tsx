"use client"

import dynamic from "next/dynamic"

import { ThemeProvider } from "@/features/theme/model/theme-provider"

const Toaster = dynamic(
  () => import("@/components/ui/sonner").then((module) => module.Toaster),
  { ssr: false }
)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  )
}
