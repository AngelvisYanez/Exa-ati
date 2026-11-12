import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CampoProps {
  id: string;
  label: string;
  requerido?: boolean;
  /** Se renderiza con id `{id}-hint` para enlazarlo con aria-describedby. */
  hint?: string;
  hintClass?: string;
  className?: string;
  children: ReactNode;
}

export default function Campo({ id, label, requerido, hint, hintClass, className, children }: CampoProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label htmlFor={id} className="text-[13px] text-brand-gray-700">
        {label}
        {requerido && <span className="text-brand-red"> *</span>}
      </Label>
      {children}
      {hint && <p id={`${id}-hint`} className={cn("text-[11px] leading-snug text-brand-gray-500", hintClass)}>{hint}</p>}
    </div>
  );
}
