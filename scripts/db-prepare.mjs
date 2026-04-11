import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

import { Client } from "pg"

const FAILED_CONTACT_MIGRATION = "20260402192247_fix_contact_model"
const CONTACTS_TABLE = "contacts"
const FAILED_UNIQUE_PHONE_MIGRATION = "20260410110000_add_unique_phone_for_users"
const USERS_PHONE_INDEX = "users_phone_key"
const TABLES_TO_CLEAR_BEFORE_USER_DEDUPLICATION = [
  "dialog_blocked_users",
  "push_subscriptions",
  "user_blacklist",
  "contacts",
  "messages",
  "_DialogToUser",
  "dialogs",
  "otp",
]

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const prismaBin = path.join(rootDir, "node_modules", ".bin", "prisma")
const dialogTitleMigrationFile = path.join(
  rootDir,
  "prisma",
  "migrations",
  "20260408013000_add_dialog_title",
  "migration.sql"
)

function runPrismaCommand(args) {
  execFileSync(prismaBin, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  })
}

async function connectClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set")
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  })

  await client.connect()
  return client
}

async function shouldResolveFailedContactMigrationWithClient(client) {
  const tableExists = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [CONTACTS_TABLE]
  )

  if (!tableExists.rows[0]?.exists) {
    return false
  }

  const failedMigration = await client.query(
    `
      SELECT 1
      FROM public."_prisma_migrations"
      WHERE migration_name = $1
        AND finished_at IS NULL
        AND rolled_back_at IS NULL
      LIMIT 1
    `,
    [FAILED_CONTACT_MIGRATION]
  )

  return failedMigration.rowCount > 0
}

async function getFailedMigrationNames(client) {
  try {
    const failedMigrations = await client.query(
      `
        SELECT migration_name
        FROM public."_prisma_migrations"
        WHERE finished_at IS NULL
          AND rolled_back_at IS NULL
      `,
      []
    )

    return new Set(failedMigrations.rows.map((row) => row.migration_name))
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }

    throw new Error("Unable to inspect failed migrations")
  }
}

async function hasUsersPhoneUniqueIndex(client) {
  const result = await client.query(
    `
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = $1
      LIMIT 1
    `,
    [USERS_PHONE_INDEX]
  )

  return result.rowCount > 0
}

async function getDuplicatePhones(client) {
  const result = await client.query(
    `
      SELECT phone, COUNT(*)::int AS count, ARRAY_AGG(id ORDER BY id) AS user_ids
      FROM public."users"
      WHERE phone IS NOT NULL
      GROUP BY phone
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, phone ASC
      LIMIT 10
    `
  )

  return result.rows
}

async function createUsersPhoneUniqueIndex(client) {
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_key" ON "users"("phone")`)
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `
      SELECT to_regclass($1) IS NOT NULL AS exists
    `,
    [`public."${tableName}"`]
  )

  return result.rows[0]?.exists === true
}

async function clearNonUserTables(client) {
  for (const tableName of TABLES_TO_CLEAR_BEFORE_USER_DEDUPLICATION) {
    if (!(await tableExists(client, tableName))) {
      continue
    }

    await client.query(`TRUNCATE TABLE public."${tableName}" RESTART IDENTITY CASCADE`)
  }
}

async function removeDuplicateUsersByPhone(client, duplicatePhones) {
  await client.query("BEGIN")

  try {
    console.warn("Clearing all application data except users before deduplicating phones.")
    await clearNonUserTables(client)

    for (const row of duplicatePhones) {
      const userIds = (row.user_ids ?? [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
        .sort((left, right) => left - right)

      if (userIds.length < 2) {
        continue
      }

      const [keepUserId, ...deleteUserIds] = userIds
      console.warn(
        `Removing duplicate users for phone ${row.phone}. Keeping user ${keepUserId}, deleting: ${deleteUserIds.join(", ")}`
      )

      await client.query(`DELETE FROM public."users" WHERE id = ANY($1::int[])`, [deleteUserIds])
    }

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  }
}

async function resolveFailedUniquePhoneMigrationIfPossible(client, failedMigrationNames) {
  if (!failedMigrationNames.has(FAILED_UNIQUE_PHONE_MIGRATION)) {
    return
  }

  if (await hasUsersPhoneUniqueIndex(client)) {
    console.warn(
      `Resolving failed migration ${FAILED_UNIQUE_PHONE_MIGRATION} because the ${USERS_PHONE_INDEX} index already exists.`
    )
    runPrismaCommand(["migrate", "resolve", "--applied", FAILED_UNIQUE_PHONE_MIGRATION])
    return
  }

  const duplicatePhones = await getDuplicatePhones(client)
  if (duplicatePhones.length > 0) {
    console.warn(
      `Found duplicate phone values blocking ${FAILED_UNIQUE_PHONE_MIGRATION}. Clearing non-user data and keeping the lowest user id per phone.`
    )
    await removeDuplicateUsersByPhone(client, duplicatePhones)
  }

  const remainingDuplicatePhones = await getDuplicatePhones(client)
  if (remainingDuplicatePhones.length > 0) {
    const duplicateSummary = remainingDuplicatePhones
      .map((row) => `${row.phone} -> user_ids: ${(row.user_ids ?? []).join(",")}`)
      .join("; ")

    throw new Error(
      `Unable to finish phone deduplication before resolving ${FAILED_UNIQUE_PHONE_MIGRATION}: ${duplicateSummary}`
    )
  }

  console.warn(
    `Creating ${USERS_PHONE_INDEX} manually and resolving failed migration ${FAILED_UNIQUE_PHONE_MIGRATION}.`
  )
  await createUsersPhoneUniqueIndex(client)
  runPrismaCommand(["migrate", "resolve", "--applied", FAILED_UNIQUE_PHONE_MIGRATION])
}

async function main() {
  const client = await connectClient()
  try {
    if (await shouldResolveFailedContactMigrationWithClient(client)) {
      console.warn(
        `Resolving failed migration ${FAILED_CONTACT_MIGRATION} because the ${CONTACTS_TABLE} table already exists.`
      )
      runPrismaCommand(["migrate", "resolve", "--applied", FAILED_CONTACT_MIGRATION])
    }

    const failedMigrationNames = await getFailedMigrationNames(client)
    await resolveFailedUniquePhoneMigrationIfPossible(client, failedMigrationNames)
  } finally {
    await client.end()
  }

  runPrismaCommand(["migrate", "deploy"])
  runPrismaCommand(["db", "execute", "--file", dialogTitleMigrationFile])
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
