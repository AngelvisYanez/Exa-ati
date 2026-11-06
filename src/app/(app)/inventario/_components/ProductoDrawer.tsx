"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Box, ChevronDown, Plus, Sparkles, Wrench } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import {
  TARIFAS_IVA,
  UNIDADES,
  calcularPrecio,
  colorCategoria,
  etiquetaStock,
  iniciales,
  precioPublico,
  type TipoProducto,
} from "@/lib/inventario/catalogo";
import Drawer from "./Drawer";
import { INVENTARIO_FEATURES, leerError, type Categoria, type Producto } from "../_lib/inventario";

export const campoClase =
  "h-11 w-full rounded-[10px] border border-pos-line-strong bg-white px-3 text-sm text-pos-ink placeholder:text-pos-muted/70 transition-[border-color,box-shadow] focus:border-pos-brand focus:outline-none focus:ring-4 focus:ring-pos-brand/15 disabled:bg-pos-bg disabled:text-pos-muted";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

interface ProductoDrawerProps {
  open: boolean;
  producto: Producto | null;
  categorias: Categoria[];
  onClose: () => void;
  onGuardado: (info: { nombre: string; categoria: string | null }) => void;
  onCrearCategoria: (nombre: string) => Promise<Categoria | null>;
  onDesactivar?: (producto: Producto) => void;
}

interface Formulario {
  tipo: TipoProducto;
  nombre: string;
  categoriaId: string | null;
  codigo: string;
  codigoBarras: string;
  tarifa: number;
  precio: string;
  incluyeIva: boolean;
  stock: string;
  stockMinimo: string;
  unidad: string;
  visiblePos: boolean;
  descripcion: string;
}

function formularioInicial(producto: Producto | null): Formulario {
  if (!producto) {
    return {
      tipo: "producto",
      nombre: "",
      categoriaId: null,
      codigo: "",
      codigoBarras: "",
      tarifa: 15,
      precio: "",
      incluyeIva: false,
      stock: "0",
      stockMinimo: "0",
      unidad: "Unidad",
      visiblePos: true,
      descripcion: "",
    };
  }
  return {
    tipo: producto.tipo,
    nombre: producto.nombre,
    categoriaId: producto.categoriaId,
    codigo: producto.codigo,
    codigoBarras: producto.codigoBarras,
    tarifa: producto.ivaPorcentaje,
    ...precioEditable(producto.precio, producto.ivaPorcentaje),
    stock: String(producto.stock),
    stockMinimo: String(producto.stockMinimo),
    unidad: producto.unidad || "Unidad",
    visiblePos: producto.visiblePos,
    descripcion: producto.descripcion,
  };
}

/** Una base con más de 2 decimales nació de un precio con IVA: se edita como ese precio para no mostrar 0.434783. */
function precioEditable(base: number, tarifa: number): Pick<Formulario, "precio" | "incluyeIva"> {
  const tieneCentavosExactos = Math.abs(base * 100 - Math.round(base * 100)) < 1e-6;
  if (tarifa > 0 && !tieneCentavosExactos) {
    const pvp = precioPublico(base, tarifa);
    if (calcularPrecio(pvp, tarifa, true).base === base) return { precio: pvp.toFixed(2), incluyeIva: true };
  }
  return { precio: String(base), incluyeIva: false };
}

function numero(texto: string): number {
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export default function ProductoDrawer({
  open,
  producto,
  categorias,
  onClose,
  onGuardado,
  onCrearCategoria,
  onDesactivar,
}: ProductoDrawerProps) {
  const ids = useId();
  const nombreRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Formulario>(() => formularioInicial(producto));
  const [codigoAuto, setCodigoAuto] = useState<string | null>(null);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [descripcionAbierta, setDescripcionAbierta] = useState(Boolean(producto?.descripcion));
  const [nuevaCategoria, setNuevaCategoria] = useState<string | null>(null);
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

  const editando = producto !== null;
  const esProducto = form.tipo === "producto";
  const categoria = categorias.find((c) => c.id === form.categoriaId) ?? null;
  const color = colorCategoria(categoria?.color ?? producto?.categoriaColor ?? null);
  const nombreCategoria = categoria?.nombre ?? (form.categoriaId ? producto?.categoriaNombre ?? null : null);

  const precioNum = numero(form.precio);
  const calculo = calcularPrecio(Number.isNaN(precioNum) ? 0 : precioNum, form.tarifa, form.incluyeIva);
  const stockNum = numero(form.stock);
  const minimoNum = numero(form.stockMinimo);

  const faltan: string[] = [];
  if (!form.nombre.trim()) faltan.push("nombre");
  if (!form.categoriaId) faltan.push("categoría");
  if (!form.codigo.trim()) faltan.push("código");
  if (!(precioNum > 0)) faltan.push("precio");
  if (esProducto && !editando && !(stockNum >= 0)) faltan.push("stock inicial");
  if (esProducto && !(minimoNum >= 0)) faltan.push("stock mínimo");
  const completo = faltan.length === 0;

  const pasos = {
    tipo: true,
    basica: Boolean(form.nombre.trim() && form.categoriaId && form.codigo.trim()),
    precio: precioNum > 0,
    stock: (editando || stockNum >= 0) && minimoNum >= 0 && Boolean(form.unidad),
  };

  function cambiar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function generarCodigo(categoriaId: string | null, tipo: TipoProducto, soloSiAuto = false) {
    if (soloSiAuto && form.codigo.trim() && form.codigo !== codigoAuto) return;
    setGenerando(true);
    try {
      const params = new URLSearchParams({ tipo });
      if (categoriaId) params.set("categoriaId", categoriaId);
      const res = await apiFetch(`/api/inventario/codigo-sugerido?${params}`);
      if (!res.ok) throw new Error(await leerError(res, "No se pudo generar el código"));
      const data = (await res.json()) as { data: { codigo: string } };
      setForm((f) => ({ ...f, codigo: data.data.codigo }));
      setCodigoAuto(data.data.codigo);
      setErrorCodigo(null);
    } catch (e) {
      setErrorCodigo(e instanceof Error ? e.message : "No se pudo generar el código");
    } finally {
      setGenerando(false);
    }
  }

  function elegirCategoria(id: string) {
    cambiar("categoriaId", id);
    if (!editando) void generarCodigo(id, form.tipo, true);
  }

  async function crearCategoriaEnLinea() {
    const nombre = (nuevaCategoria ?? "").trim();
    if (!nombre) return;
    setCreandoCategoria(true);
    const creada = await onCrearCategoria(nombre);
    setCreandoCategoria(false);
    if (!creada) return;
    setNuevaCategoria(null);
    elegirCategoria(creada.id);
  }

  async function guardar(crearOtro: boolean) {
    if (!completo || guardando) return;
    setGuardando(true);
    setErrorCodigo(null);
    setErrorGeneral(null);
    const cuerpo: Record<string, unknown> = {
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      precioUnitario: calculo.base,
      ivaPorcentaje: form.tarifa,
      categoriaId: form.categoriaId,
      tipo: form.tipo,
      stockMinimo: esProducto ? minimoNum : 0,
      unidad: form.unidad,
      codigoBarras: form.codigoBarras.trim(),
      visiblePos: form.visiblePos,
    };
    if (!editando) cuerpo.stock = esProducto ? stockNum : 0;
    try {
      const res = await apiFetch(editando ? `/api/ecommerce/productos/${producto.id}` : "/api/ecommerce/productos", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!res.ok) {
        const mensaje = await leerError(res, "No se pudo guardar el producto");
        if (res.status === 409) setErrorCodigo(mensaje);
        else setErrorGeneral(mensaje);
        return;
      }
      onGuardado({ nombre: form.nombre.trim(), categoria: nombreCategoria });
      if (crearOtro) {
        const base = formularioInicial(null);
        setForm({ ...base, tipo: form.tipo, categoriaId: form.categoriaId, tarifa: form.tarifa, unidad: form.unidad, incluyeIva: form.incluyeIva });
        setCodigoAuto(null);
        setDescripcionAbierta(false);
        void generarCodigo(form.categoriaId, form.tipo);
        nombreRef.current?.focus();
      } else {
        onClose();
      }
    } catch {
      setErrorGeneral("No se pudo conectar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  const tarifas: number[] = TARIFAS_IVA.includes(form.tarifa as (typeof TARIFAS_IVA)[number])
    ? [...TARIFAS_IVA]
    : [...TARIFAS_IVA, form.tarifa];

  const vistaPrevia = (
    <div className="border-b border-pos-line bg-pos-bg px-6 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-pos-muted">Así se verá en el Punto de venta</p>
      <div className="mt-2 flex items-center gap-3 rounded-2xl border border-pos-line bg-white p-3">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
          style={{ background: color.fondo, color: color.texto }}
        >
          {iniciales(form.nombre || "Nuevo producto")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{form.nombre.trim() || "Nombre del producto"}</p>
          <p className="truncate text-xs text-pos-muted">
            {nombreCategoria ?? "Sin categoría"}
            {" · "}
            {esProducto ? `Stock ${etiquetaStock(stockNum >= 0 ? stockNum : 0, form.unidad)}` : "Servicio"}
            {" · "}IVA {form.tarifa}%
          </p>
        </div>
        <p className="shrink-0 text-2xl font-extrabold tabular-nums tracking-tight">{usd.format(calculo.pvp)}</p>
      </div>
    </div>
  );

  const pie = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className={cn("text-sm", completo ? "text-pos-muted" : "font-medium text-pos-brand")} aria-live="polite">
        {completo ? (editando ? "Listo para guardar los cambios." : "Listo para guardar.") : `Falta: ${faltan.join(", ")}`}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className={botonSecundario}>
          Cancelar
        </button>
        {!editando && (
          <button type="button" onClick={() => guardar(true)} disabled={!completo || guardando} className={botonSecundario}>
            Guardar y crear otro
          </button>
        )}
        <button type="button" onClick={() => guardar(false)} disabled={!completo || guardando} className={botonPrimario}>
          {guardando ? "Guardando…" : "Guardar producto"}
        </button>
      </div>
    </div>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      titulo={editando ? "Editar producto" : "Nuevo producto"}
      descripcion={editando ? `${producto.codigo} · ${producto.nombre}` : "Regístralo una vez y úsalo en caja, facturas y eCommerce."}
      cabecera={vistaPrevia}
      pie={pie}
      initialFocusRef={nombreRef}
    >
      <div className="flex flex-col gap-7">
        {errorGeneral && (
          <p role="alert" className="rounded-[10px] border border-pos-brand/30 bg-pos-brand-soft px-3 py-2 text-sm text-pos-brand">
            {errorGeneral}
          </p>
        )}

        <Seccion numero={1} titulo="¿Qué vas a registrar?" completa={pasos.tipo}>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Tipo">
            <TarjetaTipo
              activa={esProducto}
              icono={<Box className="size-5" aria-hidden />}
              titulo="Producto"
              detalle="Tiene stock"
              onClick={() => cambiar("tipo", "producto")}
            />
            <TarjetaTipo
              activa={!esProducto}
              icono={<Wrench className="size-5" aria-hidden />}
              titulo="Servicio"
              detalle="No maneja stock"
              onClick={() => cambiar("tipo", "servicio")}
            />
          </div>
        </Seccion>

        <Seccion numero={2} titulo="Información básica" completa={pasos.basica}>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor={`${ids}-nombre`} className={etiqueta}>Nombre *</label>
              <input
                ref={nombreRef}
                id={`${ids}-nombre`}
                value={form.nombre}
                onChange={(e) => cambiar("nombre", e.target.value)}
                maxLength={500}
                placeholder="Ej.: Agua sin gas 500 ml"
                aria-describedby={`${ids}-nombre-ayuda`}
                className={campoClase}
              />
              <p id={`${ids}-nombre-ayuda`} className={ayuda}>Escríbelo como lo buscarías en caja: marca, presentación y tamaño.</p>
            </div>

            <fieldset>
              <legend className={etiqueta}>Categoría *</legend>
              <div className="flex flex-wrap gap-2">
                {categorias.map((c) => {
                  const col = colorCategoria(c.color);
                  const activa = c.id === form.categoriaId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={activa}
                      onClick={() => elegirCategoria(c.id)}
                      className={cn(
                        "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pos-brand/15",
                        activa ? "border-transparent" : "border-pos-line-strong bg-white text-pos-ink hover:bg-pos-bg",
                      )}
                      style={activa ? { background: col.fondo, color: col.texto, boxShadow: `inset 0 0 0 1.5px ${col.punto}` } : undefined}
                    >
                      <span aria-hidden className="size-2 rounded-full" style={{ background: col.punto }} />
                      {c.nombre}
                    </button>
                  );
                })}
                {nuevaCategoria === null ? (
                  <button
                    type="button"
                    onClick={() => setNuevaCategoria("")}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-pos-line-strong px-3 text-sm font-medium text-pos-muted transition-colors hover:border-pos-brand hover:text-pos-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pos-brand/15"
                  >
                    <Plus className="size-3.5" aria-hidden /> Nueva categoría
                  </button>
                ) : (
                  <div className="flex w-full items-center gap-2">
                    <label htmlFor={`${ids}-nueva-cat`} className="sr-only">Nombre de la nueva categoría</label>
                    <input
                      id={`${ids}-nueva-cat`}
                      autoFocus
                      value={nuevaCategoria}
                      maxLength={80}
                      onChange={(e) => setNuevaCategoria(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void crearCategoriaEnLinea();
                        }
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          e.nativeEvent.stopImmediatePropagation();
                          setNuevaCategoria(null);
                        }
                      }}
                      placeholder="Ej.: Bebidas"
                      className={cn(campoClase, "h-9")}
                    />
                    <button type="button" onClick={() => setNuevaCategoria(null)} className={cn(botonSecundario, "h-9")}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void crearCategoriaEnLinea()}
                      disabled={!nuevaCategoria.trim() || creandoCategoria}
                      className={cn(botonPrimario, "h-9")}
                    >
                      Crear
                    </button>
                  </div>
                )}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${ids}-codigo`} className={etiqueta}>Código *</label>
                <div className="flex gap-2">
                  <input
                    id={`${ids}-codigo`}
                    value={form.codigo}
                    onChange={(e) => {
                      cambiar("codigo", e.target.value.toUpperCase());
                      setErrorCodigo(null);
                    }}
                    maxLength={50}
                    placeholder="BEB-001"
                    aria-invalid={Boolean(errorCodigo)}
                    aria-describedby={errorCodigo ? `${ids}-codigo-error` : undefined}
                    className={cn(campoClase, "font-mono", errorCodigo && "border-pos-brand")}
                  />
                  <button
                    type="button"
                    onClick={() => void generarCodigo(form.categoriaId, form.tipo)}
                    disabled={generando}
                    className={cn(botonSecundario, "h-11 shrink-0")}
                  >
                    <Sparkles className="size-4" aria-hidden /> Generar
                  </button>
                </div>
                {errorCodigo && (
                  <p id={`${ids}-codigo-error`} role="alert" className="mt-1.5 text-xs font-medium text-pos-brand">{errorCodigo}</p>
                )}
              </div>
              <div>
                <label htmlFor={`${ids}-barras`} className={etiqueta}>Código de barras <span className="font-normal text-pos-muted">(opcional)</span></label>
                <input
                  id={`${ids}-barras`}
                  value={form.codigoBarras}
                  onChange={(e) => cambiar("codigoBarras", e.target.value)}
                  maxLength={50}
                  inputMode="numeric"
                  placeholder="Escanéalo aquí"
                  className={cn(campoClase, "font-mono")}
                />
              </div>
            </div>
          </div>
        </Seccion>

        <Seccion numero={3} titulo="Precio e IVA" completa={pasos.precio}>
          <div className="flex flex-col gap-4">
            <fieldset>
              <legend className={etiqueta}>Tarifa de IVA</legend>
              <div className="flex flex-wrap gap-2">
                {tarifas.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={form.tarifa === t}
                    onClick={() => cambiar("tarifa", t)}
                    className={cn(
                      "h-9 min-w-16 cursor-pointer rounded-full border px-4 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pos-brand/15",
                      form.tarifa === t
                        ? "border-pos-brand bg-pos-brand-soft text-pos-brand"
                        : "border-pos-line-strong bg-white text-pos-ink hover:bg-pos-bg",
                    )}
                  >
                    {t}%
                  </button>
                ))}
              </div>
              {!TARIFAS_IVA.includes(form.tarifa as (typeof TARIFAS_IVA)[number]) && (
                <p className={ayuda}>La tarifa del {form.tarifa}% ya no está vigente; elige 15%, 5% o 0%.</p>
              )}
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label htmlFor={`${ids}-precio`} className={etiqueta}>Precio *</label>
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-xl font-semibold text-pos-muted">$</span>
                  <input
                    id={`${ids}-precio`}
                    value={form.precio}
                    onChange={(e) => cambiar("precio", e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className={cn(campoClase, "h-14 pl-9 text-2xl font-bold tabular-nums")}
                  />
                </div>
              </div>
              <div role="radiogroup" aria-label="El precio digitado" className="inline-flex h-11 rounded-[10px] border border-pos-line-strong bg-pos-bg p-1">
                {[
                  { valor: false, texto: "Sin IVA" },
                  { valor: true, texto: "Ya incluye IVA" },
                ].map((op) => (
                  <button
                    key={op.texto}
                    type="button"
                    role="radio"
                    aria-checked={form.incluyeIva === op.valor}
                    onClick={() => cambiar("incluyeIva", op.valor)}
                    className={cn(
                      "cursor-pointer rounded-[8px] px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pos-brand/40",
                      form.incluyeIva === op.valor ? "bg-white text-pos-ink shadow-sm" : "text-pos-muted hover:text-pos-ink",
                    )}
                  >
                    {op.texto}
                  </button>
                ))}
              </div>
            </div>

            <dl className="grid grid-cols-3 overflow-hidden rounded-2xl border border-pos-line text-center" aria-live="polite">
              <div className="px-3 py-3">
                <dt className="text-xs text-pos-muted">Base (sin IVA)</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">{usd.format(calculo.subtotal)}</dd>
              </div>
              <div className="border-x border-pos-line px-3 py-3">
                <dt className="text-xs text-pos-muted">IVA {form.tarifa}%</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">{usd.format(calculo.iva)}</dd>
              </div>
              <div className="bg-pos-brand-soft px-3 py-3">
                <dt className="text-xs text-pos-brand">Precio al público</dt>
                <dd className="mt-0.5 text-lg font-extrabold tabular-nums text-pos-brand">{usd.format(calculo.pvp)}</dd>
              </div>
            </dl>
            {form.incluyeIva && calculo.base > 0 && (
              <p className={ayuda}>Se guarda la base ${String(calculo.base)} para que el precio al público sea exacto.</p>
            )}
          </div>
        </Seccion>

        {esProducto && (
          <Seccion numero={4} titulo="Stock" completa={pasos.stock}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor={`${ids}-stock`} className={etiqueta}>{editando ? "Stock actual" : "Stock inicial"}</label>
                <input
                  id={`${ids}-stock`}
                  value={form.stock}
                  onChange={(e) => cambiar("stock", e.target.value)}
                  inputMode="decimal"
                  disabled={editando}
                  aria-describedby={editando ? `${ids}-stock-ayuda` : undefined}
                  className={cn(campoClase, "tabular-nums")}
                />
                {editando && <p id={`${ids}-stock-ayuda`} className={ayuda}>Se ajusta desde el kardex.</p>}
              </div>
              <div>
                <label htmlFor={`${ids}-minimo`} className={etiqueta}>Avisarme con</label>
                <input
                  id={`${ids}-minimo`}
                  value={form.stockMinimo}
                  onChange={(e) => cambiar("stockMinimo", e.target.value)}
                  inputMode="decimal"
                  aria-describedby={`${ids}-minimo-ayuda`}
                  className={cn(campoClase, "tabular-nums")}
                />
              </div>
              <div>
                <label htmlFor={`${ids}-unidad`} className={etiqueta}>Unidad</label>
                <select
                  id={`${ids}-unidad`}
                  value={form.unidad}
                  onChange={(e) => cambiar("unidad", e.target.value)}
                  className={cn(campoClase, "cursor-pointer")}
                >
                  {(UNIDADES as readonly string[]).includes(form.unidad) ? null : <option value={form.unidad}>{form.unidad}</option>}
                  {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <p id={`${ids}-minimo-ayuda`} className={cn(ayuda, "sm:col-span-3 -mt-2")}>
                Cuando queden {minimoNum >= 0 ? etiquetaStock(minimoNum, form.unidad) : "N"} o menos, te avisamos.
              </p>
            </div>
          </Seccion>
        )}

        <Seccion numero={esProducto ? 5 : 4} titulo="Dónde se vende" completa>
          <div className="flex flex-col gap-3">
            <Interruptor
              id={`${ids}-pos`}
              activo={form.visiblePos}
              onChange={(v) => cambiar("visiblePos", v)}
              titulo="Mostrar en Punto de venta"
              detalle="Aparece en el catálogo de caja."
            />
            {INVENTARIO_FEATURES.publicarEcommerce && (
              <Interruptor id={`${ids}-ecommerce`} activo={false} onChange={() => {}} titulo="Publicar en eCommerce" detalle="Se muestra en tu tienda en línea." />
            )}
            <div>
              <button
                type="button"
                aria-expanded={descripcionAbierta}
                aria-controls={`${ids}-descripcion`}
                onClick={() => setDescripcionAbierta((v) => !v)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md text-sm font-medium text-pos-muted hover:text-pos-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pos-brand/40"
              >
                <ChevronDown className={cn("size-4 transition-transform", descripcionAbierta && "rotate-180")} aria-hidden />
                Agregar descripción (opcional)
              </button>
              {descripcionAbierta && (
                <div className="mt-2">
                  <label htmlFor={`${ids}-descripcion`} className="sr-only">Descripción</label>
                  <textarea
                    id={`${ids}-descripcion`}
                    value={form.descripcion}
                    onChange={(e) => cambiar("descripcion", e.target.value)}
                    rows={3}
                    className={cn(campoClase, "h-auto py-2.5")}
                  />
                </div>
              )}
            </div>
          </div>
        </Seccion>

        {editando && onDesactivar && producto.activo && (
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3",
              confirmandoBaja ? "border-pos-brand/40 bg-pos-brand-soft" : "border-pos-line",
            )}
          >
            <p className="min-w-0 flex-1 text-sm text-pos-muted" role={confirmandoBaja ? "alert" : undefined}>
              {confirmandoBaja
                ? `¿Desactivar «${producto.nombre}»? Dejará de aparecer en caja y facturas.`
                : "Desactívalo para que deje de aparecer en caja y facturas. Su kardex se conserva."}
            </p>
            {confirmandoBaja ? (
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setConfirmandoBaja(false)} className={botonSecundario}>
                  No
                </button>
                <button type="button" onClick={() => onDesactivar(producto)} className={botonPrimario}>
                  Sí, desactivar
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmandoBaja(true)} className={cn(botonSecundario, "shrink-0 text-pos-brand")}>
                Desactivar
              </button>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}

const etiqueta = "mb-1.5 block text-sm font-medium text-pos-ink";
const ayuda = "mt-1.5 text-xs text-pos-muted";
export const botonSecundario =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-pos-line-strong bg-white px-4 text-sm font-semibold text-pos-ink transition-colors hover:bg-pos-bg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pos-brand/15 disabled:cursor-not-allowed disabled:opacity-50";
export const botonPrimario =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-pos-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-pos-brand-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pos-brand/25 disabled:cursor-not-allowed disabled:opacity-50";

function Seccion({ numero, titulo, completa, children }: { numero: number; titulo: string; completa: boolean; children: ReactNode }) {
  return (
    <section aria-labelledby={`seccion-${numero}`}>
      <h3 id={`seccion-${numero}`} className="mb-3 flex items-center gap-2.5 text-base font-semibold">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-colors",
            completa ? "bg-pos-ok text-white" : "bg-pos-bg text-pos-muted ring-1 ring-pos-line-strong",
          )}
        >
          {numero}
          <span className="sr-only">{completa ? " (completo)" : " (pendiente)"}</span>
        </span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function TarjetaTipo({ activa, icono, titulo, detalle, onClick }: { activa: boolean; icono: ReactNode; titulo: string; detalle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pos-brand/15",
        activa ? "border-pos-brand bg-pos-brand-soft" : "border-pos-line-strong bg-white hover:bg-pos-bg",
      )}
    >
      <span className={cn("flex size-10 items-center justify-center rounded-xl", activa ? "bg-white text-pos-brand" : "bg-pos-bg text-pos-muted")}>
        {icono}
      </span>
      <span>
        <span className="block font-semibold">{titulo}</span>
        <span className="block text-xs text-pos-muted">{detalle}</span>
      </span>
    </button>
  );
}

function Interruptor({ id, activo, onChange, titulo, detalle }: { id: string; activo: boolean; onChange: (v: boolean) => void; titulo: string; detalle: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-pos-line px-4 py-3">
      <div>
        <p id={`${id}-titulo`} className="text-sm font-medium">{titulo}</p>
        <p className="text-xs text-pos-muted">{detalle}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={activo}
        aria-labelledby={`${id}-titulo`}
        onClick={() => onChange(!activo)}
        className={cn(
          "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pos-brand/20",
          activo ? "bg-pos-brand" : "bg-pos-line-strong",
        )}
      >
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", activo && "translate-x-5")} />
      </button>
    </div>
  );
}
