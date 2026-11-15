import { queryOptions } from "@tanstack/react-query"
import { listAuditFn } from "./audit.functions"
import type { AuditSearch } from "./audit.functions"

export const auditKeys = {
  all: ["audit"] as const,
  list: (s: AuditSearch) => [...auditKeys.all, s] as const,
}

export const auditQueries = {
  list: (s: AuditSearch) =>
    queryOptions({
      queryKey: auditKeys.list(s),
      queryFn: () => listAuditFn({ data: s }),
    }),
}
