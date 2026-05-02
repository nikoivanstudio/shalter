import { NextRequest } from "next/server"

jest.mock("@/shared/lib/auth/request-user", () => ({
  getAuthorizedUserIdFromRequest: jest.fn(),
}))
jest.mock("@/features/ads/lib/store", () => ({
  listPublicAdCampaigns: jest.fn(),
  listAdCampaignsByOwner: jest.fn(),
  createAdCampaign: jest.fn(),
  getOwnedAdCampaign: jest.fn(),
  updateAdCampaignStatus: jest.fn(),
  deleteAdCampaign: jest.fn(),
  recordAdCampaignClick: jest.fn(),
}))

const { getAuthorizedUserIdFromRequest } = jest.requireMock(
  "@/shared/lib/auth/request-user"
) as { getAuthorizedUserIdFromRequest: jest.Mock }
const {
  listPublicAdCampaigns,
  listAdCampaignsByOwner,
  createAdCampaign,
  getOwnedAdCampaign,
  updateAdCampaignStatus,
  deleteAdCampaign,
  recordAdCampaignClick,
} = jest.requireMock("@/features/ads/lib/store") as Record<string, jest.Mock>

function nextRequest(url: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
  })
}

async function readJson(response: Response) {
  return response.json()
}

describe("ads routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("list and create routes handle public, mine, validation and success", async () => {
    const adsRoute = await import("@/app/api/ads/route")

    listPublicAdCampaigns.mockResolvedValueOnce([{ id: 1 }])
    let response = await adsRoute.GET(nextRequest("http://localhost/api/ads", "GET"))
    expect(response.status).toBe(200)
    expect(await readJson(response)).toEqual({ campaigns: [{ id: 1 }] })

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(null)
    response = await adsRoute.GET(nextRequest("http://localhost/api/ads?scope=mine", "GET"))
    expect(response.status).toBe(401)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(7)
    listAdCampaignsByOwner.mockResolvedValueOnce([{ id: 2 }])
    response = await adsRoute.GET(nextRequest("http://localhost/api/ads?scope=mine", "GET"))
    expect(response.status).toBe(200)
    expect(await readJson(response)).toEqual({ campaigns: [{ id: 2 }] })

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(null)
    response = await adsRoute.POST(nextRequest("http://localhost/api/ads", "POST", {}))
    expect(response.status).toBe(401)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(7)
    response = await adsRoute.POST(nextRequest("http://localhost/api/ads", "POST", {}))
    expect(response.status).toBe(400)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(7)
    createAdCampaign.mockResolvedValueOnce({ id: 3, title: "Campaign" })
    response = await adsRoute.POST(
      nextRequest("http://localhost/api/ads", "POST", {
        title: "Campaign",
        description: "Long enough advertising copy",
        ctaText: "Open",
        targetUrl: "https://example.com",
        audience: "all",
        budget: 1500,
      })
    )
    expect(response.status).toBe(201)
    expect(createAdCampaign).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ title: "Campaign", budget: 1500 })
    )
  })

  test("update, delete and click routes handle auth, validation and success", async () => {
    const adRoute = await import("@/app/api/ads/[adId]/route")
    const clickRoute = await import("@/app/api/ads/[adId]/click/route")

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(null)
    let response = await adRoute.PATCH(nextRequest("http://localhost/api/ads/1", "PATCH", { status: "active" }), {
      params: Promise.resolve({ adId: "1" }),
    })
    expect(response.status).toBe(401)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(7)
    response = await adRoute.PATCH(nextRequest("http://localhost/api/ads/bad", "PATCH", { status: "active" }), {
      params: Promise.resolve({ adId: "bad" }),
    })
    expect(response.status).toBe(400)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(7)
    getOwnedAdCampaign.mockResolvedValueOnce(null)
    response = await adRoute.PATCH(nextRequest("http://localhost/api/ads/1", "PATCH", { status: "active" }), {
      params: Promise.resolve({ adId: "1" }),
    })
    expect(response.status).toBe(404)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(7)
    getOwnedAdCampaign.mockResolvedValueOnce({ id: 1, ownerId: 7 })
    updateAdCampaignStatus.mockResolvedValueOnce({ id: 1, status: "active" })
    response = await adRoute.PATCH(nextRequest("http://localhost/api/ads/1", "PATCH", { status: "active" }), {
      params: Promise.resolve({ adId: "1" }),
    })
    expect(response.status).toBe(200)
    expect(updateAdCampaignStatus).toHaveBeenCalledWith(1, 7, "active")

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(7)
    getOwnedAdCampaign.mockResolvedValueOnce({ id: 1, ownerId: 7 })
    response = await adRoute.DELETE(nextRequest("http://localhost/api/ads/1", "DELETE"), {
      params: Promise.resolve({ adId: "1" }),
    })
    expect(response.status).toBe(200)
    expect(deleteAdCampaign).toHaveBeenCalledWith(1, 7)

    response = await clickRoute.POST(nextRequest("http://localhost/api/ads/1/click", "POST"), {
      params: Promise.resolve({ adId: "1" }),
    })
    expect(response.status).toBe(200)
    expect(recordAdCampaignClick).toHaveBeenCalledWith(1)
  })
})
