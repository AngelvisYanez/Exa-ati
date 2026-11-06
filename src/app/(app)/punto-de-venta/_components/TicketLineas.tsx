"use client";

import { memo, useState } from "react";
import { Minus, Plus, ShoppingCart, X } from "lucide-react";
import { formatoUSD, parseMonto, totalLinea, type LineaTicket } from "../_lib/pos-calc";

export default function TicketLineas({ lineas, onCantidad, onDescuento, onQuitar }: {
  lineas: LineaTicket[];
  onCantidad: (id: string, cantidad: number) => void;
  onDescuento: (id: string, descuento: number) => void;
  onQuitar: (id: string) => void;
}) {
  if (lineas.length === 0) {
    return (
      <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-pos-bg text-pos-muted">
          <ShoppingCart aria-hidden className="size-6" />
        </span>
        <p className="text-base font-semibold text-pos-ink">Venta vacía</p>
        <p className="max-w-[260px] text-sm text-pos-muted">Escanea un código o toca un producto para empezar</p>
      </div>
    );
  }

  return (
    <ul aria-label="Productos en la venta" className="@container min-h-0 flex-1 overflow-y-auto max-lg:max-h-[50vh]">
      {lineas.map((l) => (
        <Linea key={l.id} linea={l} onCantidad={onCantidad} onDescuento={onDescuento} onQuitar={onQuitar} />
      ))}
    </ul>
  );
}

const btnStep =
  "flex size-10 items-center justify-center rounded-[10px] text-pos-ink transition-colors hover:bg-pos-bg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-pos-brand/25";

const Linea = memo(function Linea({ linea: l, onCantidad, onDescuento, onQuitar }: {
  linea: LineaTicket;
  onCantidad: (id: string, cantidad: number) => void;
  onDescuento: (id: string, descuento: number) => void;
  onQuitar: (id: string) => void;
}) {
  const [verDescuento, setVerDescuento] = useState(l.descuento > 0);
  const [cantidadTexto, setCantidadTexto] = useState<string | null>(null);
  const descId = `desc-${l.id}`;

  function confirmarCantidad() {
    if (cantidadTexto === null) return;
    const n = parseMonto(cantidadTexto);
    setCantidadTexto(null);
    if (n > 0) onCantidad(l.id, n);
  }

  return (
    <li className="border-b border-pos-line px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <div className="min-w-0 flex-1 @max-[400px]:contents">
          <p className="truncate text-sm font-semibold text-pos-ink @max-[400px]:basis-full" title={l.descripcion}>{l.descripcion}</p>
          <button
            type="button"
            onClick={() => setVerDescuento((v) => !v)}
            aria-expanded={verDescuento}
            aria-controls={descId}
            aria-label={`${formatoUSD(l.precioUnitario)} cada uno, IVA ${l.ivaPorcentaje}%. ${verDescuento ? "Ocultar" : "Mostrar"} descuento`}
            className="rounded text-left text-xs text-pos-muted tabular-nums underline-offset-2 @max-[400px]:min-w-0 @max-[400px]:flex-1 hover:text-pos-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pos-brand/25"
          >
            {formatoUSD(l.precioUnitario)} c/u · IVA {l.ivaPorcentaje}%
            {l.descuento > 0 && <span className="text-pos-brand"> · −{formatoUSD(l.descuento)}</span>}
          </button>
        </div>

        <div className="flex shrink-0 items-center rounded-xl border border-pos-line-strong">
          <button
            type="button"
            className={btnStep}
            aria-label={l.cantidad <= 1 ? `Quitar ${l.descripcion}` : `Restar uno de ${l.descripcion}`}
            onClick={() => (l.cantidad <= 1 ? onQuitar(l.id) : onCantidad(l.id, l.cantidad - 1))}
          >
            <Minus aria-hidden className="size-4" />
          </button>
          <input
            inputMode="decimal"
            aria-label={`Cantidad de ${l.descripcion}`}
            value={cantidadTexto ?? String(l.cantidad)}
            onChange={(e) => setCantidadTexto(e.target.value)}
            onBlur={confirmarCantidad}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className="h-10 w-10 bg-transparent text-center text-sm font-semibold text-pos-ink tabular-nums outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-pos-brand/25"
          />
          <button
            type="button"
            className={btnStep}
            aria-label={`Sumar uno a ${l.descripcion}`}
            onClick={() => onCantidad(l.id, l.cantidad + 1)}
          >
            <Plus aria-hidden className="size-4" />
          </button>
        </div>

        <span className="w-[68px] shrink-0 text-right text-[15px] font-bold text-pos-ink tabular-nums">
          {formatoUSD(totalLinea(l))}
        </span>
        <button
          type="button"
          onClick={() => onQuitar(l.id)}
          aria-label={`Quitar ${l.descripcion}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-pos-muted transition-colors hover:bg-pos-bg hover:text-pos-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-pos-brand/25"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {verDescuento && (
        <div id={descId} className="mt-2 flex items-center gap-2">
          <label htmlFor={`${descId}-input`} className="text-xs text-pos-muted">Descuento de la línea ($)</label>
          <input
            id={`${descId}-input`}
            inputMode="decimal"
            defaultValue={l.descuento ? String(l.descuento) : ""}
            placeholder="0.00"
            onChange={(e) => {
              const bruto = l.cantidad * l.precioUnitario;
              const d = Math.min(Math.max(parseMonto(e.target.value), 0), bruto);
              onDescuento(l.id, Number(d.toFixed(2)));
            }}
            onBlur={(e) => {
              e.target.value = l.descuento ? String(l.descuento) : "";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className="h-9 w-24 rounded-lg border border-pos-line-strong px-2 text-right text-sm tabular-nums outline-none focus-visible:border-pos-brand focus-visible:ring-2 focus-visible:ring-pos-brand/20"
          />
        </div>
      )}
    </li>
  );
});
