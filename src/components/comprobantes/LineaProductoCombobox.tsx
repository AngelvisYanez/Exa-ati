"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { control, foco, money } from "./tokens";
import type { ProductoInventario } from "./types";

const MAX_RESULTADOS = 8;

interface LineaProductoComboboxProps {
  id: string;
  valor: string;
  productos: ProductoInventario[];
  idSiguiente?: string;
  onChange: (valor: string) => void;
  onElegir: (codigo: string) => void;
  onRegistrar: (nombre: string) => void;
}

function filtrarProductos(productos: ProductoInventario[], query: string): ProductoInventario[] {
  const q = query.trim().toLowerCase();
  if (!q) return productos.slice(0, MAX_RESULTADOS);
  return productos
    .map((producto) => {
      const nombre = producto.nombre.toLowerCase();
      const codigo = producto.codigo.toLowerCase();
      let score = -1;
      if (nombre === q || codigo === q) score = 0;
      else if (nombre.startsWith(q) || codigo.startsWith(q)) score = 1;
      else if (nombre.includes(q) || codigo.includes(q)) score = 2;
      return { producto, score };
    })
    .filter((item) => item.score >= 0)
    .sort((a, b) => a.score - b.score || a.producto.nombre.localeCompare(b.producto.nombre, "es"))
    .slice(0, MAX_RESULTADOS)
    .map((item) => item.producto);
}

export default function LineaProductoCombobox({
  id, valor, productos, idSiguiente, onChange, onElegir, onRegistrar,
}: LineaProductoComboboxProps) {
  const autoId = useId();
  const listboxId = `${id}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const coincidencias = useMemo(() => filtrarProductos(productos, valor), [productos, valor]);
  const query = valor.trim();
  const nombreExacto = productos.some((item) => item.nombre.toLowerCase() === query.toLowerCase());
  const puedeRegistrar = query.length > 0 && !nombreExacto;
  const totalOpciones = coincidencias.length + (puedeRegistrar ? 1 : 0);
  const indiceRegistrar = puedeRegistrar ? coincidencias.length : -1;

  useLayoutEffect(() => {
    if (!abierto) {
      setPos(null);
      return;
    }
    const update = () => {
      const input = inputRef.current;
      if (!input) return;
      const r = input.getBoundingClientRect();
      const width = Math.max(r.width, 280);
      const left = Math.min(Math.max(12, r.left), window.innerWidth - width - 12);
      const gap = 4;
      const espacioAbajo = window.innerHeight - r.bottom - gap - 12;
      const espacioArriba = r.top - gap - 12;
      const abrirArriba = espacioAbajo < 160 && espacioArriba > espacioAbajo;
      const maxHeight = Math.min(280, Math.max(120, abrirArriba ? espacioArriba : espacioAbajo));
      const top = abrirArriba ? r.top - gap - maxHeight : r.bottom + gap;
      setPos({ top, left, width, maxHeight });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [abierto, coincidencias.length, puedeRegistrar]);

  useEffect(() => {
    setActivo(0);
  }, [valor]);

  useEffect(() => {
    if (!abierto) return;
    const onPointer = (event: MouseEvent) => {
      const t = event.target as Node;
      if (inputRef.current?.contains(t) || listaRef.current?.contains(t)) return;
      setAbierto(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const opcion = listaRef.current?.querySelector<HTMLElement>("[data-activo='true']");
    opcion?.scrollIntoView({ block: "nearest" });
  }, [abierto, activo]);

  function elegir(codigo: string) {
    onElegir(codigo);
    setAbierto(false);
  }

  function registrar() {
    if (!puedeRegistrar) return;
    onRegistrar(query);
    setAbierto(false);
  }

  function confirmarActivo() {
    if (totalOpciones === 0) {
      if (puedeRegistrar) registrar();
      return;
    }
    if (activo === indiceRegistrar) {
      registrar();
      return;
    }
    const producto = coincidencias[activo];
    if (producto) elegir(producto.codigo);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!abierto) {
        setAbierto(true);
        return;
      }
      if (!query && coincidencias.length === 0) return;
      if (!query && coincidencias.length > 0 && activo === 0) return;
      confirmarActivo();
      return;
    }
    if (event.key === "Tab") {
      setAbierto(false);
      if (event.shiftKey || !idSiguiente) return;
      const siguiente = document.getElementById(idSiguiente);
      if (!siguiente) return;
      event.preventDefault();
      siguiente.focus();
      if (siguiente instanceof HTMLInputElement) siguiente.select();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setAbierto(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!abierto) {
        setAbierto(true);
        return;
      }
      if (totalOpciones === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActivo((actual) => (actual + delta + totalOpciones) % totalOpciones);
    }
  }

  const activoId = !abierto || totalOpciones === 0
    ? undefined
    : activo === indiceRegistrar
      ? `${autoId}-registrar`
      : coincidencias[activo]
        ? `${autoId}-opcion-${coincidencias[activo].id}`
        : undefined;

  return (
    <>
      <Input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={abierto}
        aria-controls={listboxId}
        aria-activedescendant={activoId}
        value={valor}
        autoComplete="off"
        placeholder="Escribe para buscar o registrar"
        onChange={(event) => {
          onChange(event.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onClick={() => setAbierto(true)}
        onKeyDown={onKeyDown}
        className={control}
      />
      {abierto && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={listaRef}
          id={listboxId}
          role="listbox"
          aria-label="Productos y servicios"
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className="fixed z-50 overflow-y-auto rounded-xl border border-brand-gray-200 bg-white py-1 shadow-lg shadow-brand-gray-900/10"
        >
          {coincidencias.map((producto, indice) => {
            const estaActivo = indice === activo;
            return (
              <button
                key={producto.id}
                type="button"
                role="option"
                id={`${autoId}-opcion-${producto.id}`}
                aria-selected={estaActivo}
                tabIndex={-1}
                data-activo={estaActivo || undefined}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm",
                  estaActivo ? "bg-brand-red-subtle text-brand-gray-900" : "text-brand-gray-800 hover:bg-brand-gray-50",
                  foco,
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActivo(indice)}
                onClick={() => elegir(producto.codigo)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{producto.nombre}</span>
                  <span className="font-mono text-[11px] text-brand-gray-500">{producto.codigo}</span>
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-brand-gray-700">
                  {money(Number.parseFloat(producto.precio_unitario) || 0)}
                </span>
              </button>
            );
          })}
          {puedeRegistrar && (
            <button
              type="button"
              role="option"
              id={`${autoId}-registrar`}
              aria-selected={activo === indiceRegistrar}
              tabIndex={-1}
              data-activo={activo === indiceRegistrar || undefined}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium",
                coincidencias.length > 0 && "mt-1 border-t border-brand-gray-100",
                activo === indiceRegistrar ? "bg-brand-red-subtle text-brand-red" : "text-brand-red hover:bg-brand-red-subtle/70",
                foco,
              )}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActivo(indiceRegistrar)}
              onClick={registrar}
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">Registrar «{query}»</span>
            </button>
          )}
          {coincidencias.length === 0 && !puedeRegistrar && (
            <p className="px-3 py-2.5 text-sm text-brand-gray-500">Empieza a escribir el nombre o el código.</p>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
