import { Link } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { cn } from "cn"

export function PageHeader({
  title,
  titleClassName,
  badges,
  description,
  actions,
  breadcrumbs,
}: {
  title: string
  titleClassName?: string
  /** Short facts shown under the title (state, ABO, …). */
  badges?: ReactNode
  description?: string
  actions?: ReactNode
  breadcrumbs?: Array<{ label: string; link?: LinkOptions }>
}) {
  return (
    <header className="mb-6 space-y-3">
      {breadcrumbs && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {breadcrumbs.map((item, index) => (
              <li key={`${item.label}-${index}`} className="flex gap-2">
                {index > 0 && <span aria-hidden="true">/</span>}
                {item.link ? (
                  <Link {...item.link} className="underline underline-offset-4">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current="page">{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1
            className={cn(
              "text-2xl font-semibold tracking-tight",
              titleClassName
            )}
          >
            {title}
          </h1>
          {badges && (
            <div
              data-guide="page-badges"
              className="mt-2 flex w-fit flex-wrap items-center gap-1.5"
            >
              {badges}
            </div>
          )}
          {description && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  )
}
