"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, ChevronDown, ChevronRight } from "lucide-react";

interface PosicionFiscal {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  impuestos: { id: string; codigo: string; nombre: string; tipo: string; porcentaje: number }[];
}

export default function PosicionesFiscalesPage() {
  const [items, setItems] = useState<PosicionFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/contabilidad/posiciones-fiscales");
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setItems(data.posiciones || data.data || []);
    } catch {
      toast.error("Error al cargar posiciones fiscales");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    try {
      const res = await fetch(`/api/contabilidad/posiciones-fiscales?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success("Posición fiscal eliminada");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <>
      <title>Posiciones Fiscales - OFSERCONT IA</title>
      <Topbar title="Posiciones Fiscales" backLink={{ href: "/contabilidad", label: "Contabilidad" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Posiciones Fiscales</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Configuración de impuestos por tipo de comprobante</p>
          </div>
          <Button size="sm" className="bg-brand-navy hover:bg-brand-navy-light text-white">
            <Plus className="w-3.5 h-3.5" /> Nueva Posición
          </Button>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-brand-gray-500 animate-pulse">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-brand-gray-400">No hay posiciones fiscales configuradas.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <th className="py-3 px-4 font-semibold w-8"></th>
                    <th className="py-3 px-4 font-semibold">Código</th>
                    <th className="py-3 px-4 font-semibold">Nombre</th>
                    <th className="py-3 px-4 font-semibold">Impuestos</th>
                    <th className="py-3 px-4 font-semibold">Estado</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gray-50">
                  {items.map((p) => {
                    const isExpanded = expanded.has(p.id);
                    return (
                      <>
                        <tr key={p.id} className="hover:bg-brand-gray-50/40 transition-colors">
                          <td className="py-3 px-4">
                            {p.impuestos.length > 0 && (
                              <button onClick={() => toggleExpand(p.id)} className="cursor-pointer text-brand-gray-400 hover:text-brand-gray-600">
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{p.codigo}</td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-brand-gray-800">{p.nombre}</span>
                            {p.descripcion && <p className="text-[11px] text-brand-gray-400 mt-0.5">{p.descripcion}</p>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {p.impuestos.slice(0, 3).map((imp) => (
                                <Badge key={imp.id} variant="outline" className="text-[9px] bg-slate-50">
                                  {imp.tipo} {imp.porcentaje}%
                                </Badge>
                              ))}
                              {p.impuestos.length > 3 && (
                                <Badge variant="outline" className="text-[9px]">+{p.impuestos.length - 3}</Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {p.activo ? (
                              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Activo</span>
                            ) : (
                              <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactivo</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button className="inline-flex items-center gap-1 text-brand-navy hover:text-brand-navy-light text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1 cursor-pointer">
                              <Edit className="w-3 h-3" /> Editar
                            </button>
                            <button onClick={() => handleDelete(p.id, p.nombre)} className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-semibold border border-red-100 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors cursor-pointer">
                              <Trash2 className="w-3 h-3" /> Eliminar
                            </button>
                          </td>
                        </tr>
                        {isExpanded && p.impuestos.length > 0 && (
                          <tr key={`${p.id}-details`}>
                            <td colSpan={6} className="bg-brand-gray-50/50 px-4 py-3">
                              <div className="ml-8">
                                <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider mb-2">Impuestos asignados</p>
                                <div className="flex flex-wrap gap-2">
                                  {p.impuestos.map((imp) => (
                                    <Badge key={imp.id} variant="outline" className="text-[11px] bg-white border-brand-gray-200">
                                      {imp.codigo} - {imp.nombre} ({imp.tipo} {imp.porcentaje}%)
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
