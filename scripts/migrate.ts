import { createDb } from "@/server/db/client.server"
import { runMigrations } from "@/server/db/migrate.server"
import { env } from "@/server/env.server"

const url = process.argv.includes("--test") ? env().TEST_DATABASE_URL : env().DATABASE_URL
if (!url) throw new Error("TEST_DATABASE_URL is not set.")
const { pool, db } = createDb(url, { max: 1, statementTimeoutMs: 60_000 })
await runMigrations(db)
await pool.end()
console.log(`Migrations applied to ${new URL(url).port}`)
