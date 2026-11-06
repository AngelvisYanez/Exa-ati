"use client";

import { memo, useDeferredValue, useMemo, useState, type RefObject } from "react";
import { ScanBarcode, PackageSearch } from "lucide-react";
import { COLOR_SIN_CATEGORIA, colorCategoria } from "@/lib/inventario/catalogo";
import Kbd from "./Kbd";
import { formatoUSD, iniciales, type ProductoPos } from "../_lib/pos-calc";

const PALETA = [
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-800",
  "bg-orange-100 text-orange-800",
  "bg-amber-100 text-amber-800",
  "bg-lime-100 text-lime-800",
  "bg-emerald-100 text-emerald-800",
  "bg-violet-100 text-violet-800",
  "bg-stone-100 text-stone-700",
];

function colorDe(clave: string): string {
  let h = 0;
  for (let i = 0; i < clave.length; i++) h = (h * 31 + clave.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length];
}

export function filtrarProductos(productos: ProductoPos[], q: string): ProductoPos[] {
  const t = q.trim().toLowerCase();
  if (!t) return productos;
  return productos.filter((p) => p.nombre.toLowerCase().includes(t) || p.codigo.toLowerCase().includes(t));
}

/** `null` = todas, `"sin"` = sin categoría. */
type FiltroCategoria = string | null;

interface CategoriaPos {
  id: string;
  nombre: string;
  color: number | null;
  productos: number;
}

function categoriasDe(productos: ProductoPos[]): { categorias: CategoriaPos[]; sinCategoria: number } {
  const porId = new Map<string, CategoriaPos>();
  let sinCategoria = 0;
  for (const p of productos) {
    if (!p.categoriaId) {
      sinCategoria++;
      continue;
    }
    const c = porId.get(p.categoriaId);
    if (c) c.productos++;
    else porId.set(p.categoriaId, { id: p.categoriaId, nombre: p.categoriaNombre ?? "Categoría", color: p.categoriaColor, productos: 1 });
  }
  const categorias = [...porId.values()].toSorted((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { categorias, sinCategoria };
}

function filtrarPorCategoria(productos: ProductoPos[], filtro: FiltroCategoria): ProductoPos[] {
  if (filtro === null) return productos;
  if (filtro === "sin") return productos.filter((p) => !p.categoriaId);
  return productos.filter((p) => p.categoriaId === filtro);
}

export default function Catalogo({
  productos,
  cargando,
  error,
  cantidades,
  query,
  onQueryChange,
  onEnter,
  onAgregar,
  searchRef,
}: {
  productos: ProductoPos[];
  cargando: boolean;
  error: string | null;
  cantidades: Map<string, number>;
  query: string;
  onQueryChange: (q: string) => void;
  onEnter: (valor: string) => void;
  onAgregar: (p: ProductoPos) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const [categoria, setCategoria] = useState<FiltroCategoria>(null);
  const qDiferida = useDeferredValue(query);
  const { categorias, sinCategoria } = useMemo(() => categoriasDe(productos), [productos]);
  const filtroValido = categoria === null || (categoria === "sin" ? sinCategoria > 0 : categorias.some((c) => c.id === categoria))
    ? categoria
    : null;
  const visibles = useMemo(
    () => filtrarProductos(filtrarPorCategoria(productos, filtroValido), qDiferida),
    [productos, filtroValido, qDiferida],
  );

  return (
    <section aria-label="Catálogo" className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4 lg:p-5">
      <div className="relative">
        <label htmlFor="pos-buscar" className="sr-only">Buscar producto o escanear código</label>
        <ScanBarcode aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-pos-muted" />
        <input
          ref={searchRef}
          id="pos-buscar"
          type="search"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter(e.currentTarget.value);
            }
          }}
          placeholder="Escanea el código o escribe el producto…"
          className="h-[60px] w-full rounded-[14px] border border-pos-line-strong bg-white pl-14 pr-28 text-lg text-pos-ink shadow-sm outline-none placeholder:text-pos-muted/70 focus-visible:border-pos-brand focus-visible:ring-3 focus-visible:ring-pos-brand/15 [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 gap-1.5" aria-hidden>
          <Kbd>F2</Kbd>
          <Kbd>Enter</Kbd>
        </span>
      </div>

      {!cargando && categorias.length > 0 && (
        <div role="group" aria-label="Filtrar por categoría" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          <ChipCategoria nombre="Todos" conteo={productos.length} activa={filtroValido === null} onClick={() => setCategoria(null)} />
          {categorias.map((c) => (
            <ChipCategoria
              key={c.id}
              nombre={c.nombre}
              punto={colorCategoria(c.color).punto}
              conteo={c.productos}
              activa={filtroValido === c.id}
              onClick={() => setCategoria(c.id)}
            />
          ))}
          {sinCategoria > 0 && (
            <ChipCategoria
              nombre="Sin categoría"
              punto={COLOR_SIN_CATEGORIA.punto}
              conteo={sinCategoria}
              activa={filtroValido === "sin"}
              onClick={() => setCategoria("sin")}
            />
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {cargando ? (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]" aria-busy>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-[124px] animate-pulse rounded-[14px] border border-pos-line bg-white" />
            ))}
          </div>
        ) : error ? (
          <p role="alert" className="rounded-[14px] border border-pos-line bg-white p-6 text-sm text-pos-muted">{error}</p>
        ) : visibles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-pos-line-strong bg-white/60 p-10 text-center">
            <PackageSearch aria-hidden className="size-8 text-pos-muted" />
            <p className="text-base font-semibold text-pos-ink">
              {productos.length === 0
                ? "No hay productos activos en el inventario"
                : query.trim() ? `Sin resultados para «${query.trim()}»` : "No hay productos en esta categoría"}
            </p>
            <p className="text-sm text-pos-muted">
              {productos.length === 0 ? "Los productos activos aparecerán aquí." : "Busca por nombre o por código."}
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
            {visibles.map((p) => (
              <li key={p.id}>
                <TarjetaProducto producto={p} cantidad={cantidades.get(p.id) ?? 0} onAgregar={onAgregar} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ChipCategoria({ nombre, punto, conteo, activa, onClick }: {
  nombre: string;
  punto?: string;
  conteo: number;
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-pos-brand/25 ${
        activa
          ? "border-pos-ink bg-pos-ink text-white"
          : "border-pos-line bg-white text-pos-ink hover:border-pos-line-strong"
      }`}
    >
      {punto && <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: punto }} />}
      {nombre}
      <span className={`text-xs font-medium tabular-nums ${activa ? "text-white/70" : "text-pos-muted"}`}>{conteo}</span>
    </button>
  );
}

const TarjetaProducto = memo(function TarjetaProducto({ producto: p, cantidad, onAgregar }: {
  producto: ProductoPos;
  cantidad: number;
  onAgregar: (p: ProductoPos) => void;
}) {
  const enTicket = cantidad > 0;
  return (
    <button
      type="button"
      onClick={() => onAgregar(p)}
      aria-label={`Agregar ${p.nombre}, ${formatoUSD(p.precioUnitario)}${enTicket ? `, ${cantidad} en el ticket` : ""}`}
      className={`relative flex h-[124px] w-full flex-col rounded-[14px] border bg-white p-3 text-left transition-[border-color,box-shadow,transform] active:scale-[0.98] hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-pos-brand/25 ${
        enTicket ? "border-pos-brand bg-pos-brand/[0.03]" : "border-pos-line hover:border-pos-line-strong"
      }`}
    >
      {enTicket && (
        <span aria-hidden className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full bg-pos-brand text-xs font-bold text-white tabular-nums">
          {cantidad % 1 === 0 ? cantidad : cantidad.toFixed(2)}
        </span>
      )}
      <span aria-hidden className={`flex size-9 items-center justify-center rounded-lg text-xs font-bold ${colorDe(p.codigo)}`}>
        {iniciales(p.nombre)}
      </span>
      <span className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-pos-ink">{p.nombre}</span>
      <span className="mt-auto flex items-end justify-between gap-2">
        <span className="text-lg font-bold leading-none text-pos-ink tabular-nums">{formatoUSD(p.precioUnitario)}</span>
        <span className="flex flex-col items-end gap-1">
          {p.ivaPorcentaje === 0 && (
            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">IVA 0%</span>
          )}
          <span className={`text-[11px] tabular-nums ${p.stock <= 0 ? "font-semibold text-pos-brand" : "text-pos-muted"}`}>
            Stock {p.stock % 1 === 0 ? p.stock : p.stock.toFixed(2)}
          </span>
        </span>
      </span>
    </button>
  );
});
