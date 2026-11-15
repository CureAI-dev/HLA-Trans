import { createCsrfMiddleware, createStart } from "@tanstack/react-start"
import { appErrorAdapter } from "@/lib/app-error"

/** Writes are attributed by cookie, so server functions must reject cross-site calls. */
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
})

/** SSR is on: loaders prefetch through TanStack Query and dehydrate into the HTML. */
export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  serializationAdapters: [appErrorAdapter],
}))
