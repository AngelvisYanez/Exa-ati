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
import { Plus, Eye, Trash2, Download, Truck } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";
interface GuiaRemision {
  id: string;
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  fechaEmision: string;
  razonSocialTransportista: string;
  placa: string;
  estado: string;
  numeroAutorizacion?: string;
  claveAcceso?: string;
}

const ESTADO_BADGE: Record<string, string> = {
  AUTORIZADO: "bg-success-pale text-success border-success-light/40",
  PENDIENTE: "bg-amber-50 text-amber-700 border-amber-200",
  RECHAZADO: "bg-brand-red-subtle text-brand-red border-brand-red-pale",
  EN_PROCESO: "bg-sky-50 text-brand-sky border-sky-200",
};

export default function GuiasRemisionPage() {
  const [items, setItems] = useState<GuiaRemision[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/sri/guia-remision");
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setItems(data.guias || data.data || []);
    } catch {
      toast.error("Error al cargar guías de remisión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDownloadRide = async (claveAcceso: string) => {
    try {
      const res = await apiFetch(`/api/sri/comprobantes/${claveAcceso}/pdf`);
      if (!res.ok) throw new Error("Error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `guia_${claveAcceso}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Error al descargar RIDE");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta guía de remisión?")) return;
    try {
      const res = await apiFetch(`/api/sri/guia-remision/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success("Guía eliminada");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const formatSecuencial = (g: GuiaRemision) => {
    return `${g.establecimiento}-${g.puntoEmision}-${g.secuencial}`;
  };

  return (
    <>
      <title>Guías de Remisión - OFSERCONT IA</title>
      <Topbar title="Guías de Remisión" />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Guías de Remisión</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Documentos de transporte de mercadería</p>
          </div>
          <Link href="/guias-remision/nueva">
            <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white">
              <Plus className="w-3.5 h-3.5" /> Nueva Guía
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Truck className="w-5 h-5" />}
              title="No hay guías de remisión registradas."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse text-[13px]">
                <TableHeader>
                  <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <TableHead className="py-3 px-4 font-semibold">Secuencial</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Transportista</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Placa</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Fecha</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Estado</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {items.map((g) => (
                    <TableRow key={g.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <TableCell className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{formatSecuencial(g)}</TableCell>
                      <TableCell className="py-3 px-4 font-medium text-brand-gray-800">{g.razonSocialTransportista}</TableCell>
                      <TableCell className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{g.placa}</TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-500">
                        {g.fechaEmision ? new Date(g.fechaEmision).toLocaleDateString("es-EC") : "—"}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <Badge variant="outline" className={`text-[10px] ${ESTADO_BADGE[g.estado] || ""}`}>{g.estado}</Badge>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                        <Link href={`/guias-remision/${g.id}`} className="inline-flex items-center gap-1 text-brand-red hover:text-brand-red-bright text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1">
                          <Eye className="w-3 h-3" /> Ver
                        </Link>
                        {g.claveAcceso && (
                          <button onClick={() => handleDownloadRide(g.claveAcceso!)} className="inline-flex items-center gap-1 text-brand-red hover:text-brand-red-bright text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1 cursor-pointer">
                            <Download className="w-3 h-3" /> RIDE
                          </button>
                        )}
                        <button onClick={() => handleDelete(g.id)} className="inline-flex items-center gap-1 text-red-500 hover:text-brand-red text-xs font-semibold border border-red-100 hover:bg-brand-red-subtle px-2 py-1 rounded-lg transition-colors cursor-pointer">
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
