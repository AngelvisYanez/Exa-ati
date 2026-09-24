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
import { Plus, Eye, Trash2, Download, FileText } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";
interface Reporte {
  id: string;
  tipo: string;
  periodo: string;
  estado: string;
  fechaGeneracion: string;
  fechaPresentacion?: string;
  total?: number;
}

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR: "bg-brand-gray-100 text-brand-gray-600 border-brand-gray-200",
  GENERADO: "bg-sky-50 text-brand-sky border-sky-200",
  PRESENTADO: "bg-success-pale text-success border-success-light/40",
};

const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  GENERADO: "Generado",
  PRESENTADO: "Presentado",
};

export default function ReportesPage() {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState("");
  const [filterPeriodo, setFilterPeriodo] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterTipo) params.set("tipo", filterTipo);
      if (filterPeriodo) params.set("periodo", filterPeriodo);
      const res = await apiFetch(`/api/declaraciones/reportes?${params}`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setReportes(data.reportes || data.data || []);
    } catch {
      toast.error("Error al cargar reportes");
    } finally {
      setLoading(false);
    }
  }, [filterTipo, filterPeriodo]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este reporte?")) return;
    try {
      const res = await apiFetch(`/api/declaraciones/reportes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success("Reporte eliminado");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const formatFecha = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <>
      <title>Reportes - OFSERCONT IA</title>
      <Topbar title="Reportes Fiscales" backLink={{ href: "/declaraciones", label: "Declaraciones" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Reportes Fiscales</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Declaraciones generadas (Formularios 103, 104)</p>
          </div>
          <Link href="/declaraciones/reportes/nuevo">
            <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white">
              <Plus className="w-3.5 h-3.5" /> Nuevo Reporte
            </Button>
          </Link>
        </div>

        <div className="flex gap-2 flex-wrap">
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
            <option value="">Todos los tipos</option>
            <option value="103">Formulario 103</option>
            <option value="104">Formulario 104</option>
          </select>
          <input
            type="month"
            value={filterPeriodo}
            onChange={(e) => setFilterPeriodo(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
            placeholder="Período"
          />
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : reportes.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-5 h-5" />}
              title="No hay reportes generados."
              description="Crea uno nuevo para comenzar."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse text-[13px]">
                <TableHeader>
                  <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <TableHead className="py-3 px-4 font-semibold">Tipo</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Período</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Estado</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Generación</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Presentación</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {reportes.map((r) => (
                    <TableRow key={r.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <TableCell className="py-3 px-4 font-semibold text-brand-gray-800">Form. {r.tipo}</TableCell>
                      <TableCell className="py-3 px-4 text-xs font-mono text-brand-gray-600">{r.periodo}</TableCell>
                      <TableCell className="py-3 px-4">
                        <Badge variant="outline" className={`text-[10px] ${ESTADO_BADGE[r.estado] || ""}`}>
                          {ESTADO_LABEL[r.estado] || r.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-500">{formatFecha(r.fechaGeneracion)}</TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-500">{r.fechaPresentacion ? formatFecha(r.fechaPresentacion) : "—"}</TableCell>
                      <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                        <Link href={`/declaraciones/reportes/${r.id}`} className="inline-flex items-center gap-1 text-brand-red hover:text-brand-red-bright text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1">
                          <Eye className="w-3 h-3" /> Ver
                        </Link>
                        <button className="inline-flex items-center gap-1 text-brand-red hover:text-brand-red-bright text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1 cursor-pointer">
                          <Download className="w-3 h-3" /> XML
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="inline-flex items-center gap-1 text-red-500 hover:text-brand-red text-xs font-semibold border border-red-100 hover:bg-brand-red-subtle px-2 py-1 rounded-lg transition-colors cursor-pointer">
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
