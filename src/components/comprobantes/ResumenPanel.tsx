import type { ReactNode } from "react";
import { Check, UserRound, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ambienteTono, boton, esProduccion, money, nombreAmbiente, tarjeta, tono } from "./tokens";
import type { ResultadoEmision } from "./types";
import type { ChecklistEstado } from "./useChecklist";

interface ResumenPanelProps {
  ariaLabel: string;
  /** Rótulo de la cabecera oscura, p. ej. "FACTURA". */
  tipo: string;
  numero: string;
  ambiente: string;
  sujeto: {
    nombre: string;
    identificacion: string;
    /** Textos mientras el sujeto no está definido. */
    sinNombre: string;
    sinIdentificacion: string;
    icono?: LucideIcon;
  };
  /** Filas (`ResumenFila`) y total (`ResumenTotal`); la guía de remisión no lleva total. */
  children?: ReactNode;
}

export function ResumenPanel({ ariaLabel, tipo, numero, ambiente, sujeto, children }: ResumenPanelProps) {
  const Icono = sujeto.icono ?? UserRound;
  return (
    <section className={cn("overflow-hidden", tarjeta)} aria-label={ariaLabel}>
      <div className="bg-brand-gray-800 px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70">{tipo}</p>
            <p className="mt-1 font-mono text-sm tabular-nums">{numero}</p>
          </div>
          <span className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            esProduccion(ambiente) ? ambienteTono.pill.produccion : ambienteTono.pill.pruebas,
          )}>
            {nombreAmbiente(ambiente)}
          </span>
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-start gap-2 border-b border-brand-gray-100 pb-3">
          <Icono className="mt-0.5 size-4 shrink-0 text-brand-gray-400" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-brand-gray-900">{sujeto.nombre.trim() || sujeto.sinNombre}</p>
            <p className="font-mono text-xs text-brand-gray-500">
              {sujeto.identificacion.trim() || sujeto.sinIdentificacion}
            </p>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

export function ResumenFilas({ children }: { children: ReactNode }) {
  return <dl className="mt-3 space-y-1.5 text-sm">{children}</dl>;
}

export function ResumenFila({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-brand-gray-500">{label}</dt>
      <dd className="font-mono text-brand-gray-800 tabular-nums">{money(valor)}</dd>
    </div>
  );
}

export function ResumenTotal({ label, valor, detalle }: { label: string; valor: number; detalle?: ReactNode }) {
  return (
    <div className="mt-4 border-t border-brand-gray-100 pt-3">
      <p className="text-[11px] font-semibold tracking-wide text-brand-gray-500 uppercase">{label}</p>
      <p className="text-3xl font-semibold tracking-tight text-brand-red tabular-nums">{money(valor)}</p>
      {detalle && <p className="mt-1 text-xs text-brand-gray-500">{detalle}</p>}
    </div>
  );
}

interface ChecklistEmisionProps {
  /** Número del último paso del stepper; fija el ancla `paso-{n}`. */
  n: number;
  checklist: ChecklistEstado;
  titulo?: string;
  /** Botón de emitir o resultado (`AccionEmitir`). */
  children: ReactNode;
}

export function ChecklistEmision({ n, checklist, titulo = "Antes de emitir", children }: ChecklistEmisionProps) {
  return (
    <section id={`paso-${n}`} className={cn("scroll-mt-6 p-5", tarjeta)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-brand-gray-900">{titulo}</h2>
        <span className="text-xs font-medium text-brand-gray-500 tabular-nums">{checklist.completados}{` de ${checklist.total}`}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-gray-100" aria-hidden>
        <div className="h-full rounded-full bg-success transition-[width] duration-200" style={{ width: `${checklist.progreso}%` }} />
      </div>
      <ul className="mt-3 space-y-2">
        {checklist.items.map((item) => (
          <li key={item.label} className="flex items-start gap-2 text-[13px]">
            <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full", item.ok ? "bg-success text-white" : "bg-brand-gray-200 text-transparent")}>
              <Check className="size-3" aria-hidden />
            </span>
            <span className={item.ok ? "text-brand-gray-700" : "text-brand-gray-500"}>{item.label}</span>
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}

interface AccionEmitirProps {
  listo: boolean;
  emitiendo: boolean;
  resultado: ResultadoEmision | null;
  /** Texto del botón cuando todo está listo, p. ej. "Emitir factura · $12.00". */
  textoListo: string;
  textoPendiente?: string;
  textoOtra: string;
  onOtra: () => void;
  /** Acciones bajo el botón principal (p. ej. vista previa del RIDE). */
  extra?: ReactNode;
}

/** Botón de envío del formulario; tras emitir muestra el estado del SRI. */
export function AccionEmitir({
  listo, emitiendo, resultado, textoListo, textoPendiente = "Completa los pasos para emitir", textoOtra, onOtra, extra,
}: AccionEmitirProps) {
  if (resultado) {
    const mensaje = resultado.error?.mensaje || resultado.mensajes?.[0]?.mensaje;
    return (
      <div className={cn(
        "mt-4 rounded-xl border px-3 py-3 text-sm",
        resultado.estado === "AUTORIZADO" ? tono.exito : tono.avisoFuerte,
      )} role="status">
        <p className="font-semibold">Estado del SRI: {resultado.estado || "Sin estado"}</p>
        {resultado.numeroAutorizacion && <p className="mt-1 break-all font-mono text-xs">Autorización: {resultado.numeroAutorizacion}</p>}
        {resultado.claveAcceso && <p className="mt-1 break-all font-mono text-xs">Clave: {resultado.claveAcceso}</p>}
        {resultado.requierePolling && <p className="mt-1 text-xs">Enviado. El sistema consultará la autorización automáticamente.</p>}
        {mensaje && <p className="mt-1 text-xs">{mensaje}</p>}
        <Button type="button" onClick={onOtra} className={cn(boton.primario, "mt-3")}>
          {textoOtra}
        </Button>
      </div>
    );
  }
  return (
    <>
      <Button
        type="submit"
        disabled={!listo || emitiendo}
        className={cn(boton.primario, "mt-4 disabled:bg-brand-gray-200 disabled:text-brand-gray-500")}
      >
        {emitiendo ? "Emitiendo..." : listo ? textoListo : textoPendiente}
      </Button>
      {extra}
    </>
  );
}
