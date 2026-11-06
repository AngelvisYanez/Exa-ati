"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { foco } from "./tokens";
import { useStepper, type PasoInput } from "./useChecklist";

interface StepperProps {
  pasos: readonly PasoInput[];
  ariaLabel: string;
}

function irAlPaso(n: number) {
  document.getElementById(`paso-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Stepper({ pasos, ariaLabel }: StepperProps) {
  const { steps, actual } = useStepper(pasos);
  return (
    <ol aria-label={ariaLabel} className="flex items-center gap-2 overflow-x-auto pb-1">
      {steps.map((paso, index) => {
        const esActual = paso.n === actual;
        return (
          <li key={paso.n} className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => irAlPaso(paso.n)}
              className={cn("flex items-center gap-2 rounded-full py-1 pr-2", foco)}
              aria-current={esActual ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  paso.estado === "completo" && "bg-success text-white",
                  paso.estado === "actual" && "bg-brand-red text-white ring-4 ring-brand-red/15",
                  paso.estado === "pendiente" && "bg-brand-gray-200 text-brand-gray-500",
                )}
              >
                {paso.estado === "completo" ? <Check className="size-3.5" aria-hidden /> : paso.n}
              </span>
              <span className={cn("text-sm whitespace-nowrap", esActual ? "font-semibold text-brand-gray-900" : "text-brand-gray-500")}>
                {paso.label}
              </span>
            </button>
            {index < steps.length - 1 && <span className="hidden h-px w-6 shrink-0 bg-brand-gray-200 sm:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
