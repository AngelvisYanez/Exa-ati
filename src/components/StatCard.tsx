import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  variant?: "default" | "dark" | "success" | "warning";
  className?: string;
};

const variants = {
  default: "bg-card border",
  dark: "bg-slate-900 text-white border-slate-800",
  success: "bg-emerald-50 border-emerald-200",
  warning: "bg-amber-50 border-amber-200",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
  className,
}: StatCardProps) {
  const isDark = variant === "dark";
  return (
    <Card className={cn(variants[variant], "shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle
          className={cn(
            "text-[10px] font-bold uppercase tracking-widest",
            isDark ? "text-slate-400" : "text-muted-foreground"
          )}
        >
          {title}
        </CardTitle>
        {icon && (
          <div
            className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center",
              isDark ? "bg-white/10" : "bg-muted"
            )}
          >
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-bold", isDark && "text-white")}>{value}</p>
        {subtitle && (
          <p
            className={cn(
              "text-xs mt-1",
              isDark ? "text-slate-400" : "text-muted-foreground"
            )}
          >
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiCard({
  label,
  value,
  count,
  loading,
}: {
  label: string;
  value: string;
  count?: number;
  loading?: boolean;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-xl font-bold mt-1">{loading ? "—" : value}</p>
        {count !== undefined && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{count} documentos</p>
        )}
      </CardContent>
    </Card>
  );
}
