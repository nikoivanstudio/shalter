"use client"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import type { ViewedContactProfile } from "@/features/contacts/lib/viewed-profile"
import { ContactProfileCard } from "@/features/contacts/ui/contact-profile-card"

export function ViewedProfilePage({ profile }: { profile: ViewedContactProfile }) {
  const router = useRouter()

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.1),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.88))] px-4 py-5 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))] sm:px-6">
      <div className="pointer-events-none absolute left-[-5rem] top-20 size-44 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="pointer-events-none absolute right-[-4rem] top-52 size-40 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Назад
          </Button>
        </div>
        <ContactProfileCard
          profile={profile}
          isLoading={false}
          onClose={() => router.back()}
          onOpenChat={(contactId) => router.push(`/chats?contactId=${contactId}`)}
          onStartAudioCall={(contactId) => router.push(`/chats?contactId=${contactId}&startCall=audio`)}
          onStartVideoCall={(contactId) => router.push(`/chats?contactId=${contactId}&startCall=video`)}
        />
      </div>
    </main>
  )
}
