"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { control, money } from "./tokens";
import type { ProductoInventario } from "./types";

interface InventarioPickerProps {
  productos: ProductoInventario[];
  /** Número de línea (desde 1) que recibirá el producto. */
  linea: number;
  onElegir: (codigo: string) => void;
  onCerrar: () => void;
}

export default function InventarioPicker({ productos, linea, onElegir, onCerrar }: InventarioPickerProps) {
  const [filtroTexto, setFiltroTexto] = useState("");
  const filtro = filtroTexto.trim().toLowerCase();
  const visibles = (filtro
    ? productos.filter((item) => `${item.codigo} ${item.nombre}`.toLowerCase().includes(filtro))
    : productos
  ).slice(0, 12);

  return (
    <div className="mb-4 rounded-[10px] border border-brand-gray-200 bg-brand-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-brand-gray-800">Inventario · línea {linea}</p>
        <button type="button" onClick={onCerrar} className="text-xs font-medium text-brand-gray-500 hover:text-brand-gray-800">
          Cerrar
        </button>
      </div>
      <Input
        value={filtroTexto}
        onChange={(event) => setFiltroTexto(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
        placeholder="Código o nombre"
        aria-label="Filtrar inventario"
        className={cn(control, "mt-2")}
      />
      <ul className="mt-2 max-h-48 overflow-y-auto" aria-label="Productos del inventario">
        {visibles.length === 0 ? (
          <li className="px-1 py-2 text-sm text-brand-gray-500">No hay productos activos para mostrar.</li>
        ) : visibles.map((producto) => (
          <li key={producto.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-white focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-brand-red"
              onClick={() => onElegir(producto.codigo)}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{producto.nombre}</span>
                <span className="font-mono text-xs text-brand-gray-500">{producto.codigo} · stock {parseFloat(producto.stock).toFixed(0)}</span>
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums">{money(parseFloat(producto.precio_unitario) || 0)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
