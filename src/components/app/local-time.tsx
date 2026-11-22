import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * A timestamp in the viewer's own time zone. The server renders in UTC, so the
 * text is filled in only in the browser; the server output is an empty
 * <time> element (no wrong time, no hydration mismatch).
 */
export function LocalTime({
  value,
  options,
}: {
  value: string
  /** Omit for date and time (toLocaleString). */
  options?: Intl.DateTimeFormatOptions
}) {
  const client = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
  const date = new Date(value)
  const text = !client
    ? ""
    : options
      ? new Intl.DateTimeFormat(undefined, options).format(date)
      : date.toLocaleString()
  return <time dateTime={value}>{text}</time>
}

export const MEDIUM_DATE_TIME: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
}
export const DATE_ONLY: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
}
