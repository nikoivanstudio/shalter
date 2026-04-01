const authSecret = process.env.AUTH_SECRET
const inviteMessage = process.env.INVITE_MESSAGE

if (!authSecret) {
  throw new Error("AUTH_SECRET is not set")
}

if (!inviteMessage) {
  throw new Error("INVITE_MESSAGE is not set")
}

export const env = {
  AUTH_SECRET: authSecret,
  INVITE_MESSAGE: inviteMessage,
}
