import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { errorMiddleware, writeMiddleware } from "@/features/shared/middleware"
import { getDb } from "@/server/db/client.server"
import {
  exportAll,
  importBackup,
  resetAll,
  seedDemo,
} from "@/server/repos/data.server"

export const exportDataFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware])
  .handler(() => exportAll(getDb()))

export const importDataFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(z.object({ backup: z.unknown() })) // full validation happens in importBackup (one schema, one place)
  .handler(({ data, context }) =>
    importBackup(getDb(), data.backup, context.actor)
  )

export const resetDataFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(z.object({ confirm: z.literal("RESET") }))
  .handler(({ context }) => resetAll(getDb(), context.actor))

export const seedDemoFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .handler(({ context }) => seedDemo(getDb(), context.actor))
