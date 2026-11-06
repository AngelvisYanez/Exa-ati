import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { tarjeta } from "./tokens";

interface SeccionCardProps {
  /** Número del paso; también fija el ancla `paso-{n}` que usa el stepper. */
  n: number;
  titulo: string;
  ayuda: string;
  completa: boolean;
  accion?: ReactNode;
  children: ReactNode;
}

export default function SeccionCard({ n, titulo, ayuda, completa, accion, children }: SeccionCardProps) {
  return (
    <section id={`paso-${n}`} className={cn("min-w-0 scroll-mt-6 p-4 sm:p-6", tarjeta)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
            completa ? "bg-success" : "bg-brand-red",
          )}>
            {completa ? <Check className="size-3.5" aria-hidden /> : n}
          </span>
          <div>
            <h2 className="text-base font-semibold text-brand-gray-900">{titulo}</h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-brand-gray-500">{ayuda}</p>
          </div>
        </div>
        {accion}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
