"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Download, Eye, Trash2 } from "lucide-react";

interface Ats {
  id: string;
  periodo: string;
  estado: string;
  fechaGeneracion: string;
  fechaPresentacion?: string;
}

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR: "bg-slate-100 text-slate-600 border-slate-200",
  GENERADO: "bg-blue-50 text-blue-700 border-blue-200",
  PRESENTADO: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function AtsPage() {
  const [items, setItems] = useState<Ats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/declaraciones/ats");
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
      const res = await fetch(`/api/declaraciones/ats/${id}/xml`);
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
      const res = await fetch(`/api/declaraciones/ats?id=${id}`, { method: "DELETE" });
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
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Anexo Transaccional Simplificado</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Generación y gestión de ATS para el SRI</p>
          </div>
          <Link href="/declaraciones/ats/nuevo">
            <Button size="sm" className="bg-brand-navy hover:bg-brand-navy-light text-white">
              <Plus className="w-3.5 h-3.5" /> Nuevo ATS
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-brand-gray-500 animate-pulse">Cargando ATS...</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-brand-gray-400">No hay ATS generados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <th className="py-3 px-4 font-semibold">Período</th>
                    <th className="py-3 px-4 font-semibold">Estado</th>
                    <th className="py-3 px-4 font-semibold">Generación</th>
                    <th className="py-3 px-4 font-semibold">Presentación</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gray-50">
                  {items.map((a) => (
                    <tr key={a.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-sm font-semibold text-brand-gray-800">{a.periodo}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={`text-[10px] ${ESTADO_BADGE[a.estado] || ""}`}>
                          {a.estado}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-brand-gray-500">
                        {a.fechaGeneracion ? new Date(a.fechaGeneracion).toLocaleDateString("es-EC") : "—"}
                      </td>
                      <td className="py-3 px-4 text-xs text-brand-gray-500">
                        {a.fechaPresentacion ? new Date(a.fechaPresentacion).toLocaleDateString("es-EC") : "—"}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button onClick={() => handleDownloadXml(a.id)} className="inline-flex items-center gap-1 text-brand-navy hover:text-brand-navy-light text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1 cursor-pointer">
                          <Download className="w-3 h-3" /> XML
                        </button>
                        <button onClick={() => handleDelete(a.id)} className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-semibold border border-red-100 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors cursor-pointer">
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
