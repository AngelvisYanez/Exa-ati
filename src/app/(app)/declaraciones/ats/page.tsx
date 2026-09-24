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
import { Plus, Download, Eye, Trash2, FileSpreadsheet } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";
interface Ats {
  id: string;
  periodo: string;
  estado: string;
  fechaGeneracion: string;
  fechaPresentacion?: string;
}

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR: "bg-brand-gray-100 text-brand-gray-600 border-brand-gray-200",
  GENERADO: "bg-sky-50 text-brand-sky border-sky-200",
  PRESENTADO: "bg-success-pale text-success border-success-light/40",
};

export default function AtsPage() {
  const [items, setItems] = useState<Ats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/declaraciones/ats");
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setItems(data.ats || data.data || []);
    } catch {
      toast.error("Error al cargar ATS");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDownloadXml = async (id: string) => {
    try {
      const res = await apiFetch(`/api/declaraciones/ats/${id}/xml`);
      if (!res.ok) throw new Error("Error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ats_${id}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Error al descargar XML");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este ATS?")) return;
    try {
      const res = await apiFetch(`/api/declaraciones/ats?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success("ATS eliminado");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <>
      <title>ATS - OFSERCONT IA</title>
      <Topbar title="ATS" backLink={{ href: "/declaraciones", label: "Declaraciones" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Anexo Transaccional Simplificado</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Generación y gestión de ATS para el SRI</p>
          </div>
          <Link href="/declaraciones/ats/nuevo">
            <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white">
              <Plus className="w-3.5 h-3.5" /> Nuevo ATS
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<FileSpreadsheet className="w-5 h-5" />}
              title="No hay ATS generados."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse text-[13px]">
                <TableHeader>
                  <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <TableHead className="py-3 px-4 font-semibold">Período</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Estado</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Generación</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Presentación</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {items.map((a) => (
                    <TableRow key={a.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <TableCell className="py-3 px-4 font-mono text-sm font-semibold text-brand-gray-800">{a.periodo}</TableCell>
                      <TableCell className="py-3 px-4">
                        <Badge variant="outline" className={`text-[10px] ${ESTADO_BADGE[a.estado] || ""}`}>
                          {a.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-500">
                        {a.fechaGeneracion ? new Date(a.fechaGeneracion).toLocaleDateString("es-EC") : "—"}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-500">
                        {a.fechaPresentacion ? new Date(a.fechaPresentacion).toLocaleDateString("es-EC") : "—"}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                        <button onClick={() => handleDownloadXml(a.id)} className="inline-flex items-center gap-1 text-brand-red hover:text-brand-red-bright text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1 cursor-pointer">
                          <Download className="w-3 h-3" /> XML
                        </button>
                        <button onClick={() => handleDelete(a.id)} className="inline-flex items-center gap-1 text-red-500 hover:text-brand-red text-xs font-semibold border border-red-100 hover:bg-brand-red-subtle px-2 py-1 rounded-lg transition-colors cursor-pointer">
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
