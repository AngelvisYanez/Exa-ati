"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Eye, Trash2, Download } from "lucide-react";

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
  AUTORIZADO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDIENTE: "bg-amber-50 text-amber-700 border-amber-200",
  RECHAZADO: "bg-red-50 text-red-700 border-red-200",
  EN_PROCESO: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function GuiasRemisionPage() {
  const [items, setItems] = useState<GuiaRemision[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sri/guia-remision");
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
      const res = await fetch(`/api/sri/comprobantes/${claveAcceso}/pdf`);
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
      const res = await fetch(`/api/sri/guia-remision/${id}`, { method: "DELETE" });
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
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Guías de Remisión</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Documentos de transporte de mercadería</p>
          </div>
          <Link href="/guias-remision/nueva">
            <Button size="sm" className="bg-brand-navy hover:bg-brand-navy-light text-white">
              <Plus className="w-3.5 h-3.5" /> Nueva Guía
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-brand-gray-500 animate-pulse">Cargando guías...</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-brand-gray-400">No hay guías de remisión registradas.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <th className="py-3 px-4 font-semibold">Secuencial</th>
                    <th className="py-3 px-4 font-semibold">Transportista</th>
                    <th className="py-3 px-4 font-semibold">Placa</th>
                    <th className="py-3 px-4 font-semibold">Fecha</th>
                    <th className="py-3 px-4 font-semibold">Estado</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gray-50">
                  {items.map((g) => (
                    <tr key={g.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{formatSecuencial(g)}</td>
                      <td className="py-3 px-4 font-medium text-brand-gray-800">{g.razonSocialTransportista}</td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{g.placa}</td>
                      <td className="py-3 px-4 text-xs text-brand-gray-500">
                        {g.fechaEmision ? new Date(g.fechaEmision).toLocaleDateString("es-EC") : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={`text-[10px] ${ESTADO_BADGE[g.estado] || ""}`}>{g.estado}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link href={`/guias-remision/${g.id}`} className="inline-flex items-center gap-1 text-brand-navy hover:text-brand-navy-light text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1">
                          <Eye className="w-3 h-3" /> Ver
                        </Link>
                        {g.claveAcceso && (
                          <button onClick={() => handleDownloadRide(g.claveAcceso!)} className="inline-flex items-center gap-1 text-brand-navy hover:text-brand-navy-light text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1 cursor-pointer">
                            <Download className="w-3 h-3" /> RIDE
                          </button>
                        )}
                        <button onClick={() => handleDelete(g.id)} className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-semibold border border-red-100 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors cursor-pointer">
                          <Trash2 className="w-3 h-3" /> Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
