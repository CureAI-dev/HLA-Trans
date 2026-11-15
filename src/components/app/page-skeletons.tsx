import { Skeleton } from "@/components/ui/skeleton"

function Header() {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-8 w-28" />
    </div>
  )
}

export function PagePending() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Header />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

export function TablePageSkeleton({ columns, rows = 8 }: { columns: number; rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Header />
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="border">
        {Array.from({ length: rows + 1 }, (_, r) => (
          <div
            key={r}
            className="grid gap-4 border-b p-3 last:border-b-0"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }, (__, c) => (
              <Skeleton key={c} className={r === 0 ? "h-3 w-20" : "h-4 w-full"} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DetailPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Header />
      <Skeleton className="mb-4 h-8 w-80" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  )
}

export function FormPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Header />
      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,768px)_300px]">
        <Skeleton className="hidden h-96 xl:block" />
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
        <Skeleton className="hidden h-72 xl:block" />
      </div>
    </div>
  )
}

export function ResultPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-4 h-20 w-full" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-32" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="hidden h-80 xl:block" />
      </div>
    </div>
  )
}
