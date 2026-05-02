import { Prisma } from "@prisma/client"

import type { CreateAdCampaignInput } from "@/features/ads/model/schemas"
import { prisma } from "@/shared/lib/db/prisma"

export type AdCampaignStatus = "draft" | "active" | "paused"
export type AdCampaignAudience = "all" | "client" | "user"

export type AdCampaignOwner = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  role: string
  avatarTone: string | null
  isBlocked: boolean
}

export type AdCampaign = {
  id: number
  ownerId: number
  title: string
  description: string
  ctaText: string
  targetUrl: string
  audience: AdCampaignAudience
  budget: number
  status: AdCampaignStatus
  clicks: number
  impressions: number
  createdAt: string
  updatedAt: string
  startsAt: string | null
  endsAt: string | null
  owner: AdCampaignOwner
}

type AdCampaignRow = {
  id: number
  owner_id: number
  title: string
  description: string
  cta_text: string
  target_url: string
  audience: string
  budget: number
  status: string
  clicks: number
  impressions: number
  created_at: Date
  updated_at: Date
  starts_at: Date | null
  ends_at: Date | null
  owner_first_name: string
  owner_last_name: string | null
  owner_email: string
  owner_role: string
  owner_avatar_tone: string | null
  owner_is_blocked: boolean
}

function mapRow(row: AdCampaignRow): AdCampaign {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    ctaText: row.cta_text,
    targetUrl: row.target_url,
    audience: row.audience as AdCampaignAudience,
    budget: row.budget,
    status: row.status as AdCampaignStatus,
    clicks: row.clicks,
    impressions: row.impressions,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    startsAt: row.starts_at ? row.starts_at.toISOString() : null,
    endsAt: row.ends_at ? row.ends_at.toISOString() : null,
    owner: {
      id: row.owner_id,
      firstName: row.owner_first_name,
      lastName: row.owner_last_name,
      email: row.owner_email,
      role: row.owner_role,
      avatarTone: row.owner_avatar_tone,
      isBlocked: row.owner_is_blocked,
    },
  }
}

async function queryCampaigns(whereClause: Prisma.Sql = Prisma.empty) {
  const rows = await prisma.$queryRaw<AdCampaignRow[]>(Prisma.sql`
    select
      a.id,
      a.owner_id,
      a.title,
      a.description,
      a.cta_text,
      a.target_url,
      a.audience,
      a.budget,
      a.status,
      a.clicks,
      a.impressions,
      a.created_at,
      a.updated_at,
      a.starts_at,
      a.ends_at,
      u.first_name as owner_first_name,
      u.last_name as owner_last_name,
      u.email as owner_email,
      u.role as owner_role,
      u.avatar_tone as owner_avatar_tone,
      u.is_blocked as owner_is_blocked
    from ad_campaigns a
    join users u on u.id = a.owner_id
    ${whereClause}
    order by
      case when a.status = 'active' then 0 when a.status = 'draft' then 1 else 2 end,
      a.created_at desc
  `)

  return rows.map(mapRow)
}

export async function listPublicAdCampaigns() {
  return queryCampaigns(Prisma.sql`where a.status = 'active'`)
}

export async function listAdCampaignsByOwner(ownerId: number) {
  return queryCampaigns(Prisma.sql`where a.owner_id = ${ownerId}`)
}

export async function createAdCampaign(ownerId: number, input: CreateAdCampaignInput) {
  const rows = await prisma.$queryRaw<AdCampaignRow[]>(Prisma.sql`
    insert into ad_campaigns (
      owner_id,
      title,
      description,
      cta_text,
      target_url,
      audience,
      budget,
      status,
      clicks,
      impressions
    )
    values (
      ${ownerId},
      ${input.title},
      ${input.description},
      ${input.ctaText},
      ${input.targetUrl},
      ${input.audience},
      ${input.budget},
      'draft',
      0,
      0
    )
    returning
      id,
      owner_id,
      title,
      description,
      cta_text,
      target_url,
      audience,
      budget,
      status,
      clicks,
      impressions,
      created_at,
      updated_at,
      starts_at,
      ends_at,
      ${""}::varchar as owner_first_name,
      null::varchar as owner_last_name,
      ${""}::varchar as owner_email,
      ${""}::varchar as owner_role,
      null::varchar as owner_avatar_tone,
      false as owner_is_blocked
  `)

  const createdId = rows[0]?.id
  if (!createdId) {
    throw new Error("Не удалось создать рекламную кампанию")
  }

  const [campaign] = await queryCampaigns(Prisma.sql`where a.id = ${createdId}`)
  if (!campaign) {
    throw new Error("Не удалось загрузить рекламную кампанию")
  }

  return campaign
}

export async function getOwnedAdCampaign(adId: number, ownerId: number) {
  const [campaign] = await queryCampaigns(
    Prisma.sql`where a.id = ${adId} and a.owner_id = ${ownerId}`
  )
  return campaign ?? null
}

export async function updateAdCampaignStatus(
  adId: number,
  ownerId: number,
  status: AdCampaignStatus
) {
  await prisma.$executeRaw(Prisma.sql`
    update ad_campaigns
    set
      status = ${status},
      starts_at = case when ${status} = 'active' then now() else starts_at end,
      updated_at = now()
    where id = ${adId} and owner_id = ${ownerId}
  `)

  return getOwnedAdCampaign(adId, ownerId)
}

export async function deleteAdCampaign(adId: number, ownerId: number) {
  await prisma.$executeRaw(Prisma.sql`
    delete from ad_campaigns
    where id = ${adId} and owner_id = ${ownerId}
  `)
}

export async function recordAdCampaignClick(adId: number) {
  await prisma.$executeRaw(Prisma.sql`
    update ad_campaigns
    set
      clicks = clicks + 1,
      updated_at = now()
    where id = ${adId} and status = 'active'
  `)
}
