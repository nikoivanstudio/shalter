import { redirect } from "next/navigation"

import { ProfileHome } from "@/features/profile/ui/profile-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"

export default async function Home() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  return (
    <ProfileHome
      user={{
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      }}
    />
  )
}
