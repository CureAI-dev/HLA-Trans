import { g } from "../guide.types"

/** Small browser helpers for "try it" checks. Called only while a step is open. */
export const inputs = (selector: string): Array<HTMLInputElement> => [
  ...document.querySelectorAll<HTMLInputElement>(`${selector} input`),
]
export const value = (selector: string): string =>
  document.querySelector<HTMLInputElement>(selector)?.value.trim() ?? ""
export const textOf = (selector: string): string =>
  document.querySelector(selector)?.textContent ?? ""
export const exists = (selector: string): boolean =>
  document.querySelector(selector) !== null

/** Types into a React input: React listens for the native input event. */
export function type(selector: string, text: string): void {
  const el = document.querySelector<HTMLInputElement>(selector)
  if (!el) return
  // The prototype's setter, because React overrides `value` on the element itself.
  Reflect.set(HTMLInputElement.prototype, "value", text, el)
  el.dispatchEvent(new Event("input", { bubbles: true }))
}

/** Distance, procurement, transport and implant, in that order. */
export const pairTimes = (): Array<string> =>
  inputs(g("pair-times")).map((i) => i.value.trim())

export const search = (key: string): string | null =>
  new URLSearchParams(window.location.search).get(key)
