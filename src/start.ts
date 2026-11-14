import { createStart } from "@tanstack/react-start"

/**
 * SSR is off for every route. Data lives in localStorage, so the server has
 * nothing to render. Only the root HTML shell comes from the server.
 */
export const startInstance = createStart(() => ({ defaultSsr: false }))
