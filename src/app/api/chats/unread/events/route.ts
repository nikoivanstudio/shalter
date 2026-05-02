import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import { isUserOnline, touchUserActivity } from "@/shared/lib/user-activity"

export const runtime = "nodejs"

function createSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

async function getUnreadSnapshot(userId: number) {
  const dialogs = await prisma.dialog.findMany({
    where: {
      users: {
        some: { id: userId },
      },
    },
    select: {
      id: true,
      users: {
        select: {
          id: true,
          lastSeenAt: true,
        },
      },
    },
    orderBy: { id: "asc" },
  })

  const unread = await prisma.message.groupBy({
    by: ["dialogId"],
    where: {
      authorId: { not: userId },
      status: { not: "READ" },
      dialog: {
        users: {
          some: { id: userId },
        },
      },
    },
    _count: {
      _all: true,
    },
  })

  const unreadByDialog = Object.fromEntries(
    unread.map((item) => [String(item.dialogId), item._count._all])
  )

  return {
    dialogIds: dialogs.map((item) => item.id),
    presenceByUserId: Object.fromEntries(
      dialogs
        .flatMap((dialog) => dialog.users)
        .map((dialogUser) => [
          String(dialogUser.id),
          {
            lastSeenAt: dialogUser.lastSeenAt ? dialogUser.lastSeenAt.toISOString() : null,
            isOnline: isUserOnline(dialogUser.lastSeenAt),
          },
        ])
    ),
    unreadByDialog,
    dialogsWithUnread: unread.length,
  }
}

export async function GET(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request, { touchActivity: false })
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const encoder = new TextEncoder()
  let timer: ReturnType<typeof setInterval> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let activityTimer: ReturnType<typeof setInterval> | null = null
  let polling = false
  let previousSerialized = ""
  let previousDialogIds = new Set<number>()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let stopped = false
      const send = (payload: string) => {
        if (stopped) {
          return
        }

        controller.enqueue(encoder.encode(payload))
      }

      const stop = () => {
        if (stopped) {
          return
        }
        stopped = true
        if (timer) {
          clearInterval(timer)
          timer = null
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
        if (activityTimer) {
          clearInterval(activityTimer)
          activityTimer = null
        }
        try {
          controller.close()
        } catch {
          // stream can already be closed
        }
        request.signal.removeEventListener("abort", stop)
      }

      const emitSnapshot = async () => {
        if (polling || stopped) {
          return
        }

        polling = true
        try {
          const snapshot = await getUnreadSnapshot(userId)
          const nextDialogIds = new Set(snapshot.dialogIds)

          if (previousDialogIds.size > 0) {
            const missingDialogIds = Array.from(previousDialogIds).filter(
              (id) => !nextDialogIds.has(id)
            )

            for (const dialogId of missingDialogIds) {
              const existingDialog = await prisma.dialog.findUnique({
                where: { id: dialogId },
                select: { id: true },
              })
              send(
                createSseEvent(existingDialog ? "chat-removed" : "chat-deleted", {
                  dialogId,
                })
              )
            }
          }

          previousDialogIds = nextDialogIds
          const serialized = JSON.stringify(snapshot)
          if (serialized !== previousSerialized) {
            previousSerialized = serialized
            send(createSseEvent("unread", snapshot))
          }
        } catch {
          send(createSseEvent("chat-error", { message: "Ошибка обновления непрочитанных" }))
        } finally {
          polling = false
        }
      }

      send("retry: 15000\n\n")
      send(createSseEvent("ready", { ok: true }))
      void touchUserActivity(userId)
      void emitSnapshot()
      timer = setInterval(() => {
        void emitSnapshot()
      }, 1500)

      heartbeatTimer = setInterval(() => {
        send(": ping\n\n")
      }, 15000)

      activityTimer = setInterval(() => {
        void touchUserActivity(userId)
      }, 60000)

      request.signal.addEventListener("abort", stop)
    },
    cancel() {
      if (timer) {
        clearInterval(timer)
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
      }
      if (activityTimer) {
        clearInterval(activityTimer)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
