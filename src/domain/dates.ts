/** Parse an exact YYYY-MM-DD calendar date at UTC midnight, or return null. */
export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(0)
  // setUTCFullYear preserves years 0000–0099 rather than adding 1900.
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null
}

export function localCalendarDate(timestamp: string): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
