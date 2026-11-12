"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { control, foco, money, tarjeta } from "./tokens";
import type { ProductoInventario } from "./types";

interface InventarioPickerProps {
  open: boolean;
  productos: ProductoInventario[];
  cantidades: Map<string, number>;
  anchorRef: RefObject<HTMLElement | null>;
  onAgregar: (codigo: string) => void;
  onCerrar: () => void;
}

export default function InventarioPicker({
  open, productos, cantidades, anchorRef, onAgregar, onCerrar,
}: InventarioPickerProps) {
  const [filtroTexto, setFiltroTexto] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filtro = filtroTexto.trim().toLowerCase();
  const visibles = filtro
    ? productos.filter((item) => `${item.codigo} ${item.nombre}`.toLowerCase().includes(filtro))
    : productos;

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const width = 360;
      const gap = 8;
      const left = Math.min(Math.max(12, r.right - width), window.innerWidth - width - 12);
      const espacioAbajo = window.innerHeight - r.bottom - gap;
      const top = espacioAbajo < 280 && r.top > 280
        ? Math.max(12, r.top - Math.min(420, r.top - 12) - gap)
        : r.bottom + gap;
      setPos({ top, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    setFiltroTexto("");
    const id = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCerrar]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const t = event.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onCerrar();
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, onCerrar, anchorRef]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="Buscar en inventario"
      style={{ top: pos.top, left: pos.left }}
      className={cn(tarjeta, "fixed z-50 flex w-[360px] max-w-[calc(100vw-24px)] flex-col shadow-lg")}
    >
      <div className="flex items-center justify-between gap-2 border-b border-brand-gray-100 px-3 py-2">
        <p className="text-sm font-semibold text-brand-gray-900">Inventario</p>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar inventario"
          className={cn("flex size-7 items-center justify-center rounded-lg text-brand-gray-500 hover:bg-brand-gray-50 hover:text-brand-gray-800", foco)}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="px-3 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-gray-400" aria-hidden />
          <Input
            ref={searchRef}
            value={filtroTexto}
            onChange={(event) => setFiltroTexto(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
            placeholder="Código o nombre"
            aria-label="Filtrar inventario"
            className={cn(control, "pl-9")}
          />
        </div>
      </div>
      <ul className="mt-1 max-h-72 overflow-y-auto px-1.5 pb-2" aria-label="Productos del inventario">
        {visibles.length === 0 ? (
          <li className="px-2 py-3 text-sm text-brand-gray-500">No hay productos activos para mostrar.</li>
        ) : visibles.map((producto) => {
          const enTicket = cantidades.get(producto.codigo) ?? 0;
          return (
            <li key={producto.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-brand-gray-50 focus-visible:bg-brand-red-subtle",
                  foco,
                  enTicket > 0 && "bg-brand-red-subtle/60",
                )}
                onClick={() => {
                  onAgregar(producto.codigo);
                  searchRef.current?.focus();
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-brand-gray-900">{producto.nombre}</span>
                  <span className="font-mono text-xs text-brand-gray-500">
                    {producto.codigo} · stock {Number.parseFloat(producto.stock).toFixed(0)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {enTicket > 0 && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-brand-red text-[11px] font-bold text-white tabular-nums">
                      {enTicket % 1 === 0 ? enTicket : enTicket.toFixed(2)}
                    </span>
                  )}
                  <span className="font-mono text-xs tabular-nums text-brand-gray-700">{money(Number.parseFloat(producto.precio_unitario) || 0)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-brand-gray-100 px-3 py-2 text-[11px] text-brand-gray-500">
        Clic para agregar a la factura. El panel se queda abierto.
      </p>
    </div>,
    document.body,
  );
}
