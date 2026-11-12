"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Dialog from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";
import { NOMBRE_CATEGORIA_MAX, colorCategoria } from "@/lib/inventario/catalogo";
import Campo from "./Campo";
import { boton, chip, control } from "./tokens";
import type { ProductoInventario } from "./types";

const TARIFAS = [
  { value: 15, label: "IVA 15%" },
  { value: 5, label: "IVA 5%" },
  { value: 0, label: "0%" },
] as const;

interface CategoriaOpcion {
  id: string;
  nombre: string;
  color: number;
}

interface ProductoRapidoDialogProps {
  open: boolean;
  nombreInicial: string;
  precioInicial?: number;
  tarifaInicial?: number;
  onCerrar: () => void;
  onCreado: (producto: ProductoInventario) => void;
}

async function leerError(res: Response, porDefecto: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { message?: string } | null;
  return data?.message || porDefecto;
}

export default function ProductoRapidoDialog({
  open, nombreInicial, precioInicial, tarifaInicial, onCerrar, onCreado,
}: ProductoRapidoDialogProps) {
  const baseId = useId();
  const precioRef = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState(nombreInicial);
  const [tipo, setTipo] = useState<"producto" | "servicio">("producto");
  const [codigo, setCodigo] = useState("");
  const [precio, setPrecio] = useState(precioInicial && precioInicial > 0 ? String(precioInicial) : "");
  const [tarifa, setTarifa] = useState(tarifaInicial ?? 15);
  const [stock, setStock] = useState("0");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<CategoriaOpcion[]>([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState<string | null>(null);
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generandoCodigo, setGenerandoCodigo] = useState(false);
  const codigoAutoRef = useRef<string>("");

  useEffect(() => {
    if (!open) return;
    setNombre(nombreInicial);
    setTipo("producto");
    setPrecio(precioInicial && precioInicial > 0 ? String(precioInicial) : "");
    setTarifa(tarifaInicial ?? 15);
    setStock("0");
    setCategoriaId(null);
    setNuevaCategoria(null);
    setError(null);
    setGuardando(false);
    codigoAutoRef.current = "";
    let cancel = false;
    void cargarCategorias(() => cancel);
    void sugerirCodigo("producto", null, () => cancel);
    return () => { cancel = true; };
  }, [open, nombreInicial, precioInicial, tarifaInicial]);

  async function cargarCategorias(cancelado?: () => boolean) {
    setCargandoCategorias(true);
    try {
      const res = await apiFetch("/api/inventario/categorias");
      if (!res.ok) throw new Error(await leerError(res, "No se pudieron cargar las categorías"));
      const data = (await res.json()) as { data: CategoriaOpcion[] };
      if (cancelado?.()) return;
      setCategorias(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      if (!cancelado?.()) {
        setError(e instanceof Error ? e.message : "No se pudieron cargar las categorías");
        setCategorias([]);
      }
    } finally {
      if (!cancelado?.()) setCargandoCategorias(false);
    }
  }

  async function sugerirCodigo(
    siguienteTipo: "producto" | "servicio",
    siguienteCategoria: string | null,
    cancelado?: () => boolean,
  ) {
    setGenerandoCodigo(true);
    try {
      const params = new URLSearchParams({ tipo: siguienteTipo });
      if (siguienteCategoria) params.set("categoriaId", siguienteCategoria);
      const res = await apiFetch(`/api/inventario/codigo-sugerido?${params}`);
      if (!res.ok) throw new Error(await leerError(res, "No se pudo sugerir un código"));
      const data = (await res.json()) as { data: { codigo: string } };
      if (cancelado?.()) return;
      setCodigo(data.data.codigo);
      codigoAutoRef.current = data.data.codigo;
    } catch {
      if (!cancelado?.() && !codigoAutoRef.current) setCodigo("");
    } finally {
      if (!cancelado?.()) setGenerandoCodigo(false);
    }
  }

  function codigoSigueAuto() {
    return !codigo.trim() || codigo === codigoAutoRef.current;
  }

  function elegirCategoria(id: string) {
    setCategoriaId(id);
    if (codigoSigueAuto()) void sugerirCodigo(tipo, id);
  }

  async function crearCategoriaEnLinea() {
    const nombreCat = (nuevaCategoria ?? "").trim();
    if (!nombreCat || creandoCategoria) return;
    setCreandoCategoria(true);
    setError(null);
    try {
      const res = await apiFetch("/api/inventario/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreCat }),
      });
      if (!res.ok) throw new Error(await leerError(res, "No se pudo crear la categoría"));
      const data = (await res.json()) as { data: CategoriaOpcion };
      setCategorias((actuales) => [...actuales, data.data]);
      setNuevaCategoria(null);
      elegirCategoria(data.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la categoría");
    } finally {
      setCreandoCategoria(false);
    }
  }

  const precioNum = Number.parseFloat(precio);
  const stockNum = Number.parseFloat(stock);
  const listo = Boolean(nombre.trim() && codigo.trim() && categoriaId && Number.isFinite(precioNum) && precioNum > 0)
    && (tipo === "servicio" || (Number.isFinite(stockNum) && stockNum >= 0));

  async function guardar(event: FormEvent) {
    event.preventDefault();
    if (!listo || guardando || !categoriaId) return;
    setGuardando(true);
    setError(null);
    const precioBase = Math.round(precioNum * 1e6) / 1e6;
    const stockFinal = tipo === "servicio" ? 0 : stockNum;
    try {
      const res = await apiFetch("/api/ecommerce/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: codigo.trim(),
          nombre: nombre.trim(),
          precioUnitario: precioBase,
          ivaPorcentaje: tarifa,
          tipo,
          categoriaId,
          stock: stockFinal,
          visiblePos: true,
        }),
      });
      if (!res.ok) {
        setError(await leerError(res, "No se pudo registrar el producto"));
        return;
      }
      const data = (await res.json()) as { id: string };
      onCreado({
        id: data.id,
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        precio_unitario: String(precioBase),
        iva_porcentaje: tarifa,
        stock: String(stockFinal),
      });
    } catch {
      setError("No se pudo registrar el producto. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onCerrar}
      title="Registrar en inventario"
      description="Completa lo mínimo para usarlo en esta factura. Quedará guardado para la próxima."
      size="md"
      initialFocusRef={precioRef}
      panelClassName="gap-3"
    >
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <Campo id={`${baseId}-nombre`} label="Nombre" requerido>
          <Input
            id={`${baseId}-nombre`}
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            className={control}
          />
        </Campo>
        <div>
          <p id={`${baseId}-tipo`} className="text-[13px] text-brand-gray-700">Tipo</p>
          <div role="radiogroup" aria-labelledby={`${baseId}-tipo`} className="mt-1 flex gap-2">
            {(["producto", "servicio"] as const).map((opcion) => {
              const activo = tipo === opcion;
              return (
                <button
                  key={opcion}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => {
                    setTipo(opcion);
                    if (codigoSigueAuto()) void sugerirCodigo(opcion, categoriaId);
                  }}
                  className={cn(chip.base, activo ? chip.activo : chip.inactivo)}
                >
                  {opcion === "producto" ? "Producto" : "Servicio"}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p id={`${baseId}-cat`} className="text-[13px] text-brand-gray-700">
            Categoría <span className="text-brand-red">*</span>
          </p>
          {cargandoCategorias ? (
            <p className="mt-1 text-[13px] text-brand-gray-500">Cargando categorías…</p>
          ) : (
            <div role="radiogroup" aria-labelledby={`${baseId}-cat`} className="mt-1 flex flex-wrap gap-2">
              {categorias.map((categoria) => {
                const activa = categoria.id === categoriaId;
                const col = colorCategoria(categoria.color);
                return (
                  <button
                    key={categoria.id}
                    type="button"
                    role="radio"
                    aria-checked={activa}
                    onClick={() => elegirCategoria(categoria.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
                      activa ? "border-transparent" : "border-brand-gray-200 bg-white text-brand-gray-700 hover:bg-brand-gray-50",
                    )}
                    style={activa ? { background: col.fondo, color: col.texto, boxShadow: `inset 0 0 0 1.5px ${col.punto}` } : undefined}
                  >
                    <span aria-hidden className="size-2 rounded-full" style={{ background: col.punto }} />
                    {categoria.nombre}
                  </button>
                );
              })}
              {nuevaCategoria === null ? (
                <button
                  type="button"
                  onClick={() => setNuevaCategoria("")}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-brand-gray-300 px-3 text-[13px] font-medium text-brand-gray-500 hover:border-brand-red hover:text-brand-red"
                >
                  <Plus className="size-3.5" aria-hidden /> Nueva
                </button>
              ) : (
                <div className="flex w-full items-center gap-2">
                  <Input
                    aria-label="Nombre de la nueva categoría"
                    autoFocus
                    value={nuevaCategoria}
                    maxLength={NOMBRE_CATEGORIA_MAX}
                    onChange={(event) => setNuevaCategoria(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void crearCategoriaEnLinea();
                      }
                      if (event.key === "Escape") {
                        event.stopPropagation();
                        event.nativeEvent.stopImmediatePropagation();
                        setNuevaCategoria(null);
                      }
                    }}
                    placeholder="Ej. Bebidas"
                    className={control}
                  />
                  <Button type="button" variant="outline" onClick={() => setNuevaCategoria(null)} className={boton.secundario}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    disabled={!nuevaCategoria.trim() || creandoCategoria}
                    onClick={() => void crearCategoriaEnLinea()}
                    className="h-9 rounded-lg bg-brand-red px-3 text-white hover:brightness-90"
                  >
                    {creandoCategoria ? "Creando…" : "Crear"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo id={`${baseId}-codigo`} label="Código" requerido hint={generandoCodigo ? "Generando…" : undefined}>
            <Input
              id={`${baseId}-codigo`}
              value={codigo}
              onChange={(event) => setCodigo(event.target.value)}
              className={cn(control, "font-mono")}
            />
          </Campo>
          <Campo id={`${baseId}-precio`} label="Precio sin IVA" requerido>
            <Input
              ref={precioRef}
              id={`${baseId}-precio`}
              type="number"
              min={0}
              step="0.01"
              value={precio}
              onChange={(event) => setPrecio(event.target.value)}
              className={cn(control, "text-right tabular-nums")}
            />
          </Campo>
          <Campo id={`${baseId}-iva`} label="Tarifa IVA">
            <select
              id={`${baseId}-iva`}
              value={tarifa}
              onChange={(event) => setTarifa(Number(event.target.value))}
              className={control}
            >
              {TARIFAS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Campo>
          {tipo === "producto" ? (
            <Campo id={`${baseId}-stock`} label="Stock inicial">
              <Input
                id={`${baseId}-stock`}
                type="number"
                min={0}
                step="1"
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                className={cn(control, "text-right tabular-nums")}
              />
            </Campo>
          ) : (
            <div />
          )}
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-brand-red">{error}</p>
        )}
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCerrar} className={boton.secundario}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!listo || guardando} className="h-9 rounded-lg bg-brand-red px-3 text-white hover:brightness-90">
            {guardando ? "Registrando…" : "Registrar y agregar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
