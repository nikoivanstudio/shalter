import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

import { Client } from "pg"

const FAILED_CONTACT_MIGRATION = "20260402192247_fix_contact_model"
const CONTACTS_TABLE = "contacts"

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

async function shouldResolveFailedContactMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set")
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  })

  await client.connect()

  try {
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
  } finally {
    await client.end()
  }
}

async function main() {
  if (await shouldResolveFailedContactMigration()) {
    console.warn(
      `Resolving failed migration ${FAILED_CONTACT_MIGRATION} because the ${CONTACTS_TABLE} table already exists.`
    )
    runPrismaCommand(["migrate", "resolve", "--applied", FAILED_CONTACT_MIGRATION])
  }

  runPrismaCommand(["migrate", "deploy"])
  runPrismaCommand(["db", "execute", "--file", dialogTitleMigrationFile])
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
