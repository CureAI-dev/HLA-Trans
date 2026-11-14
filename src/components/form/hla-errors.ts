export interface HlaLocalError {
  raw: string
  message: string
}
export function resolveHlaError(
  raw: string,
  local: HlaLocalError | undefined,
  parent?: string
): string | undefined {
  return (local?.raw === raw ? local.message : undefined) || parent
}
