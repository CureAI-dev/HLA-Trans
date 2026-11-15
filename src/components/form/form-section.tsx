import type { ReactNode } from "react"

export interface FormSectionProps {
  id: string
  title: string
  description?: string
  children: ReactNode
}
export function FormSection({
  id,
  title,
  description,
  children,
}: FormSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 space-y-4 border p-4"
    >
      <h2 id={`${id}-title`} className="font-semibold">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  )
}
export function FormSideNav({
  sections,
}: {
  sections: ReadonlyArray<{ id: string; title: string }>
}) {
  return (
    <nav
      aria-label="Form sections"
      className="flex flex-wrap gap-3 lg:sticky lg:top-20 lg:flex-col"
    >
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="text-sm underline underline-offset-4 focus-visible:outline-2"
        >
          {section.title}
        </a>
      ))}
    </nav>
  )
}
