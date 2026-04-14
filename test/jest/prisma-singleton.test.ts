describe("db/prisma singleton", () => {
  test("reuses global pool and prisma in non-production", async () => {
    jest.resetModules()

    const poolCtor = jest.fn(() => ({ pool: true }))
    const prismaCtor = jest.fn(() => ({ prisma: true }))
    const adapterCtor = jest.fn(() => ({ adapter: true }))

    jest.doMock("pg", () => ({ Pool: poolCtor }))
    jest.doMock("@prisma/client", () => ({ PrismaClient: prismaCtor }))
    jest.doMock("@prisma/adapter-pg", () => ({ PrismaPg: adapterCtor }))

    const first = await import("@/shared/lib/db/prisma")
    jest.resetModules()
    jest.doMock("pg", () => ({ Pool: poolCtor }))
    jest.doMock("@prisma/client", () => ({ PrismaClient: prismaCtor }))
    jest.doMock("@prisma/adapter-pg", () => ({ PrismaPg: adapterCtor }))
    const second = await import("@/shared/lib/db/prisma")

    expect(first.prisma).toEqual({ prisma: true })
    expect(second.prisma).toEqual({ prisma: true })
    expect(poolCtor).toHaveBeenCalledTimes(1)
    expect(adapterCtor).toHaveBeenCalledTimes(1)
    expect(prismaCtor).toHaveBeenCalledTimes(1)
  })
})
