import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

export const runtime = "nodejs"

function createSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

async function getUnreadSnapshot(userId: number) {
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
    unreadByDialog,
    dialogsWithUnread: unread.length,
  }
}

export async function GET(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const encoder = new TextEncoder()
  let timer: ReturnType<typeof setInterval> | null = null
  let polling = false
  let previousSerialized = ""

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => controller.enqueue(encoder.encode(payload))

      const stop = () => {
        if (timer) {
          clearInterval(timer)
          timer = null
        }
        try {
          controller.close()
        } catch {
          // stream can already be closed
        }
      }

      const emitSnapshot = async () => {
        if (polling) {
          return
        }

        polling = true
        try {
          const snapshot = await getUnreadSnapshot(userId)
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

      void emitSnapshot()
      timer = setInterval(() => {
        void emitSnapshot()
      }, 1500)

      request.signal.addEventListener("abort", stop)
    },
    cancel() {
      if (timer) {
        clearInterval(timer)
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
