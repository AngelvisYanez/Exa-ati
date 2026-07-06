"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search } from "lucide-react";

interface Transportista {
  id: string;
  ruc: string;
  razonSocial: string;
  placa: string;
  telefono?: string;
  activo: boolean;
}

export default function TransportistasPage() {
  const [items, setItems] = useState<Transportista[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = search.trim() ? `?q=${search.trim()}` : "";
      const res = await fetch(`/api/transportistas${params}`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setItems(data.transportistas || data.data || []);
    } catch {
      toast.error("Error al cargar transportistas");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar a "${nombre}"?`)) return;
    try {
      const res = await fetch(`/api/transportistas?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success("Transportista eliminado");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <>
      <title>Transportistas - OFSERCONT IA</title>
      <Topbar title="Transportistas" />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Transportistas</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Registro de transportistas para guías de remisión</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 h-8 text-xs" />
            </div>
            <Button size="sm" className="bg-brand-navy hover:bg-brand-navy-light text-white">
              <Plus className="w-3.5 h-3.5" /> Nuevo
            </Button>
          </div>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-brand-gray-500 animate-pulse">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-brand-gray-400">No hay transportistas registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <th className="py-3 px-4 font-semibold">RUC</th>
                    <th className="py-3 px-4 font-semibold">Razón Social</th>
                    <th className="py-3 px-4 font-semibold">Placa</th>
                    <th className="py-3 px-4 font-semibold">Teléfono</th>
                    <th className="py-3 px-4 font-semibold">Estado</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gray-50">
                  {items.map((t) => (
                    <tr key={t.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{t.ruc}</td>
                      <td className="py-3 px-4 font-medium text-brand-gray-800">{t.razonSocial}</td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{t.placa}</td>
                      <td className="py-3 px-4 text-xs text-brand-gray-500">{t.telefono || "—"}</td>
                      <td className="py-3 px-4">
                        {t.activo ? (
                          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Activo</span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactivo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button className="inline-flex items-center gap-1 text-brand-navy hover:text-brand-navy-light text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1 cursor-pointer">
                          <Edit className="w-3 h-3" /> Editar
                        </button>
                        <button onClick={() => handleDelete(t.id, t.razonSocial)} className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-semibold border border-red-100 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors cursor-pointer">
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
