import { createStart } from "@tanstack/react-start"
import { appErrorAdapter } from "@/lib/app-error"

/** SSR is on: loaders prefetch through TanStack Query and dehydrate into the HTML. */
export const startInstance = createStart(() => ({
  serializationAdapters: [appErrorAdapter],
}))
