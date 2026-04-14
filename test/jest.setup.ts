import { jest } from "@jest/globals"

Object.defineProperty(global, "crypto", {
  configurable: true,
  value: global.crypto ?? {
    randomUUID: () => "00000000-0000-4000-8000-000000000000",
  },
})

jest.spyOn(console, "error").mockImplementation(() => {})
