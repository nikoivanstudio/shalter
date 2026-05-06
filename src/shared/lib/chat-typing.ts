type TypingEntry = {
  userId: number
  expiresAt: number
}

const TYPING_TTL_MS = 4000
const typingByDialog = new Map<number, Map<number, TypingEntry>>()

function getDialogStore(dialogId: number) {
  let store = typingByDialog.get(dialogId)
  if (!store) {
    store = new Map<number, TypingEntry>()
    typingByDialog.set(dialogId, store)
  }
  return store
}

function cleanupDialog(dialogId: number) {
  const store = typingByDialog.get(dialogId)
  if (!store) {
    return
  }

  const now = Date.now()
  for (const [userId, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(userId)
    }
  }

  if (store.size === 0) {
    typingByDialog.delete(dialogId)
  }
}

export function markUserTyping(dialogId: number, userId: number) {
  const store = getDialogStore(dialogId)
  store.set(userId, {
    userId,
    expiresAt: Date.now() + TYPING_TTL_MS,
  })
}

export function clearUserTyping(dialogId: number, userId: number) {
  const store = typingByDialog.get(dialogId)
  if (!store) {
    return
  }

  store.delete(userId)
  if (store.size === 0) {
    typingByDialog.delete(dialogId)
  }
}

export function getTypingUserIds(dialogId: number, excludeUserId?: number) {
  cleanupDialog(dialogId)
  const store = typingByDialog.get(dialogId)
  if (!store) {
    return []
  }

  return Array.from(store.values())
    .filter((entry) => entry.userId !== excludeUserId)
    .map((entry) => entry.userId)
    .sort((left, right) => left - right)
}
