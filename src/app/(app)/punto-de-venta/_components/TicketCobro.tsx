import { TriangleAlert } from "lucide-react";
import Kbd from "./Kbd";
import { FORMAS_PAGO_POS, LIMITE_CONSUMIDOR_FINAL, type FormaPagoCodigo } from "../_lib/pos-config";
import { filasTarifas, formatoUSD, type TotalesTicket } from "../_lib/pos-calc";

export type MotivoBloqueo = "vacio" | "emisor" | "cliente" | "limiteCF" | null;

export default function TicketCobro({
  totales,
  propina,
  articulos,
  formaPago,
  onFormaPago,
  bloqueo,
  onCobrar,
  onCancelar,
  onConDatos,
}: {
  totales: TotalesTicket;
  propina: number;
  articulos: number;
  formaPago: FormaPagoCodigo;
  onFormaPago: (f: FormaPagoCodigo) => void;
  bloqueo: MotivoBloqueo;
  onCobrar: () => void;
  onCancelar: () => void;
  onConDatos: () => void;
}) {
  const filas = filasTarifas(totales);
  const avisoId = "pos-aviso-cobro";

  return (
    <div className="shrink-0 border-t border-pos-line bg-pos-panel px-4 pb-3 pt-3">
      <dl className="space-y-1 text-sm text-pos-ink-soft tabular-nums">
        {filas.map((f) => (
          <div key={`s${f.tarifa}`} className="flex justify-between">
            <dt>Subtotal {f.tarifa}%</dt>
            <dd>{formatoUSD(f.baseImponible)}</dd>
          </div>
        ))}
        {totales.totalDescuento > 0 && (
          <div className="flex justify-between text-pos-brand">
            <dt>Descuentos aplicados</dt>
            <dd>−{formatoUSD(totales.totalDescuento)}</dd>
          </div>
        )}
        {filas.filter((f) => f.tarifa > 0).map((f) => (
          <div key={`i${f.tarifa}`} className="flex justify-between">
            <dt>IVA {f.tarifa}%</dt>
            <dd>{formatoUSD(f.valor)}</dd>
          </div>
        ))}
        {propina > 0 && (
          <div className="flex justify-between">
            <dt>Propina</dt>
            <dd>{formatoUSD(propina)}</dd>
          </div>
        )}
      </dl>

      {bloqueo === "limiteCF" && (
        <p id={avisoId} role="status" className="mt-3 flex gap-2 rounded-xl bg-pos-warn-bg p-3 text-[13px] leading-snug text-pos-warn">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Supera {formatoUSD(LIMITE_CONSUMIDOR_FINAL)}: el SRI exige los datos del cliente.{" "}
            <button type="button" onClick={onConDatos} className="font-semibold underline underline-offset-2">
              Cambia a Con datos
            </button>
          </span>
        </p>
      )}
      {bloqueo === "emisor" && (
        <p id={avisoId} role="status" className="mt-3 rounded-xl bg-pos-warn-bg p-3 text-[13px] text-pos-warn">
          Selecciona el emisor en la barra superior.
        </p>
      )}

      <div role="radiogroup" aria-label="Forma de pago" className="mt-3 grid grid-cols-3 gap-2">
        {FORMAS_PAGO_POS.map((fp) => {
          const Icon = fp.icon;
          const activo = formaPago === fp.value;
          return (
            <button
              key={fp.value}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onFormaPago(fp.value)}
              className={`flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-pos-brand/25 ${
                activo
                  ? "border-pos-brand bg-pos-brand text-white"
                  : "border-pos-line-strong bg-white text-pos-ink hover:bg-pos-bg"
              }`}
            >
              <Icon aria-hidden className="size-4" />
              {fp.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onCobrar}
        disabled={bloqueo !== null}
        aria-describedby={bloqueo === "limiteCF" || bloqueo === "emisor" ? avisoId : undefined}
        className="mt-3 flex h-[68px] w-full items-center justify-between rounded-[14px] bg-pos-brand px-5 text-white shadow-sm transition-colors hover:bg-pos-brand-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pos-brand/30 disabled:cursor-not-allowed disabled:bg-pos-line-strong disabled:text-pos-muted disabled:shadow-none"
      >
        <span className="flex items-center gap-2.5 text-lg font-bold">
          Cobrar <Kbd tone={bloqueo ? "light" : "dark"}>F9</Kbd>
        </span>
        <span className="text-2xl font-extrabold tabular-nums">{formatoUSD(totales.total)}</span>
      </button>

      <div className="mt-2 flex items-center justify-between text-xs text-pos-muted">
        <span className="tabular-nums">{articulos % 1 === 0 ? articulos : articulos.toFixed(2)} {articulos === 1 ? "artículo" : "artículos"}</span>
        <button
          type="button"
          onClick={onCancelar}
          disabled={articulos === 0}
          className="flex items-center gap-1.5 rounded font-semibold text-pos-brand hover:underline disabled:pointer-events-none disabled:opacity-40"
        >
          Cancelar venta <Kbd>Esc</Kbd>
        </button>
      </div>
    </div>
  );
}
