import path from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    clearMocks: true,
    coverage: {
      all: true,
      provider: "istanbul",
      reporter: ["json", "text-summary"],
      reportsDirectory: "coverage/vitest",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts"],
    },
    environment: "jsdom",
    globals: true,
    include: ["test/vitest/**/*.test.ts", "test/vitest/**/*.test.tsx"],
    mockReset: true,
    restoreMocks: true,
    setupFiles: ["./test/vitest.setup.ts"],
  },
})
