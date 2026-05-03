import { type NextRequest, NextResponse } from "next/server"

import { subscribeToCalls, getUserCallSnapshots, type CallServerEvent } from "@/features/calls/lib/call-store"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"

export const runtime = "nodejs"

function toSseEvent(event: CallServerEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

export async function GET(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null

      const send = (value: string) => {
        if (closed) {
          return
        }
        controller.enqueue(encoder.encode(value))
      }

      const unsubscribe = subscribeToCalls(userId, (event) => {
        send(toSseEvent(event))
      })

      const stop = () => {
        if (closed) {
          return
        }
        closed = true
        unsubscribe()
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
        try {
          controller.close()
        } catch {
          // no-op
        }
        request.signal.removeEventListener("abort", stop)
      }

      send("retry: 15000\n\n")
      send(
        toSseEvent({
          type: "call.snapshot",
          calls: getUserCallSnapshots(userId),
        })
      )

      heartbeatTimer = setInterval(() => {
        send(": ping\n\n")
      }, 15000)

      request.signal.addEventListener("abort", stop)
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
