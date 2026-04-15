const authSecret = process.env.AUTH_SECRET

if (!authSecret) {
  throw new Error("AUTH_SECRET is not set")
}

export const env = {
  AUTH_SECRET: authSecret,
}
