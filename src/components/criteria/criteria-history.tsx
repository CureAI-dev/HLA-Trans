import { useState } from "react"
import type { CriteriaVersion } from "@/domain/schema"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CriteriaDiff } from "./criteria-diff"

export function CriteriaHistory({ versions }: { versions: CriteriaVersion[] }) {
  const sorted = [...versions].sort((a, b) => b.version - a.version)
  const [open, setOpen] = useState<string[]>([])
  return (
    <section aria-labelledby="criteria-history" className="mt-8 space-y-4">
      <h2 id="criteria-history" className="text-xl font-semibold">
        Published history
      </h2>
      <p className="text-sm text-muted-foreground">
        Published versions are read-only. Expand a version to inspect changes
        against its predecessor.
      </p>
      <Accordion
        multiple
        value={open}
        onValueChange={(v) => setOpen(v as string[])}
        className="border bg-card"
      >
        {sorted.map((version, index) => (
          <AccordionItem key={version.id} value={version.id} className="px-4">
            <AccordionTrigger className="items-center py-3 hover:no-underline">
              <span className="flex flex-wrap items-baseline gap-x-3 text-left">
                <span className="text-sm font-semibold">
                  Version {version.version}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {version.author || "Unspecified clinician"}
                </span>
                <time
                  className="text-sm font-normal text-muted-foreground"
                  dateTime={version.createdAt}
                  suppressHydrationWarning
                >
                  {new Date(version.createdAt).toLocaleString()}
                </time>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="mb-3 text-sm whitespace-pre-wrap">
                {version.changeNote}
              </p>
              {/* The diff renders only when open: no work for collapsed history. */}
              {open.includes(version.id) &&
                (sorted[index + 1] ? (
                  <CriteriaDiff
                    before={sorted[index + 1].criteria}
                    after={version.criteria}
                  />
                ) : (
                  <p className="text-sm">Initial criteria version.</p>
                ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
