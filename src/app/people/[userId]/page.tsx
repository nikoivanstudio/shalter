import { notFound, redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import { getViewedContactProfile } from "@/features/contacts/lib/viewed-profile"
import { ViewedProfilePage } from "@/features/contacts/ui/viewed-profile-page"
import { getCurrentUser } from "@/shared/lib/auth/current-user"

export default async function PeopleProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    redirect("/auth")
  }

  const { userId } = await params
  const parsedUserId = Number(userId)
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    notFound()
  }

  const result = await getViewedContactProfile(currentUser.id, parsedUserId)
  if (!result.ok) {
    if (result.status === 404) {
      notFound()
    }

    return (
      <Providers>
        <PwaRegisterClient />
        <main className="flex min-h-screen items-center justify-center px-4 py-8">
          <div className="max-w-md rounded-3xl border border-border/70 bg-card/90 p-6 text-center shadow-sm">
            <h1 className="text-xl font-semibold">Профиль недоступен</h1>
            <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
          </div>
        </main>
      </Providers>
    )
  }

  return (
    <Providers>
      <PwaRegisterClient />
      <ViewedProfilePage profile={result.profile} />
    </Providers>
  )
}
