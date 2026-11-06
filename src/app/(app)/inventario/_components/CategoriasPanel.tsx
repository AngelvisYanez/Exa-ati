"use client";

import { useId, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLOR_SIN_CATEGORIA, colorCategoria } from "@/lib/inventario/catalogo";
import type { Categoria, FiltroCategoria } from "../_lib/inventario";

interface CategoriasPanelProps {
  categorias: Categoria[];
  total: number;
  sinCategoria: number;
  seleccion: FiltroCategoria;
  onSeleccionar: (id: FiltroCategoria) => void;
  onCrear: (nombre: string) => Promise<Categoria | null>;
  onRenombrar: (id: string, nombre: string) => Promise<boolean>;
  onDesactivar: (categoria: Categoria) => Promise<boolean>;
  creando: boolean;
  onCreandoChange: (v: boolean) => void;
  deshabilitado?: boolean;
}

const campoMini =
  "h-9 w-full rounded-[10px] border border-pos-line-strong bg-white px-3 text-sm focus:border-pos-brand focus:outline-none focus:ring-4 focus:ring-pos-brand/15";

export default function CategoriasPanel({
  categorias,
  total,
  sinCategoria,
  seleccion,
  onSeleccionar,
  onCrear,
  onRenombrar,
  onDesactivar,
  creando,
  onCreandoChange,
  deshabilitado,
}: CategoriasPanelProps) {
  const ids = useId();
  const [nombre, setNombre] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEdicion, setNombreEdicion] = useState("");

  async function crear() {
    const limpio = nombre.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    const creada = await onCrear(limpio);
    setEnviando(false);
    if (creada) {
      setNombre("");
      onCreandoChange(false);
      onSeleccionar(creada.id);
    }
  }

  async function renombrar(id: string) {
    const limpio = nombreEdicion.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    const ok = await onRenombrar(id, limpio);
    setEnviando(false);
    if (ok) setEditandoId(null);
  }

  async function desactivar(categoria: Categoria) {
    setEnviando(true);
    const ok = await onDesactivar(categoria);
    setEnviando(false);
    if (ok) setEditandoId(null);
  }

  return (
    <aside aria-labelledby={`${ids}-titulo`} className="rounded-2xl border border-pos-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 id={`${ids}-titulo`} className="text-xs font-semibold uppercase tracking-wider text-pos-muted">Categorías</h2>
        <button
          type="button"
          onClick={() => onCreandoChange(true)}
          disabled={deshabilitado}
          aria-label="Nueva categoría"
          className="flex size-8 cursor-pointer items-center justify-center rounded-[10px] text-pos-muted transition-colors hover:bg-pos-bg hover:text-pos-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pos-brand/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>

      <ul className="flex flex-col gap-0.5">
        <li>
          <FilaCategoria
            nombre="Todas"
            punto="#1C1917"
            conteo={total}
            activa={seleccion === null}
            onClick={() => onSeleccionar(null)}
          />
        </li>
        {categorias.map((c) =>
          editandoId === c.id ? (
            <li key={c.id} className="flex flex-col gap-2 rounded-[10px] bg-pos-bg p-2">
              <label htmlFor={`${ids}-editar`} className="sr-only">Nuevo nombre de {c.nombre}</label>
              <input
                id={`${ids}-editar`}
                autoFocus
                value={nombreEdicion}
                maxLength={80}
                onChange={(e) => setNombreEdicion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void renombrar(c.id);
                  if (e.key === "Escape") setEditandoId(null);
                }}
                className={campoMini}
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => void desactivar(c)}
                  disabled={enviando}
                  className="cursor-pointer rounded-md text-xs font-medium text-pos-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pos-brand/40"
                >
                  Desactivar
                </button>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setEditandoId(null)} className={botonMini}>Cancelar</button>
                  <button
                    type="button"
                    onClick={() => void renombrar(c.id)}
                    disabled={!nombreEdicion.trim() || enviando}
                    className={cn(botonMini, "border-transparent bg-pos-brand text-white hover:bg-pos-brand-hover")}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </li>
          ) : (
            <li key={c.id} className="group relative">
              <FilaCategoria
                nombre={c.nombre}
                punto={colorCategoria(c.color).punto}
                conteo={c.productos}
                activa={seleccion === c.id}
                onClick={() => onSeleccionar(c.id)}
              />
              <button
                type="button"
                onClick={() => {
                  setEditandoId(c.id);
                  setNombreEdicion(c.nombre);
                }}
                aria-label={`Editar categoría ${c.nombre}`}
                className="absolute top-1/2 right-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-pos-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white hover:text-pos-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pos-brand/40"
              >
                <Pencil className="size-3.5" aria-hidden />
              </button>
            </li>
          ),
        )}
        {sinCategoria > 0 && (
          <li>
            <FilaCategoria
              nombre="Sin categoría"
              punto={COLOR_SIN_CATEGORIA.punto}
              conteo={sinCategoria}
              activa={seleccion === "sin"}
              onClick={() => onSeleccionar("sin")}
            />
          </li>
        )}
      </ul>

      {creando ? (
        <div className="mt-3 flex flex-col gap-2 rounded-[10px] bg-pos-bg p-2">
          <label htmlFor={`${ids}-nueva`} className="text-xs font-medium text-pos-muted">Nombre de la categoría</label>
          <input
            id={`${ids}-nueva`}
            autoFocus
            value={nombre}
            maxLength={80}
            placeholder="Ej.: Bebidas"
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void crear();
              if (e.key === "Escape") onCreandoChange(false);
            }}
            className={campoMini}
          />
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => { setNombre(""); onCreandoChange(false); }} className={botonMini}>Cancelar</button>
            <button
              type="button"
              onClick={() => void crear()}
              disabled={!nombre.trim() || enviando}
              className={cn(botonMini, "border-transparent bg-pos-brand text-white hover:bg-pos-brand-hover")}
            >
              Crear
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onCreandoChange(true)}
          disabled={deshabilitado}
          className="mt-3 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[10px] bg-pos-brand-soft text-sm font-semibold text-pos-brand transition-colors hover:bg-[#F6DADA] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pos-brand/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden /> Nueva categoría
        </button>
      )}

      <p className="mt-3 text-xs leading-relaxed text-pos-muted">
        Las categorías ordenan tu catálogo y aparecen como filtros en el Punto de venta.
      </p>
    </aside>
  );
}

const botonMini =
  "inline-flex h-8 cursor-pointer items-center rounded-[8px] border border-pos-line-strong bg-white px-3 text-xs font-semibold text-pos-ink transition-colors hover:bg-pos-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pos-brand/40 disabled:cursor-not-allowed disabled:opacity-50";

function FilaCategoria({ nombre, punto, conteo, activa, onClick }: { nombre: string; punto: string; conteo: number; activa: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={cn(
        "flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pos-brand/40",
        activa ? "bg-pos-brand-soft font-semibold text-pos-brand" : "text-pos-ink hover:bg-pos-bg",
      )}
    >
      <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: punto }} />
      <span className="min-w-0 flex-1 truncate">{nombre}</span>
      <span
        className={cn(
          "min-w-6 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums",
          activa ? "bg-white text-pos-brand" : "bg-pos-bg text-pos-muted",
        )}
      >
        {conteo}
      </span>
    </button>
  );
}
