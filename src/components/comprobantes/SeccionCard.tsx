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
    <section id={`paso-${n}`} className={cn("min-w-0 scroll-mt-6 p-4", tarjeta)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-2.5">
          <span className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
            completa ? "bg-success" : "bg-brand-red",
          )}>
            {completa ? <Check className="size-3" aria-hidden /> : n}
          </span>
          <div>
            <h2 className="text-[15px] font-semibold leading-tight text-brand-gray-900">{titulo}</h2>
            <p className="mt-0.5 max-w-xl text-xs leading-snug text-brand-gray-500">{ayuda}</p>
          </div>
        </div>
        {accion}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}
