import { memo } from "react"
import { Link } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import { Pencil } from "lucide-react"
import { formatRecordValue, getAtPath, isBlank } from "./record-spec"
import type { RecordSection } from "./record-spec"

const RecordSectionCard = memo(function SectionCard({
  section,
  record,
  editLink,
}: {
  section: RecordSection
  record: unknown
  editLink: LinkOptions
}) {
  return (
    <section aria-labelledby={`rec-${section.id}`} className="border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <h3 id={`rec-${section.id}`} className="text-sm font-semibold">
          {section.title}
        </h3>
        <Link
          {...editLink}
          hash={section.id}
          aria-label={`Edit ${section.title}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3" aria-hidden="true" /> Edit section
        </Link>
      </header>
      <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
        {section.fields.map((f) => {
          const v = getAtPath(record, f.path)
          const blank = isBlank(v)
          const wide = f.format === "multiline" || f.format === "list"
          return (
            <div key={f.path} className={wide ? "sm:col-span-2" : undefined}>
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd
                className={
                  blank
                    ? "text-sm text-muted-foreground italic"
                    : `text-sm font-medium whitespace-pre-wrap${f.format === "hla" ? " font-mono" : ""}`
                }
              >
                {blank ? "Not recorded" : formatRecordValue(f, v)}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
})

export function RecordView({
  sections,
  record,
  editLink,
}: {
  sections: RecordSection[]
  record: unknown
  editLink: LinkOptions
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {sections.map((s) => (
        <RecordSectionCard key={s.id} section={s} record={record} editLink={editLink} />
      ))}
    </div>
  )
}
