import { type NextRequest, NextResponse } from "next/server"

import {
  getCallEventsSince,
  getCurrentCallEventCursor,
  getUserCallSnapshots,
  type CallServerEvent,
} from "@/features/calls/lib/call-store"
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
      let pollTimer: ReturnType<typeof setInterval> | null = null
      let lastSequence = 0
      let isPolling = false

      const send = (value: string) => {
        if (closed) {
          return
        }
        controller.enqueue(encoder.encode(value))
      }

      const stop = () => {
        if (closed) {
          return
        }
        closed = true
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
        if (pollTimer) {
          clearInterval(pollTimer)
          pollTimer = null
        }
        try {
          controller.close()
        } catch {
          // no-op
        }
        request.signal.removeEventListener("abort", stop)
      }

      const poll = async () => {
        if (closed || isPolling) {
          return
        }

        isPolling = true

        try {
          const events = await getCallEventsSince(userId, lastSequence)
          for (const entry of events) {
            lastSequence = entry.sequence
            send(toSseEvent(entry.event))
          }
        } catch {
          stop()
          return
        } finally {
          isPolling = false
        }
      }

      request.signal.addEventListener("abort", stop)

      void (async () => {
        try {
          lastSequence = await getCurrentCallEventCursor(userId)
          const calls = await getUserCallSnapshots(userId)

          if (closed) {
            return
          }

          send("retry: 15000\n\n")
          send(
            toSseEvent({
              type: "call.snapshot",
              calls,
            })
          )

          heartbeatTimer = setInterval(() => {
            send(": ping\n\n")
          }, 15000)

          pollTimer = setInterval(() => {
            void poll()
          }, 700)
        } catch {
          stop()
        }
      })()
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
