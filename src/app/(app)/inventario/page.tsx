"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Box, CircleCheck, Package, Plus, Search, TrendingDown, Upload } from "lucide-react";
import { toast } from "sonner";
import Topbar from "@/components/layout/Topbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { ViewModeToggle } from "@/components/lists/ListToolbar";
import { useViewMode } from "@/components/lists/useViewMode";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { posFont } from "../punto-de-venta/_lib/pos-font";
import CategoriasPanel from "./_components/CategoriasPanel";
import Kardex from "./_components/Kardex";
import ListaProductos from "./_components/ListaProductos";
import ProductoDrawer, { botonPrimario, botonSecundario } from "./_components/ProductoDrawer";
import {
  INVENTARIO_FEATURES,
  leerError,
  productoDesdeApi,
  type Categoria,
  type FiltroCategoria,
  type FiltroEstado,
  type Producto,
  type Resumen,
} from "./_lib/inventario";

const RESUMEN_VACIO: Resumen = { total: 0, disponibles: 0, bajo: 0, agotado: 0 };
const ESTILO_TOAST = { background: "#1C1917", color: "#FFFFFF", border: "none" } as const;

export default function InventarioPage() {
  const { hasSriLinked } = useAuth();
  const [vista, setVista] = useViewMode("inventario");

  const [lista, setLista] = useState<{ consulta: string; productos: Producto[]; error: string | null } | null>(null);
  const [resumen, setResumen] = useState<Resumen>(RESUMEN_VACIO);
  const [catalogo, setCatalogo] = useState(true);
  const [version, setVersion] = useState(0);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [totalCatalogo, setTotalCatalogo] = useState(0);
  const [sinCategoria, setSinCategoria] = useState(0);
  const [creandoCategoria, setCreandoCategoria] = useState(false);

  const [termino, setTermino] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>(null);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const [drawer, setDrawer] = useState<{ clave: number; producto: Producto | null } | null>(null);
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBusqueda(termino.trim()), 250);
    return () => clearTimeout(t);
  }, [termino]);

  const params = new URLSearchParams({ activo: mostrarInactivos ? "false" : "true" });
  if (!mostrarInactivos) params.set("resumen", "true");
  if (busqueda) params.set("termino", busqueda);
  if (filtroCategoria) params.set("categoriaId", filtroCategoria);
  if (filtroEstado !== "todos") params.set("estado", filtroEstado);
  const consulta = params.toString();

  useEffect(() => {
    if (!hasSriLinked) return;
    let vigente = true;
    apiFetch(`/api/ecommerce/productos?${consulta}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await leerError(res, "No se pudo cargar el inventario"));
        const data = (await res.json()) as { data: Record<string, unknown>[]; catalogo?: boolean; resumen?: Resumen };
        if (!vigente) return;
        setLista({ consulta, productos: data.data.map(productoDesdeApi), error: null });
        setCatalogo(data.catalogo !== false);
        if (data.resumen) setResumen(data.resumen);
      })
      .catch((e: unknown) => {
        if (vigente) setLista({ consulta, productos: [], error: e instanceof Error ? e.message : "No se pudo cargar el inventario" });
      });
    return () => {
      vigente = false;
    };
  }, [hasSriLinked, consulta, version]);

  useEffect(() => {
    if (!hasSriLinked) return;
    let vigente = true;
    apiFetch("/api/inventario/categorias")
      .then(async (res) => {
        if (res.status === 503) {
          if (vigente) setCatalogo(false);
          return;
        }
        if (!res.ok) throw new Error(await leerError(res, "No se pudieron cargar las categorías"));
        const data = (await res.json()) as { data: Categoria[]; total: number; sinCategoria: number };
        if (!vigente) return;
        setCategorias(data.data);
        setTotalCatalogo(data.total);
        setSinCategoria(data.sinCategoria);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudieron cargar las categorías"));
    return () => {
      vigente = false;
    };
  }, [hasSriLinked, version]);

  const refrescar = useCallback(() => setVersion((v) => v + 1), []);

  // El esqueleto solo aparece al cambiar de consulta; un refresco mantiene la lista visible.
  const cargando = lista === null || lista.consulta !== consulta;
  const productos = lista?.productos ?? [];
  const errorCarga = cargando ? null : lista.error;

  async function crearCategoria(nombre: string): Promise<Categoria | null> {
    try {
      const res = await apiFetch("/api/inventario/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      if (!res.ok) throw new Error(await leerError(res, "No se pudo crear la categoría"));
      const data = (await res.json()) as { data: Categoria };
      setCategorias((cs) => [...cs, data.data]);
      toast(`Categoría «${data.data.nombre}» creada`, { position: "bottom-center", style: ESTILO_TOAST });
      return data.data;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la categoría");
      return null;
    }
  }

  async function actualizarCategoria(id: string, cambios: { nombre?: string; activo?: boolean }, exito: string): Promise<boolean> {
    try {
      const res = await apiFetch(`/api/inventario/categorias/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      if (!res.ok) throw new Error(await leerError(res, "No se pudo actualizar la categoría"));
      toast(exito, { position: "bottom-center", style: ESTILO_TOAST });
      if (cambios.activo === false && filtroCategoria === id) setFiltroCategoria(null);
      refrescar();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar la categoría");
      return false;
    }
  }

  async function desactivarProducto(p: Producto) {
    try {
      const res = await apiFetch(`/api/ecommerce/productos/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await leerError(res, "No se pudo desactivar"));
      toast(`«${p.nombre}» desactivado`, { position: "bottom-center", style: ESTILO_TOAST });
      setDrawer(null);
      if (seleccionado?.id === p.id) setSeleccionado(null);
      refrescar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo desactivar");
    }
  }

  async function reactivarProducto(p: Producto) {
    try {
      const res = await apiFetch(`/api/ecommerce/productos/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: true }),
      });
      if (!res.ok) throw new Error(await leerError(res, "No se pudo reactivar"));
      toast(`«${p.nombre}» reactivado`, { position: "bottom-center", style: ESTILO_TOAST });
      refrescar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reactivar");
    }
  }

  function abrirNuevo() {
    setDrawer({ clave: Date.now(), producto: null });
  }

  function abrirEditar(p: Producto) {
    if (!p.activo) {
      void reactivarProducto(p);
      return;
    }
    setDrawer({ clave: Date.now(), producto: p });
  }

  function limpiarFiltros() {
    setTermino("");
    setBusqueda("");
    setFiltroCategoria(null);
    setFiltroEstado("todos");
  }

  if (!hasSriLinked) {
    return (
      <>
        <title>Inventario - EXA ATI</title>
        <Topbar title="Inventario" />
        <main className="ui-page flex-1">
          <EmptyState icon={<Package className="size-5" />} title="Vincula tu RUC del SRI en Configuración para gestionar productos." />
        </main>
      </>
    );
  }

  const hayFiltros = Boolean(busqueda || filtroCategoria || filtroEstado !== "todos");
  const catalogoVacio = !cargando && !errorCarga && !mostrarInactivos && !hayFiltros && productos.length === 0;

  return (
    <>
      <title>Inventario - EXA ATI</title>
      <Topbar title="Inventario" />
      <main className={cn(posFont.className, "flex-1 bg-pos-bg px-4 py-6 text-pos-ink sm:px-6 lg:px-8")}>
        <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
              <p className="mt-0.5 text-sm text-pos-muted">Productos y servicios que vendes en Punto de venta, Facturas y eCommerce</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {INVENTARIO_FEATURES.importarExcel && (
                <button type="button" className={botonSecundario}>
                  <Upload className="size-4" aria-hidden /> Importar desde Excel
                </button>
              )}
              <button type="button" onClick={abrirNuevo} disabled={!catalogo} className={botonPrimario}>
                <Plus className="size-4" aria-hidden /> Nuevo producto
              </button>
            </div>
          </header>

          {!catalogo && (
            <p role="status" className="rounded-2xl border border-pos-warn/30 bg-pos-warn-bg px-4 py-3 text-sm text-pos-warn">
              Las categorías y el registro guiado necesitan la migración <code className="font-mono">017_catalogo_productos</code>, que aún no está aplicada en esta base de datos. Los productos existentes se siguen vendiendo con normalidad.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TarjetaResumen titulo="Total" valor={resumen.total} icono={<Box className="size-5" aria-hidden />} tono="azul" activa={filtroEstado === "todos"} onClick={() => setFiltroEstado("todos")} />
            <TarjetaResumen titulo="Disponibles" valor={resumen.disponibles} icono={<CircleCheck className="size-5" aria-hidden />} tono="verde" activa={filtroEstado === "disponible"} onClick={() => setFiltroEstado("disponible")} />
            <TarjetaResumen titulo="Stock bajo" valor={resumen.bajo} icono={<TrendingDown className="size-5" aria-hidden />} tono="ambar" activa={filtroEstado === "bajo"} onClick={() => setFiltroEstado("bajo")} />
            <TarjetaResumen titulo="Sin stock" valor={resumen.agotado} icono={<AlertTriangle className="size-5" aria-hidden />} tono="rojo" activa={filtroEstado === "agotado"} onClick={() => setFiltroEstado("agotado")} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
            <CategoriasPanel
              categorias={categorias}
              total={totalCatalogo}
              sinCategoria={sinCategoria}
              seleccion={filtroCategoria}
              onSeleccionar={setFiltroCategoria}
              onCrear={crearCategoria}
              onRenombrar={(id, nombre) => actualizarCategoria(id, { nombre }, `Categoría renombrada a «${nombre}»`)}
              onDesactivar={(c) => actualizarCategoria(c.id, { activo: false }, `Categoría «${c.nombre}» desactivada`)}
              creando={creandoCategoria}
              onCreandoChange={setCreandoCategoria}
              deshabilitado={!catalogo}
            />

            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-0 flex-[1_1_16rem] sm:max-w-md">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-pos-muted" aria-hidden />
                  <input
                    type="search"
                    value={termino}
                    onChange={(e) => setTermino(e.target.value)}
                    placeholder="Buscar por código, nombre o código de barras…"
                    aria-label="Buscar por código, nombre o código de barras"
                    className="h-11 w-full rounded-[10px] border border-pos-line-strong bg-white pr-3 pl-9 text-sm placeholder:text-pos-muted/80 focus:border-pos-brand focus:outline-none focus:ring-4 focus:ring-pos-brand/15"
                  />
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-pos-muted">
                    <input
                      type="checkbox"
                      checked={mostrarInactivos}
                      onChange={(e) => setMostrarInactivos(e.target.checked)}
                      className="size-4 accent-pos-brand"
                    />
                    Inactivos
                  </label>
                  <span className="text-sm text-pos-muted tabular-nums" aria-live="polite">
                    {productos.length} {productos.length === 1 ? "producto" : "productos"}
                  </span>
                  <ViewModeToggle view={vista} onViewChange={setVista} />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-pos-line bg-white">
                {cargando ? (
                  <div className="p-6"><TableSkeleton rows={5} columns={6} /></div>
                ) : errorCarga ? (
                  <EmptyState
                    icon={<AlertTriangle className="size-5" />}
                    title="No se pudo cargar el inventario"
                    description={errorCarga}
                    action={<button type="button" onClick={refrescar} className={botonSecundario}>Reintentar</button>}
                  />
                ) : catalogoVacio ? (
                  <PasosIniciales
                    hayCategorias={categorias.length > 0}
                    onCrearCategoria={() => setCreandoCategoria(true)}
                    onNuevoProducto={abrirNuevo}
                    deshabilitado={!catalogo}
                  />
                ) : productos.length === 0 ? (
                  <EmptyState
                    icon={<Search className="size-5" />}
                    title={mostrarInactivos ? "No hay productos inactivos" : "Ningún producto coincide con los filtros"}
                    action={hayFiltros ? <button type="button" onClick={limpiarFiltros} className={botonSecundario}>Quitar filtros</button> : undefined}
                  />
                ) : (
                  <ListaProductos
                    productos={productos}
                    vista={vista}
                    seleccionadoId={seleccionado?.id ?? null}
                    onSeleccionar={setSeleccionado}
                    onEditar={abrirEditar}
                    edicionDeshabilitada={!catalogo}
                  />
                )}
              </div>

              {mostrarInactivos && productos.length > 0 && (
                <p className="text-xs text-pos-muted">Pulsa «Reactivar» en un producto inactivo para que vuelva a la caja y las facturas.</p>
              )}

              {seleccionado && (
                <Kardex
                  key={seleccionado.id}
                  producto={seleccionado}
                  onCerrar={() => setSeleccionado(null)}
                  onStockCambiado={refrescar}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {drawer && (
        <ProductoDrawer
          key={drawer.clave}
          open
          producto={drawer.producto}
          categorias={categorias}
          onClose={() => setDrawer(null)}
          onCrearCategoria={crearCategoria}
          onDesactivar={desactivarProducto}
          onGuardado={({ nombre, categoria }) => {
            toast(categoria ? `“${nombre}” guardado en ${categoria}` : `“${nombre}” guardado`, {
              position: "bottom-center",
              style: ESTILO_TOAST,
            });
            refrescar();
          }}
        />
      )}
    </>
  );
}

const TONOS = {
  azul: { fondo: "#EFF6FF", texto: "#2563EB" },
  verde: { fondo: "#F0FDF4", texto: "#16A34A" },
  ambar: { fondo: "#FFF7ED", texto: "#D97706" },
  rojo: { fondo: "#FBEAEA", texto: "#A3222A" },
} as const;

function TarjetaResumen({
  titulo,
  valor,
  icono,
  tono,
  activa,
  onClick,
}: {
  titulo: string;
  valor: number;
  icono: ReactNode;
  tono: keyof typeof TONOS;
  activa: boolean;
  onClick: () => void;
}) {
  const color = TONOS[tono];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pos-brand/15",
        activa ? "border-pos-brand shadow-[0_0_0_1px_var(--color-pos-brand)]" : "border-pos-line hover:border-pos-line-strong",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: color.fondo, color: color.texto }}>
        {icono}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-pos-muted">{titulo}</span>
        <span className="block text-2xl font-extrabold tabular-nums leading-tight">{valor}</span>
      </span>
    </button>
  );
}

function PasosIniciales({
  hayCategorias,
  onCrearCategoria,
  onNuevoProducto,
  deshabilitado,
}: {
  hayCategorias: boolean;
  onCrearCategoria: () => void;
  onNuevoProducto: () => void;
  deshabilitado: boolean;
}) {
  const pasos = [
    { titulo: "Crea tus categorías", detalle: "Bebidas, Abarrotes, Servicios… ordenan tu catálogo y la caja.", accion: "Crear categoría", onClick: onCrearCategoria, hecho: hayCategorias },
    { titulo: "Registra tus productos", detalle: "Nombre, precio con o sin IVA y stock, en un solo panel.", accion: "Nuevo producto", onClick: onNuevoProducto, hecho: false },
    ...(INVENTARIO_FEATURES.importarExcel
      ? [{ titulo: "Impórtalos desde Excel", detalle: "Sube tu lista y revisa antes de guardar.", accion: "Importar", onClick: () => {}, hecho: false }]
      : []),
  ];
  return (
    <div className="px-6 py-10">
      <h2 className="text-center text-lg font-bold">Arma tu catálogo en {pasos.length} pasos</h2>
      <ol className={cn("mx-auto mt-6 grid max-w-3xl gap-3", pasos.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {pasos.map((p, i) => (
          <li key={p.titulo} className="flex flex-col gap-3 rounded-2xl border border-pos-line p-4">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                p.hecho ? "bg-pos-ok text-white" : "bg-pos-brand-soft text-pos-brand",
              )}
            >
              {i + 1}
            </span>
            <div>
              <h3 className="font-semibold">{p.titulo}</h3>
              <p className="mt-0.5 text-sm text-pos-muted">{p.detalle}</p>
            </div>
            <button type="button" onClick={p.onClick} disabled={deshabilitado} className={cn(i === 1 ? botonPrimario : botonSecundario, "mt-auto")}>
              {p.accion}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
