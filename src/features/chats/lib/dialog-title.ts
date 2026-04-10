type DialogUser = {
  id: number
  firstName: string
  lastName: string | null
}

type DialogWithUsers = {
  title: string | null
  users: DialogUser[]
}

export function getDialogUserName(user: DialogUser) {
  return `${user.firstName} ${user.lastName ?? ""}`.trim()
}

export function getDialogDisplayTitle(
  dialog: DialogWithUsers,
  currentUserId: number
) {
  const participantsCount = dialog.users.length

  if (participantsCount === 2) {
    const otherUser = dialog.users.find((item) => item.id !== currentUserId)
    if (otherUser) {
      return getDialogUserName(otherUser)
    }
  }

  const title = dialog.title?.trim()
  if (title) {
    return title
  }

  if (participantsCount > 2) {
    return dialog.users.map((item) => getDialogUserName(item)).join(", ")
  }

  return "Без названия"
}
