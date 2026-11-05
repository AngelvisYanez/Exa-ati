import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface TableSkeletonProps {
  rows?: number
  columns?: number
  className?: string
}

function TableSkeleton({ rows = 5, columns = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn("w-full py-2", className)} role="status" aria-label="Cargando datos">
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn("h-4 rounded-md", c === 0 ? "w-1/3" : "flex-1")}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando datos</span>
    </div>
  )
}

export { TableSkeleton }
