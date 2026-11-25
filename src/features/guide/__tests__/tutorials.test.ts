import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { GROUPS, TUTORIAL_COUNT } from "../guide-meta"
import { isPractice } from "../guide.types"
import type { Step } from "../guide.types"
import { TUTORIALS, searchTutorials, tutorialForPage } from "../tutorials"

const SRC = join(process.cwd(), "src")
const walk = (dir: string): Array<string> =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(join(dir, e.name))
      : e.name.endsWith(".tsx")
        ? [join(dir, e.name)]
        : []
  )
const source = walk(SRC)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n")

const steps = TUTORIALS.flatMap((t) =>
  t.steps.map((s, i) => ({ name: `${t.id} step ${i + 1}`, s }))
)
const targets = (s: Step) =>
  typeof s.target === "string" ? [s.target] : s.target
const plain = (html: string) => html.replace(/<[^>]+>/g, "")
const words = (s: Step) => {
  const t = s.try ? (typeof s.try.text === "string" ? s.try.text : "") : ""
  return {
    body: plain(s.text),
    all: [s.title, s.text, t, s.try?.done, s.try?.nudge]
      .map((x) => plain(x ?? ""))
      .join(" "),
  }
}

describe("tutorials", () => {
  it("are 17 with unique ids, in known groups", () => {
    expect(TUTORIALS).toHaveLength(TUTORIAL_COUNT)
    expect(new Set(TUTORIALS.map((t) => t.id)).size).toBe(TUTORIALS.length)
    for (const t of TUTORIALS)
      expect(GROUPS.map((x) => x.id)).toContain(t.group)
  })
  it("have a title and up to 80 words in every step", () => {
    for (const { name, s } of steps) {
      expect(s.title, name).not.toBe("")
      if (!s.dynamic) expect(s.text, name).not.toBe("")
      expect(words(s).body.split(/\s+/).length, name).toBeLessThanOrEqual(80)
    }
  })
  it("use no forbidden words or markup", () => {
    for (const { name, s } of steps) {
      expect(words(s).all, name).not.toMatch(
        /evaluat|fictional|leverage|seamless/i
      )
      expect(s.text.replace(/<\/?b>/g, ""), name).not.toMatch(/[<>]/)
    }
  })
  it("cover every page in the sidebar and every practice screen", () => {
    const used = new Set(steps.map(({ s }) => s.at.to))
    for (const to of [
      "/",
      "/patients",
      "/patients/new",
      "/donors/new",
      "/matching",
      "/matches",
      "/matches/check",
      "/criteria",
      "/audit",
      "/data",
      "/practice/patient",
      "/practice/donor",
      "/practice/run",
      "/practice/result",
    ])
      expect(used, to).toContain(to)
    for (const path of [
      "/",
      "/patients",
      "/donors",
      "/matching",
      "/matches",
      "/matches/check",
      "/criteria",
      "/audit",
      "/data",
    ])
      expect(tutorialForPage(path, []), path).toBeDefined()
  })
  it("point only at targets that exist in the source", () => {
    const selectors = steps.flatMap(({ name, s }) =>
      [...targets(s), s.try?.press].flatMap((x) => (x ? [{ name, x }] : []))
    )
    for (const { name, x } of selectors) {
      const guide = /data-guide="([^"]+)"/.exec(x)?.[1]
      const id = /^#([\w\\.-]+)/.exec(x)?.[1].replaceAll("\\", "")
      const label = /aria-labelledby='card-([^']+)'/.exec(x)?.[1]
      const aria = /aria-label="([^"]+)"/.exec(x)?.[1]
      if (guide)
        expect(
          source.includes(`"${guide}"`) || dynamicGuide(guide),
          `${name}: ${x}`
        ).toBe(true)
      else if (id)
        expect(
          source.includes(`id="${id}"`) || id.startsWith("rule-"),
          `${name}: ${x}`
        ).toBe(true)
      else if (label)
        expect(source.toLowerCase(), `${name}: ${x}`).toContain(
          `title="${label.replaceAll("-", " ")}"`
        )
      else if (aria)
        expect(source, `${name}: ${x}`).toContain(`label="${aria}"`)
      else expect.fail(`${name}: unknown selector ${x}`)
    }
  })
  it("ask the operator to act only where nothing can be saved", () => {
    // Real pages: only search, filter, tab and link presses. Typing happens on practice screens.
    for (const { name, s } of steps)
      if (s.try?.fill || s.before) expect(isPractice(s), name).toBe(true)
  })
  it("are found by what people search for", () => {
    expect(searchTutorials("antibodies").map((t) => t.id)).toContain("patient")
    expect(searchTutorials("decline").map((t) => t.id)).toEqual(["decide"])
    expect(searchTutorials("RESET").map((t) => t.id)).toContain("data")
    expect(searchTutorials("")).toHaveLength(TUTORIALS.length)
    expect(searchTutorials("zzz")).toEqual([])
  })
  it("are suggested for the page, unfinished ones first", () => {
    expect(tutorialForPage("/patients/new", [])?.id).toBe("patient")
    expect(tutorialForPage("/patients/abc", [])?.id).toBe("record")
    expect(tutorialForPage("/patients/abc", ["record"])?.id).toBe("keep")
    expect(tutorialForPage("/matches/check", [])?.id).toBe("check")
  })
})

/** Targets built from data: one per rule, criteria section or tab. */
function dynamicGuide(name: string): boolean {
  return [
    [/^check-(logistics|size)$/, "data-guide={`check-${r.rule}`}"],
    [/^criteria-tab-immunology$/, "data-guide={`criteria-tab-${item.id}`}"],
  ].some(
    ([re, code]) => (re as RegExp).test(name) && source.includes(code as string)
  )
}
