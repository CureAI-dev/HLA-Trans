import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { gzipSync } from "node:zlib"

const roots = ["dist/client", ".output/public"].filter((d) => {
  try {
    return statSync(d).isDirectory()
  } catch {
    return false
  }
})
if (!roots.length) throw new Error("Run `bun run build` first.")
const files = roots.flatMap(function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : []
  })
})
const forbidden = [/drizzle-orm/, /node-postgres/, /pg-protocol/, /DATABASE_URL/]
let failed = false
for (const f of files) {
  const src = readFileSync(f, "utf8")
  for (const re of forbidden)
    if (re.test(src)) {
      console.error(`FAIL ${f} contains ${re}`)
      failed = true
    }
}
// Initial-load JS = every chunk the HTML shell loads or modulepreloads (Vite lists all static
// imports of the entry). Without a shell, fall back to entry-named chunks. Match on the file
// name, not the path: every path contains "client".
const shells = roots.flatMap((r) =>
  readdirSync(r).filter((f) => f.endsWith(".html")).map((f) => readFileSync(join(r, f), "utf8"))
)
const referenced = new Set(shells.flatMap((h) => [...h.matchAll(/\/(assets\/[^"'\\\s]+\.js)/g)].map((m) => m[1])))
const initial = referenced.size
  ? files.filter((f) => [...referenced].some((ref) => f.endsWith(ref)))
  : files.filter((f) => /^(main|index|client)[-.]/.test(f.split(/[\\/]/).pop() ?? ""))
const entry = initial.map((f) => gzipSync(readFileSync(f)).length).reduce((a, b) => a + b, 0)
console.log(`${files.length} JS files scanned, ${initial.length} in the initial load`)
console.log(`${entry <= 250_000 ? "PASS" : "FAIL"} entry JS gzip ${(entry / 1024).toFixed(1)} KiB (budget 250 KiB)`)
if (failed || entry > 250_000) process.exit(1)
