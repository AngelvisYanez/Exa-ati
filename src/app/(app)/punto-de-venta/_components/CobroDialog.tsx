"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, CircleCheckBig, LoaderCircle, Printer, TriangleAlert } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import Kbd from "./Kbd";
import { posFont } from "../_lib/pos-font";
import { FORMAS_PAGO_POS, LIMITE_CONSUMIDOR_FINAL, POS_FEATURES, type FormaPagoCodigo } from "../_lib/pos-config";
import { enterEnCampo, formatoUSD, montosRapidos, parseMonto, redondear2 } from "../_lib/pos-calc";

export interface ResultadoVenta {
  claveAcceso: string;
  numero: string | null;
  total: number;
  vuelto: number;
  /** null mientras se consulta el estado. */
  estado: string | null;
  numeroAutorizacion: string | null;
}

export default function CobroDialog(props: {
  open: boolean;
  total: number;
  formaPago: FormaPagoCodigo;
  propina: number;
  onPropina: (n: number) => void;
  observaciones: string;
  onObservaciones: (s: string) => void;
  excedeLimiteCF: boolean;
  emitiendo: boolean;
  resultado: ResultadoVenta | null;
  onConfirmar: (vuelto: number) => void;
  onCerrar: () => void;
  onNuevaVenta: () => void;
  onImprimir: () => void;
}) {
  const { open, emitiendo, resultado, onCerrar, onNuevaVenta, formaPago } = props;
  const inicialRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog
      open={open}
      onClose={emitiendo ? undefined : resultado ? onNuevaVenta : onCerrar}
      title={resultado ? "Venta registrada" : "Cobrar venta"}
      size="md"
      closeOnOverlay={!emitiendo && !resultado}
      showClose={!emitiendo}
      panelClassName={posFont.className}
      initialFocusRef={inicialRef}
    >
      {open && (resultado ? (
        <Exito resultado={resultado} formaPago={formaPago} onNuevaVenta={onNuevaVenta} onImprimir={props.onImprimir} />
      ) : (
        <Cobro {...props} inicialRef={inicialRef} />
      ))}
    </Dialog>
  );
}

function Cobro({
  total,
  formaPago,
  propina,
  onPropina,
  observaciones,
  onObservaciones,
  excedeLimiteCF,
  emitiendo,
  onConfirmar,
  inicialRef,
}: Parameters<typeof CobroDialog>[0] & { inicialRef: React.RefObject<HTMLElement | null> }) {
  const efectivo = formaPago === "01";
  const etiquetaPago = FORMAS_PAGO_POS.find((f) => f.value === formaPago)?.label ?? "";
  const [recibido, setRecibido] = useState("");
  const [referencia, setReferencia] = useState("");
  const [masOpciones, setMasOpciones] = useState(propina > 0 || observaciones.length > 0);
  const [propinaTexto, setPropinaTexto] = useState(propina > 0 ? String(propina) : "");

  const montoRecibido = parseMonto(recibido);
  const vuelto = redondear2(montoRecibido - total);
  const faltaEfectivo = efectivo && (recibido.trim() === "" || vuelto < 0);
  const puedeConfirmar = !emitiendo && !excedeLimiteCF && !faltaEfectivo;

  function confirmar() {
    if (puedeConfirmar) onConfirmar(efectivo ? Math.max(vuelto, 0) : 0);
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        confirmar();
      }}
      onKeyDown={(e) => enterEnCampo(e, confirmar)}
      className="flex flex-col gap-4"
    >
      <div className="rounded-2xl bg-pos-bg px-4 py-3 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wider text-pos-muted">Total a cobrar · {etiquetaPago}</p>
        <p className="mt-1 text-4xl font-extrabold text-pos-brand tabular-nums" aria-live="polite">{formatoUSD(total)}</p>
      </div>

      {efectivo ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="pos-recibido" className="text-sm font-semibold text-pos-ink">Recibido del cliente</label>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-pos-muted">$</span>
            <input
              id="pos-recibido"
              ref={inicialRef as React.RefObject<HTMLInputElement>}
              inputMode="decimal"
              autoComplete="off"
              value={recibido}
              onChange={(e) => setRecibido(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="0.00"
              className="h-[60px] w-full rounded-xl border border-pos-line-strong bg-white pl-9 pr-4 text-right text-3xl font-bold text-pos-ink tabular-nums outline-none focus-visible:border-pos-brand focus-visible:ring-3 focus-visible:ring-pos-brand/15"
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {montosRapidos(total).map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => setRecibido(m.monto.toFixed(2))}
                className="h-11 rounded-xl border border-pos-line-strong bg-white text-sm font-semibold text-pos-ink tabular-nums hover:bg-pos-bg"
              >
                {m.label}
              </button>
            ))}
          </div>
          <div
            role="status"
            className={`flex items-center justify-between rounded-xl px-4 py-3 ${
              recibido.trim() === "" ? "bg-pos-bg text-pos-muted" : vuelto >= 0 ? "bg-pos-ok-bg text-pos-ok" : "bg-red-50 text-red-700"
            }`}
          >
            <span className="text-sm font-bold uppercase tracking-wide">
              {recibido.trim() !== "" && vuelto < 0 ? "Falta" : "Vuelto"}
            </span>
            <span className="text-3xl font-extrabold tabular-nums">
              {recibido.trim() === "" ? "—" : formatoUSD(Math.abs(vuelto))}
            </span>
          </div>
        </div>
      ) : POS_FEATURES.referenciaPago ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pos-referencia" className="text-sm font-semibold text-pos-ink">
            N.º de referencia / voucher <span className="font-normal text-pos-muted">(opcional)</span>
          </label>
          <input
            id="pos-referencia"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            className="h-12 rounded-xl border border-pos-line-strong px-3.5 text-base outline-none focus-visible:border-pos-brand focus-visible:ring-3 focus-visible:ring-pos-brand/15"
          />
        </div>
      ) : null}

      <div className="rounded-xl border border-pos-line">
        <button
          type="button"
          onClick={() => setMasOpciones((v) => !v)}
          aria-expanded={masOpciones}
          aria-controls="pos-mas-opciones"
          className="flex h-11 w-full items-center justify-between px-4 text-sm font-semibold text-pos-ink"
        >
          Más opciones
          <ChevronDown aria-hidden className={`size-4 transition-transform ${masOpciones ? "rotate-180" : ""}`} />
        </button>
        {masOpciones && (
          <div id="pos-mas-opciones" className="grid gap-3 border-t border-pos-line p-4 sm:grid-cols-[140px_1fr]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pos-propina" className="text-sm font-medium text-pos-ink">Propina ($)</label>
              <input
                id="pos-propina"
                inputMode="decimal"
                value={propinaTexto}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d.,]/g, "");
                  setPropinaTexto(v);
                  onPropina(Math.max(parseMonto(v), 0));
                }}
                placeholder="0.00"
                className="h-11 rounded-xl border border-pos-line-strong px-3 text-right text-base tabular-nums outline-none focus-visible:border-pos-brand focus-visible:ring-3 focus-visible:ring-pos-brand/15"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pos-observaciones" className="text-sm font-medium text-pos-ink">Observaciones</label>
              <input
                id="pos-observaciones"
                value={observaciones}
                onChange={(e) => onObservaciones(e.target.value)}
                placeholder="Opcional"
                className="h-11 rounded-xl border border-pos-line-strong px-3 text-base outline-none focus-visible:border-pos-brand focus-visible:ring-3 focus-visible:ring-pos-brand/15"
              />
            </div>
          </div>
        )}
      </div>

      {excedeLimiteCF && (
        <p role="alert" className="flex gap-2 rounded-xl bg-pos-warn-bg p-3 text-[13px] text-pos-warn">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          Supera {formatoUSD(LIMITE_CONSUMIDOR_FINAL)}: el SRI exige los datos del cliente.
        </p>
      )}

      <button
        ref={efectivo ? undefined : (inicialRef as React.RefObject<HTMLButtonElement>)}
        type="submit"
        disabled={!puedeConfirmar}
        className="flex h-14 items-center justify-center gap-2.5 rounded-[14px] bg-pos-ok text-base font-bold text-white transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pos-ok/30 disabled:cursor-not-allowed disabled:bg-pos-line-strong disabled:text-pos-muted"
      >
        {emitiendo ? (
          <>
            <LoaderCircle aria-hidden className="size-5 animate-spin" /> Facturando…
          </>
        ) : (
          <>
            Confirmar y facturar <Kbd tone={puedeConfirmar ? "dark" : "light"}>Enter</Kbd>
          </>
        )}
      </button>
    </form>
  );
}

function Exito({ resultado: r, formaPago, onNuevaVenta, onImprimir }: {
  resultado: ResultadoVenta;
  formaPago: FormaPagoCodigo;
  onNuevaVenta: () => void;
  onImprimir: () => void;
}) {
  const nuevaRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    nuevaRef.current?.focus();
  }, []);

  const autorizada = r.estado === "AUTORIZADO";
  const rechazada = r.estado === "RECHAZADO" || r.estado === "DEVUELTA";

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-pos-ok-bg">
        <CircleCheckBig aria-hidden className="size-9 text-pos-ok" />
      </span>
      <div>
        <p className="text-2xl font-extrabold text-pos-ink">¡Venta registrada!</p>
        <p className="mt-1 text-sm text-pos-muted tabular-nums">
          Factura {r.numero ?? "—"} · {formatoUSD(r.total)}
        </p>
      </div>

      <div className="w-full rounded-xl bg-pos-bg px-4 py-3 text-left text-sm" aria-live="polite">
        {r.estado === null ? (
          <p className="flex items-center gap-2 text-pos-muted">
            <LoaderCircle aria-hidden className="size-4 animate-spin" /> Consultando autorización del SRI…
          </p>
        ) : autorizada ? (
          <>
            <p className="font-semibold text-pos-ok">Autorizada por el SRI</p>
            <p className="mt-1 break-all font-mono text-xs text-pos-muted">{r.numeroAutorizacion ?? r.claveAcceso}</p>
          </>
        ) : (
          <>
            <p className={`font-semibold ${rechazada ? "text-red-700" : "text-pos-warn"}`}>
              {rechazada ? `SRI: ${r.estado}` : `Autorización pendiente (${r.estado})`}
            </p>
            <p className="mt-1 break-all font-mono text-xs text-pos-muted">Clave: {r.claveAcceso}</p>
          </>
        )}
      </div>

      {formaPago === "01" && r.vuelto > 0 && (
        <div className="w-full rounded-xl bg-pos-ok-bg px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-pos-ok">Entregar vuelto</p>
          <p className="text-4xl font-extrabold text-pos-ok tabular-nums">{formatoUSD(r.vuelto)}</p>
        </div>
      )}

      <div className="grid w-full grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onImprimir}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-pos-line-strong bg-white text-sm font-semibold text-pos-ink hover:bg-pos-panel"
        >
          <Printer aria-hidden className="size-4" /> Imprimir ticket
        </button>
        <button
          ref={nuevaRef}
          type="button"
          onClick={onNuevaVenta}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-pos-brand text-sm font-bold text-white hover:bg-pos-brand-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pos-brand/30"
        >
          Nueva venta <Kbd tone="dark">Enter</Kbd>
        </button>
      </div>
    </div>
  );
}
