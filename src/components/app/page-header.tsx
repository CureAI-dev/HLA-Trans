import type { ReactNode } from "react"

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string
  description?: string
  actions?: ReactNode
  breadcrumbs?: Array<{ label: string; href?: string }>
}) {
  return (
    <header className="mb-6 space-y-3">
      {breadcrumbs && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {breadcrumbs.map((item, index) => (
              <li key={`${item.label}-${index}`} className="flex gap-2">
                {index > 0 && <span aria-hidden="true">/</span>}
                {item.href ? (
                  <a href={item.href} className="underline underline-offset-4">
                    {item.label}
                  </a>
                ) : (
                  <span aria-current="page">{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  )
}
