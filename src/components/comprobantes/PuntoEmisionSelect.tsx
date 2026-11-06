"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { control as controlClass } from "./tokens";

interface AutorizacionesApi {
  establecimientos: {
    codigo: string;
    direccion: string;
    ciudad: string;
    ambiente: string;
    tipos: { tipo: string; puntos: { puntoEmision: string; siguiente: string }[] }[];
  }[];
}

export interface SerieVisible {
  estab: string;
  pto: string;
  siguiente: string;
  ambiente: string;
}

interface OpcionSerie extends SerieVisible {
  serie: string;
  lugar: string;
}

interface PuntoEmisionSelectProps {
  ruc: string;
  tipo: string;
  serie: string;
  onSerieChange: (serie: string) => void;
  refresco?: string | null;
  secuencial?: string;
  onSecuencial?: (value: string) => void;
  onSerieInfo?: (serie: SerieVisible | null) => void;
  className?: string;
}

function opcionesDelTipo(data: AutorizacionesApi, tipo: string): OpcionSerie[] {
  return data.establecimientos.flatMap((estab) => {
    const lugar = estab.ciudad || estab.direccion;
    const puntos = estab.tipos.find((item) => item.tipo === tipo)?.puntos ?? [];
    return puntos.map((punto) => ({
      serie: `${estab.codigo}-${punto.puntoEmision}`,
      estab: estab.codigo,
      pto: punto.puntoEmision,
      siguiente: punto.siguiente,
      ambiente: estab.ambiente,
      lugar,
    }));
  });
}

function serieVisible(opcion: OpcionSerie): SerieVisible {
  return { estab: opcion.estab, pto: opcion.pto, siguiente: opcion.siguiente, ambiente: opcion.ambiente };
}

export default function PuntoEmisionSelect({
  ruc,
  tipo,
  serie,
  onSerieChange,
  refresco,
  secuencial,
  onSecuencial,
  onSerieInfo,
  className,
}: PuntoEmisionSelectProps) {
  const [opciones, setOpciones] = useState<OpcionSerie[]>([]);
  const [error, setError] = useState<string | null>(null);
  const onInfoRef = useRef(onSerieInfo);
  const onChangeRef = useRef(onSerieChange);
  const serieRef = useRef(serie);
  useEffect(() => {
    onInfoRef.current = onSerieInfo;
    onChangeRef.current = onSerieChange;
    serieRef.current = serie;
  });

  useEffect(() => {
    if (!ruc) {
      onInfoRef.current?.(null);
      return;
    }
    let vigente = true;
    apiFetch(`/api/sri/series?ruc=${encodeURIComponent(ruc)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "No se pudieron leer los puntos de emisión");
        return body.autorizaciones as AutorizacionesApi;
      })
      .then((data) => {
        if (!vigente) return;
        const lista = opcionesDelTipo(data, tipo);
        setOpciones(lista);
        setError(null);
        const elegida = lista.find((item) => item.serie === serieRef.current) ?? lista[0];
        if (elegida && elegida.serie !== serieRef.current) onChangeRef.current(elegida.serie);
        onInfoRef.current?.(elegida ? serieVisible(elegida) : null);
      })
      .catch((err: Error) => {
        if (!vigente) return;
        setError(err.message);
        onInfoRef.current?.(null);
      });
    return () => {
      vigente = false;
    };
  }, [ruc, tipo, refresco]);

  useEffect(() => {
    const elegida = opciones.find((item) => item.serie === serie);
    if (!elegida) return;
    onInfoRef.current?.(serieVisible(elegida));
  }, [serie, opciones]);

  const actual = opciones.find((item) => item.serie === serie) ?? opciones[0];

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`punto-emision-${tipo}`}>Establecimiento y punto de emisión</Label>
        <select
          id={`punto-emision-${tipo}`}
          value={actual?.serie || ""}
          onChange={(event) => onSerieChange(event.target.value)}
          className={controlClass}
          disabled={!ruc || opciones.length === 0}
        >
          {opciones.length === 0 && <option value="">Sin puntos configurados</option>}
          {opciones.map((item) => (
            <option key={item.serie} value={item.serie}>
              {item.serie}{item.lugar ? ` · ${item.lugar}` : ""} · {item.ambiente === "2" ? "Producción" : "Pruebas"} · siguiente {item.siguiente}
            </option>
          ))}
        </select>
        <p className="text-[13px] text-brand-gray-500">
          <Link href="/autorizaciones" className="font-medium text-brand-red hover:underline">Autorizaciones</Link>
          {" "}define los establecimientos, su ambiente y los puntos de este comprobante.
        </p>
        {error && <p className="text-sm text-orange-900" role="alert">{error}</p>}
      </div>
      {onSecuencial && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`secuencial-manual-${tipo}`}>Número de esta emisión (opcional)</Label>
          <Input
            id={`secuencial-manual-${tipo}`}
            inputMode="numeric"
            value={secuencial ?? ""}
            onChange={(event) => onSecuencial(event.target.value.replace(/\D/g, "").slice(0, 9))}
            placeholder={actual?.siguiente || "000000001"}
            className={cn(controlClass, "font-mono tabular-nums")}
          />
          <p className="text-[13px] text-brand-gray-500">Vacío: se usa el siguiente del punto elegido.</p>
        </div>
      )}
    </div>
  );
}
