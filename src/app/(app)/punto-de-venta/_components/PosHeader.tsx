import Image from "next/image";
import Link from "next/link";
import { POS_FEATURES } from "../_lib/pos-config";

export interface EmisorPos {
  id: string;
  ruc: string;
  razonSocial: string;
  ambiente?: string | null;
}

export default function PosHeader({ emisores, emisorId, onEmisorChange }: {
  emisores: EmisorPos[];
  emisorId: string;
  onEmisorChange: (id: string) => void;
}) {
  const emisor = emisores.find((e) => e.id === emisorId);
  const produccion = emisor?.ambiente === "2";

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-pos-line bg-white px-4 py-2.5 lg:h-16 lg:flex-nowrap lg:py-0">
      <div className="flex min-w-0 items-center gap-3">
        <Image src="/favicon.png" alt="exa" width={32} height={32} className="size-8 shrink-0 object-contain" priority />
        <div className="min-w-0 border-l border-pos-line pl-3">
          <h1 className="whitespace-nowrap text-[17px] font-bold leading-tight text-pos-ink">Punto de venta</h1>
        </div>
      </div>

      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 lg:flex-nowrap">
        <label htmlFor="pos-emisor" className="text-sm text-pos-muted max-xl:sr-only">Emisor</label>
        <select
          id="pos-emisor"
          value={emisorId}
          onChange={(e) => onEmisorChange(e.target.value)}
          className="h-10 max-w-[220px] min-w-0 rounded-[10px] xl:max-w-[260px] border border-pos-line-strong bg-white px-3 text-sm text-pos-ink outline-none focus-visible:ring-3 focus-visible:ring-pos-brand/25"
        >
          <option value="">Seleccionar emisor…</option>
          {emisores.map((em) => (
            <option key={em.id} value={em.id}>{em.ruc} — {em.razonSocial}</option>
          ))}
        </select>

        {emisor && (
          <span
            className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${
              produccion ? "bg-pos-ok-bg text-pos-ok" : "bg-pos-warn-bg text-pos-warn"
            }`}
          >
            <span aria-hidden className={`size-1.5 rounded-full ${produccion ? "bg-pos-ok" : "bg-pos-warn"}`} />
            {produccion ? "Producción" : "Pruebas"}
          </span>
        )}

        {POS_FEATURES.ventasDelDia && (
          <Link
            href="/punto-de-venta/ventas"
            className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-[10px] border border-pos-line-strong bg-white px-4 text-sm font-semibold text-pos-ink transition-colors hover:bg-pos-panel"
          >
            Ventas del día
          </Link>
        )}
      </div>
    </header>
  );
}
