import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

export const runtime = "nodejs"

function parseDialogId(value: string) {
  const dialogId = Number(value)
  return Number.isInteger(dialogId) && dialogId > 0 ? dialogId : null
}

function createSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dialogId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { dialogId: dialogIdParam } = await context.params
  const dialogId = parseDialogId(dialogIdParam)
  if (!dialogId) {
    return NextResponse.json({ message: "Неверный id чата" }, { status: 400 })
  }

  const hasAccess = await prisma.dialog.findFirst({
    where: { id: dialogId, users: { some: { id: userId } } },
    select: { id: true },
  })

  if (!hasAccess) {
    return NextResponse.json({ message: "Чат не найден" }, { status: 404 })
  }

  const since = Number(request.nextUrl.searchParams.get("since") ?? "0")
  let lastSeenId = Number.isInteger(since) && since > 0 ? since : 0
  let polling = false

  const encoder = new TextEncoder()
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => {
        controller.enqueue(encoder.encode(payload))
      }

      const stop = () => {
        if (pollTimer) {
          clearInterval(pollTimer)
          pollTimer = null
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
        try {
          controller.close()
        } catch {
          // Stream may already be closed by runtime.
        }
      }

      const poll = async () => {
        if (polling) {
          return
        }

        polling = true
        try {
          const messages = await prisma.message.findMany({
            where: {
              dialogId,
              id: { gt: lastSeenId },
            },
            orderBy: { id: "asc" },
            include: {
              author: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          })

          for (const message of messages) {
            lastSeenId = message.id
            send(
              createSseEvent("message", {
                id: message.id,
                content: message.content,
                status: message.status,
                createdAt: message.createdAt,
                dialogId: message.dialogId,
                author: message.author,
              })
            )
          }
        } catch {
          send(createSseEvent("chat-error", { message: "Ошибка обновления чата" }))
        } finally {
          polling = false
        }
      }

      send(createSseEvent("ready", { dialogId, since: lastSeenId }))
      void poll()
      pollTimer = setInterval(() => {
        void poll()
      }, 1500)

      heartbeatTimer = setInterval(() => {
        send(": ping\n\n")
      }, 15000)

      request.signal.addEventListener("abort", stop)
    },
    cancel() {
      if (pollTimer) {
        clearInterval(pollTimer)
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
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
