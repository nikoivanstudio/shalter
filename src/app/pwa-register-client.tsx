"use client"

import dynamic from "next/dynamic"

const PwaRegister = dynamic(
  () => import("@/app/pwa-register").then((module) => module.PwaRegister),
  { ssr: false }
)

export function PwaRegisterClient() {
  return <PwaRegister />
}
