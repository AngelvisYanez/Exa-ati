import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const statusBannerVariants = cva(
  "rounded-xl px-4 py-3 text-xs font-medium flex items-start gap-2.5 border",
  {
    variants: {
      variant: {
        info: "bg-sky-50 border-sky-200/80 text-brand-sky",
        success: "bg-success-pale border-success-light/40 text-success",
        warning: "bg-brand-amber-pale border-brand-amber/30 text-amber-800",
        danger: "bg-brand-red-subtle border-brand-red-pale text-brand-red",
        muted: "bg-brand-gray-50 border-brand-gray-200 text-brand-gray-600",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

interface StatusBannerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBannerVariants> {
  icon?: React.ReactNode
}

function StatusBanner({
  className,
  variant,
  icon,
  children,
  ...props
}: StatusBannerProps) {
  return (
    <div
      role="status"
      className={cn(statusBannerVariants({ variant }), className)}
      {...props}
    >
      {icon ? <span className="shrink-0 mt-0.5">{icon}</span> : null}
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </div>
  )
}

export { StatusBanner, statusBannerVariants }
