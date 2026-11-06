"use client";

import { Pencil, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorCategoria, estadoStock, etiquetaStock, iniciales, precioPublico } from "@/lib/inventario/catalogo";
import type { ViewMode } from "@/components/lists/useViewMode";
import type { Producto } from "../_lib/inventario";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

interface ListaProductosProps {
  productos: Producto[];
  vista: ViewMode;
  seleccionadoId: string | null;
  onSeleccionar: (p: Producto) => void;
  onEditar: (p: Producto) => void;
  edicionDeshabilitada?: boolean;
}

export default function ListaProductos({ productos, vista, seleccionadoId, onSeleccionar, onEditar, edicionDeshabilitada }: ListaProductosProps) {
  if (vista === "cuadricula") {
    return (
      <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {productos.map((p) => (
          <li key={p.id}>
            <article
              className={cn(
                "flex h-full flex-col gap-3 rounded-2xl border bg-white p-4",
                seleccionadoId === p.id ? "border-pos-brand" : "border-pos-line",
              )}
            >
              <div className="flex items-start gap-3">
                <CuadroProducto producto={p} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{p.nombre}</h3>
                  <p className="font-mono text-xs text-pos-muted">{p.codigo}</p>
                </div>
                <BotonEditar producto={p} onEditar={onEditar} deshabilitado={edicionDeshabilitada} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <EtiquetaCategoria producto={p} />
                <EtiquetaStock producto={p} />
              </div>
              <div className="mt-auto flex items-end justify-between gap-2">
                <Precio producto={p} alineacion="izquierda" />
                <button
                  type="button"
                  onClick={() => onSeleccionar(p)}
                  className="cursor-pointer rounded-md text-xs font-semibold text-pos-muted hover:text-pos-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pos-brand/40"
                >
                  Ver kardex
                </button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-pos-line text-left text-[11px] font-semibold uppercase tracking-wider text-pos-muted">
            <th scope="col" className="px-4 py-3 font-semibold">Código</th>
            <th scope="col" className="px-4 py-3 font-semibold">Producto</th>
            <th scope="col" className="px-4 py-3 font-semibold">Categoría</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Precio venta</th>
            <th scope="col" className="px-4 py-3 font-semibold">IVA</th>
            <th scope="col" className="px-4 py-3 font-semibold">Stock</th>
            <th scope="col" className="w-14 px-4 py-3"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {productos.map((p) => (
            <tr
              key={p.id}
              className={cn(
                "border-b border-pos-line last:border-0 transition-colors hover:bg-pos-bg/60",
                seleccionadoId === p.id && "bg-pos-brand-soft/50",
                !p.activo && "opacity-60",
              )}
            >
              <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">{p.codigo}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSeleccionar(p)}
                  aria-label={`Ver kardex de ${p.nombre}`}
                  className="flex cursor-pointer items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pos-brand/40"
                >
                  <CuadroProducto producto={p} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{p.nombre}</span>
                    <span className="block text-xs text-pos-muted">
                      {p.tipo === "servicio" ? "Servicio" : `Producto · ${p.unidad}`}
                      {!p.activo && " · Inactivo"}
                    </span>
                  </span>
                </button>
              </td>
              <td className="px-4 py-3"><EtiquetaCategoria producto={p} /></td>
              <td className="px-4 py-3 text-right"><Precio producto={p} alineacion="derecha" /></td>
              <td className="px-4 py-3 tabular-nums">{p.ivaPorcentaje}%</td>
              <td className="px-4 py-3"><EtiquetaStock producto={p} /></td>
              <td className="px-4 py-3 text-right">
                <BotonEditar producto={p} onEditar={onEditar} deshabilitado={edicionDeshabilitada} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CuadroProducto({ producto }: { producto: Producto }) {
  const color = colorCategoria(producto.categoriaColor);
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold"
      style={{ background: color.fondo, color: color.texto }}
    >
      {iniciales(producto.nombre)}
    </span>
  );
}

function EtiquetaCategoria({ producto }: { producto: Producto }) {
  const color = colorCategoria(producto.categoriaColor);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{ background: color.fondo, color: color.texto }}
    >
      <span aria-hidden className="size-2 rounded-[2px]" style={{ background: color.punto }} />
      {producto.categoriaNombre ?? "Sin categoría"}
    </span>
  );
}

const ESTILO_STOCK = {
  disponible: "bg-pos-ok-bg text-pos-ok",
  bajo: "bg-pos-warn-bg text-pos-warn",
  agotado: "bg-pos-brand-soft text-pos-brand",
  servicio: "bg-pos-bg text-pos-muted",
} as const;

function EtiquetaStock({ producto }: { producto: Producto }) {
  const estado = estadoStock(producto);
  const texto =
    estado === "servicio" ? "Servicio"
      : estado === "agotado" ? "Agotado"
        : estado === "bajo" ? `Bajo · ${etiquetaStock(producto.stock, producto.unidad).replace(/ u\.$/, "")}`
          : etiquetaStock(producto.stock, producto.unidad);
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums", ESTILO_STOCK[estado])}>
      {texto}
    </span>
  );
}

function Precio({ producto, alineacion }: { producto: Producto; alineacion: "izquierda" | "derecha" }) {
  return (
    <span className={cn("block tabular-nums", alineacion === "derecha" ? "text-right" : "text-left")}>
      <span className="block font-bold">{usd.format(precioPublico(producto.precio, producto.ivaPorcentaje))}</span>
      <span className="block text-xs text-pos-muted">{usd.format(producto.precio)} + IVA</span>
    </span>
  );
}

function BotonEditar({ producto, onEditar, deshabilitado }: { producto: Producto; onEditar: (p: Producto) => void; deshabilitado?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onEditar(producto)}
      disabled={deshabilitado}
      aria-label={producto.activo ? `Editar ${producto.nombre}` : `Reactivar ${producto.nombre}`}
      title={producto.activo ? undefined : "Reactivar"}
      className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-pos-muted transition-colors hover:bg-pos-bg hover:text-pos-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pos-brand/40 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {producto.activo ? <Pencil className="size-4" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
    </button>
  );
}
