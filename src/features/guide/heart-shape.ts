/** One half of the Concord symbol; the other half is its mirror image. Same path as ConcordMark. */
export const HEART_HALF =
  "M51 36 C47 30 41 27 34.5 27 C24.5 27 19 35.5 19 46 C19 63 33 80 51 100"
export const HEART_MIRROR = "translate(128 0) scale(-1 1)"
export const HEART_VIEW_BOX = "-12 18 152 92"

/** The halves start 20 units apart on each side and meet at 1. */
export const heartGap = (value: number): number => (1 - value) * 20

/** The heart as markup, for the tutorial card that driver.js draws. */
export function heartMarkup(value: number): string {
  const half = (gap: number, attr: string) =>
    `<g style="transform:translateX(${gap}px)"><g${attr}><path class="cg-track" d="${HEART_HALF}"/><path class="cg-ink" pathLength="1" d="${HEART_HALF}" style="stroke-dashoffset:${1 - value}"/></g></g>`
  return `<svg class="cg-heart" viewBox="${HEART_VIEW_BOX}" aria-hidden="true">${half(-heartGap(value), "")}${half(heartGap(value), ` transform="${HEART_MIRROR}"`)}</svg>`
}

export function moveHeart(svg: Element | null, value: number): void {
  if (!svg) return
  svg.querySelectorAll<SVGPathElement>(".cg-ink").forEach((path) => {
    path.style.strokeDashoffset = String(1 - value)
  })
  const [left, right] = svg.querySelectorAll<SVGGElement>(":scope > g")
  left.style.transform = `translateX(${-heartGap(value)}px)`
  right.style.transform = `translateX(${heartGap(value)}px)`
}
