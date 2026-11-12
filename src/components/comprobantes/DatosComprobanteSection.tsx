"use client";

import PuntoEmisionSelect, { type SerieVisible } from "./PuntoEmisionSelect";
import { cn } from "@/lib/utils";
import SeccionCard from "./SeccionCard";
import { ambienteTono, esProduccion, nombreAmbiente, tono } from "./tokens";

interface DatosComprobanteSectionProps {
  n: number;
  titulo?: string;
  ayuda: string;
  completa: boolean;
  /** Código SRI del comprobante; filtra los puntos de emisión. */
  tipo: string;
  emisorRuc: string;
  fechaEmision: string;
  onFechaEmision: (value: string) => void;
  serieEmision: string;
  onSerieEmision: (value: string) => void;
  onSerieInfo: (info: SerieVisible | null) => void;
  /** Cambia tras emitir para refrescar el siguiente secuencial. */
  refresco?: string | null;
  /** Sin handler no se ofrece el secuencial manual. */
  secuencial?: string;
  onSecuencial?: (value: string) => void;
  ambiente: string;
  avisoAmbiente: { produccion: string; pruebas: string };
  /** La guía de remisión no lleva moneda. */
  mostrarMoneda?: boolean;
}

export default function DatosComprobanteSection({
  n, titulo = "Datos del comprobante", ayuda, completa, tipo,
  emisorRuc, fechaEmision, onFechaEmision,
  serieEmision, onSerieEmision, onSerieInfo, refresco, secuencial, onSecuencial,
  ambiente, avisoAmbiente, mostrarMoneda = true,
}: DatosComprobanteSectionProps) {
  const produccion = esProduccion(ambiente);

  return (
    <SeccionCard n={n} titulo={titulo} ayuda={ayuda} completa={completa}>
      <PuntoEmisionSelect
        ruc={emisorRuc}
        tipo={tipo}
        serie={serieEmision}
        onSerieChange={onSerieEmision}
        refresco={refresco}
        secuencial={secuencial}
        onSecuencial={onSecuencial}
        onSerieInfo={onSerieInfo}
        fechaEmision={fechaEmision}
        onFechaEmision={onFechaEmision}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="inline-flex items-center gap-2 text-[13px] text-brand-gray-600">
          <span className={cn("size-1.5 rounded-full", produccion ? ambienteTono.punto.produccion : ambienteTono.punto.pruebas)} aria-hidden />
          Ambiente
          <span className="font-semibold text-brand-gray-900">{nombreAmbiente(ambiente)}</span>
          <span className="text-xs text-brand-gray-500">· del establecimiento</span>
        </p>
        {mostrarMoneda && (
          <span className="inline-flex h-6 items-center rounded-full border border-brand-gray-200 bg-white px-2.5 text-[11px] font-medium text-brand-gray-600">
            USD · Dólar
          </span>
        )}
      </div>
      <p role="note" className={cn("mt-2 rounded-lg border px-2.5 py-1.5 text-xs leading-snug", produccion ? tono.exito : tono.aviso)}>
        {produccion ? avisoAmbiente.produccion : avisoAmbiente.pruebas}
      </p>
    </SeccionCard>
  );
}
