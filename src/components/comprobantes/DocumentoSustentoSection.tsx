"use client";

import { useEffect, useId, useState } from "react";
import { FileSearch, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import Campo from "./Campo";
import SeccionCard from "./SeccionCard";
import {
  filtrarCandidatos,
  formatearNumeroDocumento,
  type ComprobanteListado,
  type DocumentoSustento,
  type OrigenDocumento,
} from "./documento-sustento";
import { FORMATO_NUMERO_DOCUMENTO } from "./numeracion";
import { control, money } from "./tokens";

const TEXTOS_ORIGEN: Record<OrigenDocumento, { buscar: string; vacio: string }> = {
  emitidos: { buscar: "Buscar en mis comprobantes emitidos", vacio: "Ningún comprobante emitido coincide." },
  recibidos: { buscar: "Buscar en mis comprobantes recibidos", vacio: "Ningún comprobante recibido coincide." },
};

interface DocumentoSustentoSectionProps {
  n: number;
  titulo: string;
  ayuda: string;
  completa: boolean;
  /** NC y ND modifican un comprobante emitido; la retención se hace sobre uno recibido. */
  origen: OrigenDocumento;
  /** RUC del emisor seleccionado: define qué es emitido y qué es recibido. */
  ruc: string;
  tiposDocumento: readonly { value: string; label: string }[];
  valor: DocumentoSustento;
  onChange: (valor: DocumentoSustento) => void;
}

export default function DocumentoSustentoSection({
  n, titulo, ayuda, completa, origen, ruc, tiposDocumento, valor, onChange,
}: DocumentoSustentoSectionProps) {
  const baseId = useId();
  const textos = TEXTOS_ORIGEN[origen];
  const [busqueda, setBusqueda] = useState("");
  const [listados, setListados] = useState<Record<string, ComprobanteListado[] | null>>({});
  const consulta = busqueda.trim();
  const clave = `${ruc}|${valor.codDoc}`;
  const necesita = Boolean(consulta && ruc);
  const filas = listados[clave];
  const cargando = necesita && filas === undefined;

  useEffect(() => {
    if (!necesita || clave in listados) return;
    let vigente = true;
    const params = new URLSearchParams({ rucEmisor: ruc, tipo: valor.codDoc, limit: "200" });
    apiFetch(`/api/sri/comprobantes?${params}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.message);
        return Array.isArray(body.data) ? (body.data as ComprobanteListado[]) : [];
      })
      .then((data) => { if (vigente) setListados((prev) => ({ ...prev, [clave]: data })); })
      .catch(() => { if (vigente) setListados((prev) => ({ ...prev, [clave]: null })); });
    return () => { vigente = false; };
  }, [necesita, clave, listados, ruc, valor.codDoc]);

  const candidatos = filas
    ? filtrarCandidatos(filas, { ruc, origen, codDoc: valor.codDoc, consulta })
    : [];
  const numeroValido = FORMATO_NUMERO_DOCUMENTO.test(valor.numero);
  const autorizacionValida = /^(\d{10}|\d{37}|\d{49})$/.test(valor.autorizacion);

  return (
    <SeccionCard n={n} titulo={titulo} ayuda={ayuda} completa={completa}>
      {tiposDocumento.length > 1 && (
        <Campo id={`${baseId}-tipo`} label="Tipo de documento" className="mb-4">
          <select
            id={`${baseId}-tipo`}
            value={valor.codDoc}
            onChange={(event) => onChange({ ...valor, codDoc: event.target.value })}
            className={control}
          >
            {tiposDocumento.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
          </select>
        </Campo>
      )}
      <Campo id={`${baseId}-buscar`} label={textos.buscar} hint={ruc ? undefined : "Elige primero el RUC emisor."}>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-gray-400" aria-hidden />
          <Input
            id={`${baseId}-buscar`}
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
            placeholder="Número, p. ej. 001-001-000000123"
            autoComplete="off"
            disabled={!ruc}
            className={cn(control, "pl-9 font-mono")}
          />
        </div>
      </Campo>
      {necesita && (
        <ul className="mt-2 overflow-hidden rounded-[10px] border border-brand-gray-200 bg-white" aria-label="Comprobantes encontrados" aria-busy={cargando}>
          {cargando ? (
            <li className="px-3 py-2 text-sm text-brand-gray-500">Buscando…</li>
          ) : filas === null ? (
            <li className="px-3 py-2 text-sm text-brand-gray-500">No se pudo consultar. Ingresa los datos a mano.</li>
          ) : candidatos.length === 0 ? (
            <li className="px-3 py-2 text-sm text-brand-gray-500">{textos.vacio}</li>
          ) : candidatos.map((item) => (
            <li key={item.clave}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-brand-gray-50 focus-visible:bg-brand-red-subtle focus-visible:outline-none"
                onClick={() => {
                  onChange({ ...valor, numero: item.numero, fecha: item.fecha, autorizacion: item.autorizacion });
                  setBusqueda(item.numero);
                }}
              >
                <FileSearch className="size-4 shrink-0 text-brand-gray-400" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono font-medium text-brand-gray-900 tabular-nums">{item.numero}</span>
                  <span className="block truncate text-xs text-brand-gray-500">{item.fecha} · {item.contraparte}</span>
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums">{money(item.total)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="my-3 flex items-center gap-3 text-[11px] font-semibold tracking-wide text-brand-gray-400 uppercase">
        <span className="h-px flex-1 bg-brand-gray-200" aria-hidden />
        o ingresa los datos
        <span className="h-px flex-1 bg-brand-gray-200" aria-hidden />
      </div>

      <div className="grid gap-x-4 gap-y-3 lg:grid-cols-3">
        <Campo
          id={`${baseId}-numero`}
          label="Número del comprobante"
          requerido
          hint={valor.numero && !numeroValido ? "Formato 001-001-000000123." : "Establecimiento, punto y secuencial."}
          hintClass={valor.numero ? (numeroValido ? "text-success" : "text-brand-red") : undefined}
        >
          <Input
            id={`${baseId}-numero`}
            required
            value={valor.numero}
            onChange={(event) => onChange({ ...valor, numero: formatearNumeroDocumento(event.target.value) })}
            aria-invalid={Boolean(valor.numero) && !numeroValido}
            aria-describedby={`${baseId}-numero-hint`}
            inputMode="numeric"
            placeholder="001-001-000000123"
            className={cn(control, "font-mono tabular-nums", valor.numero && !numeroValido && "border-brand-red")}
          />
        </Campo>
        <Campo id={`${baseId}-fecha`} label="Fecha de emisión" requerido>
          <Input id={`${baseId}-fecha`} type="date" required value={valor.fecha} onChange={(event) => onChange({ ...valor, fecha: event.target.value })} className={control} />
        </Campo>
        <Campo
          id={`${baseId}-aut`}
          label="N.º de autorización"
          requerido
          hint={valor.autorizacion && !autorizacionValida ? "10, 37 o 49 dígitos." : "Está en el RIDE del comprobante."}
          hintClass={valor.autorizacion && !autorizacionValida ? "text-brand-red" : undefined}
        >
          <Input
            id={`${baseId}-aut`}
            required
            value={valor.autorizacion}
            onChange={(event) => onChange({ ...valor, autorizacion: event.target.value.replace(/\D/g, "").slice(0, 49) })}
            aria-invalid={Boolean(valor.autorizacion) && !autorizacionValida}
            aria-describedby={`${baseId}-aut-hint`}
            inputMode="numeric"
            className={cn(control, "font-mono tabular-nums", valor.autorizacion && !autorizacionValida && "border-brand-red")}
          />
        </Campo>
      </div>
    </SeccionCard>
  );
}
