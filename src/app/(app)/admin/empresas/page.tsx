"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";

interface Tenant {
  id: string;
  nombre: string;
  ruc: string | null;
  activo: boolean;
  usuariosCount: number;
  emisoresCount: number;
  createdAt: string;
}

export default function AdminEmpresasPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`/api/admin/tenants?${params}`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setTenants(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error("Error al cargar empresas");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la empresa "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error");
      }
      toast.success("Empresa eliminada");
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  return (
    <>
      <title>Empresas - Admin - OFSERCONT IA</title>
      <Topbar title="Empresas" backLink={{ href: "/admin", label: "Admin" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Empresas</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">{total} empresas registradas</p>
          </div>
          <Link href="/admin/empresas/nuevo">
            <Button size="sm" className="bg-brand-navy hover:bg-brand-navy-light text-white">
              <Plus className="w-3.5 h-3.5" /> Nueva Empresa
            </Button>
          </Link>
        </div>

        <div className="relative flex-1 sm:max-w-sm w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o RUC..."
            className="pl-8 h-8 text-xs"
          />
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-brand-gray-500 animate-pulse">Cargando empresas...</div>
          ) : tenants.length === 0 ? (
            <div className="p-10 text-center text-sm text-brand-gray-400">No se encontraron empresas.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <th className="py-3 px-4 font-semibold">Nombre</th>
                    <th className="py-3 px-4 font-semibold">RUC</th>
                    <th className="py-3 px-4 font-semibold">Estado</th>
                    <th className="py-3 px-4 font-semibold">Usuarios</th>
                    <th className="py-3 px-4 font-semibold">Emisores</th>
                    <th className="py-3 px-4 font-semibold">Creado</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gray-50">
                  {tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-brand-gray-800">{t.nombre}</td>
                      <td className="py-3 px-4 font-mono text-xs text-brand-gray-600">{t.ruc || "—"}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          t.activo
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}>
                          {t.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-brand-gray-500">{t.usuariosCount}</td>
                      <td className="py-3 px-4 text-xs text-brand-gray-500">{t.emisoresCount}</td>
                      <td className="py-3 px-4 text-xs text-brand-gray-400">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString("es-EC") : "—"}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/empresas/${t.id}`}
                          className="inline-flex items-center gap-1 text-brand-navy hover:text-brand-navy-light text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1"
                        >
                          <Edit className="w-3 h-3" /> Editar
                        </Link>
                        <button
                          onClick={() => handleDelete(t.id, t.nombre)}
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-brand-gray-500">
            <span>Página {page} de {totalPages} ({total} resultados)</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-gray-200 hover:bg-brand-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-3 h-3" /> Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-gray-200 hover:bg-brand-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Siguiente <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
