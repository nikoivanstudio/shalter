const authSecret = process.env.AUTH_SECRET
const bootstrapAdminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || null

if (!authSecret) {
  throw new Error("AUTH_SECRET is not set")
}

export const env = {
  AUTH_SECRET: authSecret,
  BOOTSTRAP_ADMIN_EMAIL: bootstrapAdminEmail,
}
