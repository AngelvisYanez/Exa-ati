"use client";

import { useEffect, useId, useState } from "react";
import { ArrowDown, ArrowUp, History, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { etiquetaStock } from "@/lib/inventario/catalogo";
import { botonPrimario, campoClase } from "./ProductoDrawer";
import type { Producto } from "../_lib/inventario";

interface Movimiento {
  id: string;
  tipo: string;
  cantidad: string;
  stock_antes: string;
  stock_despues: string;
  motivo: string | null;
  created_at: string;
}

interface KardexProps {
  producto: Producto;
  onCerrar: () => void;
  onStockCambiado: () => void;
}

export default function Kardex({ producto, onCerrar, onStockCambiado }: KardexProps) {
  const ids = useId();
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  const [version, setVersion] = useState(0);
  const [stock, setStock] = useState(producto.stock);
  const [tipo, setTipo] = useState<"ENTRADA" | "SALIDA" | "AJUSTE">("ENTRADA");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const cargando = movimientos === null;

  useEffect(() => {
    let vigente = true;
    apiFetch(`/api/inventario/movimientos?productoId=${producto.id}`)
      .then(async (res) => {
        const data = await res.json();
        if (vigente) setMovimientos(res.ok ? data.data || [] : []);
      })
      .catch(() => {
        if (!vigente) return;
        setMovimientos([]);
        toast.error("Error al cargar kardex");
      });
    return () => {
      vigente = false;
    };
  }, [producto.id, version]);

  async function registrar() {
    const n = Number(cantidad);
    if (!cantidad || !Number.isFinite(n)) {
      toast.error("Cantidad requerida");
      return;
    }
    setGuardando(true);
    try {
      const res = await apiFetch("/api/inventario/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId: producto.id, tipo, cantidad: n, motivo: motivo || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Movimiento registrado");
      setCantidad("");
      setMotivo("");
      if (data?.data?.stock_despues != null) setStock(Number(data.data.stock_despues));
      setVersion((v) => v + 1);
      onStockCambiado();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al registrar movimiento");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section aria-labelledby={`${ids}-titulo`} className="rounded-2xl border border-pos-line bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <History className="size-4 text-pos-muted" aria-hidden />
        <h2 id={`${ids}-titulo`} className="text-sm font-bold">
          Kardex — {producto.codigo} · {producto.nombre}
        </h2>
        <Badge className="ml-auto tabular-nums">Stock: {etiquetaStock(stock, producto.unidad)}</Badge>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar kardex"
          className="flex size-8 cursor-pointer items-center justify-center rounded-[10px] text-pos-muted hover:bg-pos-bg hover:text-pos-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pos-brand/40"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {producto.tipo === "servicio" ? (
        <p className="text-sm text-pos-muted">Los servicios no manejan stock.</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div>
              <label htmlFor={`${ids}-tipo`} className="mb-1 block text-xs font-medium">Tipo</label>
              <select
                id={`${ids}-tipo`}
                value={tipo}
                onChange={(e) => setTipo(e.target.value as "ENTRADA" | "SALIDA" | "AJUSTE")}
                className={cn(campoClase, "cursor-pointer")}
              >
                <option value="ENTRADA">Entrada</option>
                <option value="SALIDA">Salida</option>
                <option value="AJUSTE">Ajuste (stock final)</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${ids}-cantidad`} className="mb-1 block text-xs font-medium">Cantidad</label>
              <input
                id={`${ids}-cantidad`}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                inputMode="decimal"
                className={cn(campoClase, "tabular-nums")}
              />
            </div>
            <div className="col-span-2">
              <label htmlFor={`${ids}-motivo`} className="mb-1 block text-xs font-medium">Motivo</label>
              <input
                id={`${ids}-motivo`}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Opcional"
                className={campoClase}
              />
            </div>
            <div className="col-span-2 flex items-end md:col-span-1">
              <button type="button" onClick={registrar} disabled={guardando} className={cn(botonPrimario, "w-full")}>
                {guardando ? "Registrando…" : "Registrar"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Antes</TableHead>
                  <TableHead className="text-right">Después</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargando ? (
                  <TableRow><TableCell colSpan={6} className="p-4"><TableSkeleton rows={2} columns={5} /></TableCell></TableRow>
                ) : movimientos === null || movimientos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState icon={<History className="size-5" />} title="Sin movimientos" compact />
                    </TableCell>
                  </TableRow>
                ) : (
                  movimientos.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{new Date(m.created_at).toLocaleString("es-EC")}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            m.tipo === "ENTRADA" ? "bg-success-pale text-success"
                              : m.tipo === "SALIDA" ? "bg-red-100 text-brand-red"
                                : "bg-amber-100 text-amber-800"
                          }
                        >
                          {m.tipo === "ENTRADA" && <ArrowDown className="mr-1 inline size-3" aria-hidden />}
                          {m.tipo === "SALIDA" && <ArrowUp className="mr-1 inline size-3" aria-hidden />}
                          {m.tipo === "AJUSTE" && <Settings2 className="mr-1 inline size-3" aria-hidden />}
                          {m.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(m.cantidad).toFixed(0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(m.stock_antes).toFixed(0)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{Number(m.stock_despues).toFixed(0)}</TableCell>
                      <TableCell className="text-pos-muted">{m.motivo || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}
