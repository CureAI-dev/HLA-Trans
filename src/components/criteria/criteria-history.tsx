import type { CriteriaVersion } from "@/domain/schema"
import { CriteriaDiff } from "./criteria-diff"

export function CriteriaHistory({ versions }: { versions: CriteriaVersion[] }) {
  const sorted = [...versions].sort((a, b) => b.version - a.version)
  return (
    <section aria-labelledby="criteria-history" className="mt-8 space-y-4">
      <h2 id="criteria-history" className="text-xl font-semibold">
        Published history
      </h2>
      <p className="text-sm text-muted-foreground">
        Published versions are read-only. Expand a version to inspect changes
        against its predecessor.
      </p>
      {sorted.map((version, index) => (
        <details className="border bg-card p-4" key={version.id}>
          <summary className="cursor-pointer">
            Version {version.version} |{" "}
            {version.author || "Unspecified clinician"} |{" "}
            <time dateTime={version.createdAt}>
              {new Date(version.createdAt).toLocaleString()}
            </time>
          </summary>
          <p className="my-3 text-sm whitespace-pre-wrap">
            {version.changeNote}
          </p>
          {sorted[index + 1] ? (
            <CriteriaDiff
              before={sorted[index + 1].criteria}
              after={version.criteria}
            />
          ) : (
            <p className="text-sm">Initial criteria version.</p>
          )}
        </details>
      ))}
    </section>
  )
}
