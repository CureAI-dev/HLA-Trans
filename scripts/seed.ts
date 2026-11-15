import { createDb } from "@/server/db/client.server"
import { runMigrations } from "@/server/db/migrate.server"
import { seedDemo } from "@/server/repos/data.server"
import { env } from "@/server/env.server"

const { pool, db } = createDb(env().DATABASE_URL, { max: 2, statementTimeoutMs: 60_000 })
await runMigrations(db)
const r = await seedDemo(db, "Demo seed")
console.log(
  `Seeded ${r.patients} patients, ${r.donors} donors; queued ${r.runs} match runs (start the worker to process them).`
)
await pool.end()
