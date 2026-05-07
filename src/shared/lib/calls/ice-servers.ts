export type IceServerConfig = {
  urls: string | string[]
  username?: string
  credential?: string
}

function parseServerList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export function getIceServers(): IceServerConfig[] {
  const stunServers = parseServerList(process.env.STUN_SERVER_URLS).concat([
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
  ])

  const dedupedStunServers = Array.from(new Set(stunServers))
  const turnServers = parseServerList(process.env.TURN_SERVER_URLS)
  const turnUsername = process.env.TURN_USERNAME?.trim()
  const turnPassword = process.env.TURN_PASSWORD?.trim()

  const servers: IceServerConfig[] = []

  if (dedupedStunServers.length > 0) {
    servers.push({
      urls: dedupedStunServers,
    })
  }

  if (turnServers.length > 0 && turnUsername && turnPassword) {
    servers.push({
      urls: turnServers,
      username: turnUsername,
      credential: turnPassword,
    })
  }

  return servers
}
