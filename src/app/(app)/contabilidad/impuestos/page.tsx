"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Percent } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";
interface Impuesto {
  id: string;
  codigo: string;
  nombre: string;
  porcentaje: number;
  tarifa: number;
  tipo: string;
  activo: boolean;
}

const FILTER_TIPOS = [
  { value: "", label: "Todos" },
  { value: "IVA", label: "IVA" },
  { value: "ICE", label: "ICE" },
  { value: "RENTA", label: "Renta" },
  { value: "IVA_RET", label: "Ret. IVA" },
  { value: "IRBPNR", label: "IRBPNR" },
];

const TIPO_BADGE: Record<string, string> = {
  IVA: "bg-sky-50 text-brand-sky border-sky-200",
  ICE: "bg-amber-50 text-amber-700 border-amber-200",
  RENTA: "bg-success-pale text-success border-success-light/40",
  IVA_RET: "bg-purple-50 text-purple-700 border-brand-gray-200",
  IRBPNR: "bg-brand-red-subtle text-brand-red border-brand-red-pale",
};

export default function ImpuestosPage() {
  const [impuestos, setImpuestos] = useState<Impuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = filterTipo ? `?tipo=${filterTipo}` : "";
      const res = await apiFetch(`/api/contabilidad/impuestos${params}`);
      if (!res.ok) throw new Error("Error al cargar");
      const data = await res.json();
      setImpuestos(data.impuestos || data.data || []);
    } catch {
      toast.error("Error al cargar impuestos");
    } finally {
      setLoading(false);
    }
  }, [filterTipo]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el impuesto "${nombre}"?`)) return;
    try {
      const res = await apiFetch(`/api/contabilidad/impuestos?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success("Impuesto eliminado");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <>
      <title>Impuestos - OFSERCONT IA</title>
      <Topbar title="Impuestos" backLink={{ href: "/contabilidad", label: "Contabilidad" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Impuestos</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Configuración de tarifas impositivas</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
            >
              {FILTER_TIPOS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <Link href="/contabilidad/impuestos/nueva">
              <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white">
                <Plus className="w-3.5 h-3.5" /> Nuevo Impuesto
              </Button>
            </Link>
          </div>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : impuestos.length === 0 ? (
            <EmptyState
              icon={<Percent className="w-5 h-5" />}
              title="No hay impuestos registrados."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse text-[13px]">
                <TableHeader>
                  <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <TableHead className="py-3 px-4 font-semibold">Código</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Nombre</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">%</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Tarifa</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Tipo</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Estado</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {impuestos.map((imp) => (
                    <TableRow key={imp.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <TableCell className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{imp.codigo}</TableCell>
                      <TableCell className="py-3 px-4 text-sm font-medium text-brand-gray-800">{imp.nombre}</TableCell>
                      <TableCell className="py-3 px-4 text-sm font-semibold">{imp.porcentaje}%</TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-600">{imp.tarifa}</TableCell>
                      <TableCell className="py-3 px-4">
                        <Badge variant="outline" className={`text-[10px] ${TIPO_BADGE[imp.tipo] || ""}`}>
                          {imp.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        {imp.activo ? (
                          <span className="text-[10px] font-semibold bg-success-pale text-success px-2 py-0.5 rounded-full">Activo</span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-brand-gray-100 text-brand-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/contabilidad/impuestos/${imp.id}`}
                          className="inline-flex items-center gap-1 text-brand-red hover:text-brand-red-bright text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1"
                        >
                          <Edit className="w-3 h-3" /> Editar
                        </Link>
                        <button
                          onClick={() => handleDelete(imp.id, imp.nombre)}
                          className="inline-flex items-center gap-1 text-red-500 hover:text-brand-red text-xs font-semibold border border-red-100 hover:bg-brand-red-subtle px-2 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Eliminar
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
