import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  variant?: "default" | "success" | "warning";
  className?: string;
};

const variants = {
  default: "bg-card border",
  success: "bg-success-pale border-success-light/40",
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
  return (
    <Card className={cn(variants[variant], "shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && (
          <p className="text-xs mt-1 text-muted-foreground">{subtitle}</p>
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
    <Card className="shadow-sm border border-brand-gray-200 hover:shadow-md transition-shadow duration-200">
      <CardContent className="pt-4 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-400">
          {label}
        </p>
        <p className="text-xl font-bold text-brand-gray-900 mt-1 tabular-nums">{loading ? "—" : value}</p>
        {count !== undefined && (
          <p className="text-[11px] text-brand-gray-500 mt-0.5">{count} documentos</p>
        )}
      </CardContent>
    </Card>
  );
}
