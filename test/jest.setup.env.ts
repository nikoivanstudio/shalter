process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "test-auth-secret"
process.env.INVITE_MESSAGE = process.env.INVITE_MESSAGE ?? "invite-code"
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://test:test@localhost:5432/test"
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "test-public-key"
process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "test-private-key"
process.env.VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "admin@example.com"
