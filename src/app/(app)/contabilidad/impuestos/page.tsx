"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";

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
  IVA: "bg-blue-50 text-blue-700 border-blue-200",
  ICE: "bg-amber-50 text-amber-700 border-amber-200",
  RENTA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IVA_RET: "bg-purple-50 text-purple-700 border-purple-200",
  IRBPNR: "bg-red-50 text-red-700 border-red-200",
};

export default function ImpuestosPage() {
  const [impuestos, setImpuestos] = useState<Impuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = filterTipo ? `?tipo=${filterTipo}` : "";
      const res = await fetch(`/api/contabilidad/impuestos${params}`);
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
      const res = await fetch(`/api/contabilidad/impuestos?id=${id}`, { method: "DELETE" });
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
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
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
              <Button size="sm" className="bg-brand-navy hover:bg-brand-navy-light text-white">
                <Plus className="w-3.5 h-3.5" /> Nuevo Impuesto
              </Button>
            </Link>
          </div>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-brand-gray-500 animate-pulse">Cargando impuestos...</div>
          ) : impuestos.length === 0 ? (
            <div className="p-10 text-center text-sm text-brand-gray-400">No hay impuestos registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <th className="py-3 px-4 font-semibold">Código</th>
                    <th className="py-3 px-4 font-semibold">Nombre</th>
                    <th className="py-3 px-4 font-semibold">%</th>
                    <th className="py-3 px-4 font-semibold">Tarifa</th>
                    <th className="py-3 px-4 font-semibold">Tipo</th>
                    <th className="py-3 px-4 font-semibold">Estado</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gray-50">
                  {impuestos.map((imp) => (
                    <tr key={imp.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{imp.codigo}</td>
                      <td className="py-3 px-4 text-sm font-medium text-brand-gray-800">{imp.nombre}</td>
                      <td className="py-3 px-4 text-sm font-semibold">{imp.porcentaje}%</td>
                      <td className="py-3 px-4 text-xs text-brand-gray-600">{imp.tarifa}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={`text-[10px] ${TIPO_BADGE[imp.tipo] || ""}`}>
                          {imp.tipo}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {imp.activo ? (
                          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Activo</span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactivo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/contabilidad/impuestos/${imp.id}`}
                          className="inline-flex items-center gap-1 text-brand-navy hover:text-brand-navy-light text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1"
                        >
                          <Edit className="w-3 h-3" /> Editar
                        </Link>
                        <button
                          onClick={() => handleDelete(imp.id, imp.nombre)}
                          className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-semibold border border-red-100 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                        >
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
