import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  /** Compact density for table cells / inline panels */
  compact?: boolean
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1.5 px-4 py-8" : "gap-2 px-6 py-10",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-brand-gray-100 text-brand-gray-400",
            compact ? "h-9 w-9" : "h-11 w-11"
          )}
        >
          {icon}
        </div>
      )}
      <p
        className={cn(
          "font-semibold text-brand-gray-700",
          compact ? "text-xs" : "text-sm"
        )}
      >
        {title}
      </p>
      {description && (
        <p
          className={cn(
            "max-w-sm leading-relaxed text-brand-gray-500",
            compact ? "text-[11px]" : "text-xs"
          )}
        >
          {description}
        </p>
      )}
      {action && <div className={cn(compact ? "mt-1.5" : "mt-2")}>{action}</div>}
    </div>
  )
}

export { EmptyState }
