import { UserRound } from "lucide-react";
import Kbd from "./Kbd";
import { IDENTIFICACION_CONSUMIDOR_FINAL } from "../_lib/pos-config";
import { ETIQUETA_CAMPO, camposFaltantes, iniciales, type ClienteDatos } from "../_lib/pos-calc";

/** Altura fija: abrir/cerrar el cliente nunca desplaza la lista de líneas. */
export default function TicketCliente({ cliente, onConsumidorFinal, onConDatos }: {
  cliente: ClienteDatos | null;
  onConsumidorFinal: () => void;
  onConDatos: () => void;
}) {
  const conDatos = cliente !== null;
  const faltan = cliente ? camposFaltantes(cliente) : [];
  const incompleto = conDatos && faltan.length > 0;

  return (
    <div className="flex h-[172px] shrink-0 flex-col gap-3 border-b border-pos-line px-4 pb-4 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-pos-muted">Cliente</h2>
        <Kbd>F4</Kbd>
      </div>

      <div role="radiogroup" aria-label="Tipo de cliente" className="grid h-11 grid-cols-2 rounded-xl bg-pos-bg p-1">
        {[
          { activo: !conDatos, label: "Consumidor final", onClick: onConsumidorFinal },
          { activo: conDatos, label: "Con datos", onClick: onConDatos },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={o.activo}
            onClick={o.onClick}
            className={`rounded-[9px] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-pos-brand/25 ${
              o.activo ? "bg-white text-pos-ink shadow-sm" : "text-pos-muted hover:text-pos-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div
        className={`flex h-[62px] items-center gap-3 rounded-xl border px-3 ${
          incompleto ? "border-red-200 bg-red-50" : "border-pos-line bg-white"
        }`}
      >
        {conDatos && cliente ? (
          <>
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pos-brand text-sm font-bold text-white">
              {iniciales(cliente.razonSocial || "?")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold uppercase text-pos-ink">{cliente.razonSocial || "Sin nombre"}</p>
              {incompleto ? (
                <p className="truncate text-xs font-medium text-red-700">
                  Falta: {faltan.map((f) => ETIQUETA_CAMPO[f]).join(", ")}
                </p>
              ) : (
                <p className="truncate text-xs text-pos-muted tabular-nums">{cliente.identificacion} · {cliente.email}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onConDatos}
              className={`h-10 shrink-0 rounded-[10px] px-3.5 text-sm font-semibold transition-colors ${
                incompleto
                  ? "bg-pos-brand text-white hover:bg-pos-brand-hover"
                  : "border border-pos-line-strong bg-white text-pos-ink hover:bg-pos-panel"
              }`}
            >
              {incompleto ? "Completar" : "Editar"}
            </button>
          </>
        ) : (
          <>
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pos-bg text-pos-muted">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-pos-ink">CONSUMIDOR FINAL</p>
              <p className="text-xs text-pos-muted tabular-nums">{IDENTIFICACION_CONSUMIDOR_FINAL}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
