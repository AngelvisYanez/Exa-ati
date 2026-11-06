"use client";

import { useId } from "react";
import PuntoEmisionSelect, { type SerieVisible } from "./PuntoEmisionSelect";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Campo from "./Campo";
import SeccionCard from "./SeccionCard";
import { ambienteTono, control, esProduccion, nombreAmbiente, tono } from "./tokens";
import type { EmisorOpcion, SerieCorta } from "./types";

interface DatosComprobanteSectionProps {
  n: number;
  titulo?: string;
  ayuda: string;
  completa: boolean;
  /** Código SRI del comprobante; filtra los puntos de emisión. */
  tipo: string;
  emisores: EmisorOpcion[];
  loadingEmisores: boolean;
  emisorRuc: string;
  onEmisorRuc: (ruc: string) => void;
  fechaEmision: string;
  onFechaEmision: (value: string) => void;
  serieEmision: string;
  onSerieEmision: (value: string) => void;
  /** Serie mostrada bajo el emisor; null muestra cómo configurarla. */
  serie: SerieCorta | null;
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
  emisores, loadingEmisores, emisorRuc, onEmisorRuc, fechaEmision, onFechaEmision,
  serieEmision, onSerieEmision, serie, onSerieInfo, refresco, secuencial, onSecuencial,
  ambiente, avisoAmbiente, mostrarMoneda = true,
}: DatosComprobanteSectionProps) {
  const baseId = useId();
  const produccion = esProduccion(ambiente);

  return (
    <SeccionCard n={n} titulo={titulo} ayuda={ayuda} completa={completa}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id={`${baseId}-emisor`}
          label="RUC emisor"
          requerido
          className="sm:col-span-2"
          hint={serie ? `Serie ${serie.estab}-${serie.pto}` : "Configura el establecimiento y el punto de emisión en la numeración."}
        >
          {loadingEmisores ? (
            <Input id={`${baseId}-emisor`} value="Cargando..." disabled className={control} />
          ) : (
            <select
              id={`${baseId}-emisor`}
              required
              value={emisorRuc}
              onChange={(event) => onEmisorRuc(event.target.value)}
              className={control}
            >
              <option value="">Seleccionar RUC...</option>
              {emisores.map((item) => (
                <option key={item.ruc} value={item.ruc}>{item.ruc} — {item.razonSocial}</option>
              ))}
            </select>
          )}
        </Campo>
        <Campo id={`${baseId}-fecha`} label="Fecha de emisión" requerido>
          <Input id={`${baseId}-fecha`} type="date" required value={fechaEmision} onChange={(event) => onFechaEmision(event.target.value)} className={control} />
        </Campo>
      </div>
      <div className="mt-4">
        <PuntoEmisionSelect
          ruc={emisorRuc}
          tipo={tipo}
          serie={serieEmision}
          onSerieChange={onSerieEmision}
          refresco={refresco}
          secuencial={secuencial}
          onSecuencial={onSecuencial}
          onSerieInfo={onSerieInfo}
        />
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-brand-gray-200 bg-brand-gray-50 px-4 text-sm text-brand-gray-600">
          <span className={cn("size-2 rounded-full", produccion ? ambienteTono.punto.produccion : ambienteTono.punto.pruebas)} aria-hidden />
          Ambiente
          <span className="font-semibold text-brand-gray-900">{nombreAmbiente(ambiente)}</span>
          <span className="text-[13px] text-brand-gray-500">· del establecimiento</span>
        </p>
        {mostrarMoneda && (
          <span className="inline-flex h-8 items-center rounded-full border border-brand-gray-200 bg-white px-3 text-xs font-medium text-brand-gray-600">
            USD · Dólar
          </span>
        )}
      </div>
      <p role="note" className={cn("mt-3 rounded-xl border px-3 py-2.5 text-[13px]", produccion ? tono.exito : tono.aviso)}>
        {produccion ? avisoAmbiente.produccion : avisoAmbiente.pruebas}
      </p>
    </SeccionCard>
  );
}
