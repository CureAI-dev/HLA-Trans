import { afterEach, expect, test, vi } from "vitest"
import { localCalendarDate } from "../dates"

afterEach(() => vi.unstubAllEnvs())

test("history date bounds use the displayed local calendar day at the Karachi UTC boundary", () => {
  vi.stubEnv("TZ", "Asia/Karachi")
  const timestamp = "2026-11-14T20:00:00.000Z"
  expect(new Date(timestamp).getDate()).toBe(15)
  expect(localCalendarDate(timestamp)).toBe("2026-11-15")
  const day = localCalendarDate(timestamp)
  expect(day >= "2026-11-15" && day <= "2026-11-15").toBe(true)
  expect(day <= "2026-11-14").toBe(false)
})
