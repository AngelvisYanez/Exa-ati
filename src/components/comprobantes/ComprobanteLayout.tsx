"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Stepper from "./Stepper";
import { boton, foco } from "./tokens";
import type { PasoInput } from "./useChecklist";

interface ComprobanteLayoutProps {
  /** Título de la página, p. ej. "Nueva factura electrónica". */
  titulo: string;
  /** Último tramo de la miga de pan, p. ej. "Nueva factura". */
  miga: string;
  pasos: readonly PasoInput[];
  ariaPasos: string;
  onCambiarTipo: () => void;
  /** Sin handler no se muestra "Guardar borrador". */
  onGuardarBorrador?: () => void;
  onSubmit: () => void;
  /** Columna izquierda: las secciones del formulario. */
  children: ReactNode;
  /** Columna derecha, fija en escritorio y debajo del formulario por debajo de 1024px. */
  resumen: ReactNode;
}

export default function ComprobanteLayout({
  titulo, miga, pasos, ariaPasos, onCambiarTipo, onGuardarBorrador, onSubmit, children, resumen,
}: ComprobanteLayoutProps) {
  return (
    <main className="ui-page flex-1 bg-brand-gray-50">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <nav aria-label="Miga de pan" className="flex flex-wrap items-center gap-1 text-xs text-brand-gray-500">
            <button type="button" onClick={onCambiarTipo} className={cn("rounded-sm hover:text-brand-gray-800", foco)}>
              Emisión
            </button>
            <ChevronRight className="size-3.5" aria-hidden />
            <Link href="/comprobantes" className={cn("rounded-sm hover:text-brand-gray-800", foco)}>
              Comprobantes
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <span className="text-brand-gray-800">{miga}</span>
          </nav>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-gray-900">{titulo}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onCambiarTipo} className={cn(boton.secundario, "px-4")}>
            Cambiar tipo de comprobante
          </Button>
          {onGuardarBorrador && (
            <Button type="button" variant="outline" onClick={onGuardarBorrador} className="h-11 rounded-[10px] px-4">
              Guardar borrador
            </Button>
          )}
        </div>
      </header>

      <Stepper pasos={pasos} ariaLabel={ariaPasos} />

      <form
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">{resumen}</aside>
      </form>
    </main>
  );
}
