"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  tenantId: string | null;
  tenantNombre: string | null;
  ruc: string | null;
  activo: boolean;
  createdAt: string;
}

const ROL_LABEL: Record<string, string> = {
  USER: "USER",
  ADMIN: "ADMIN",
  SUPERADMIN: "SUPER",
};

const ROL_COLOR: Record<string, string> = {
  USER: "bg-blue-50 text-blue-700 border-blue-200",
  ADMIN: "bg-amber-50 text-amber-700 border-amber-200",
  SUPERADMIN: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rolFilter, setRolFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (rolFilter) params.set("rol", rolFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`/api/admin/usuarios?${params}`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setUsuarios(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, [search, rolFilter, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(1); }, [search, rolFilter]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar al usuario "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error");
      }
      toast.success("Usuario eliminado");
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  return (
    <>
      <title>Usuarios - Admin - OFSERCONT IA</title>
      <Topbar title="Usuarios" backLink={{ href: "/admin", label: "Admin" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Usuarios</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">{total} usuarios registrados</p>
          </div>
          <Link href="/admin/usuarios/nuevo">
            <Button size="sm" className="bg-brand-navy hover:bg-brand-navy-light text-white">
              <Plus className="w-3.5 h-3.5" /> Nuevo Usuario
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <select
            value={rolFilter}
            onChange={(e) => setRolFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          >
            <option value="">Todos los roles</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPERADMIN">SUPERADMIN</option>
          </select>
          <div className="relative flex-1 sm:max-w-sm w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por email o nombre..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-brand-gray-500 animate-pulse">Cargando usuarios...</div>
          ) : usuarios.length === 0 ? (
            <div className="p-10 text-center text-sm text-brand-gray-400">No se encontraron usuarios.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <th className="py-3 px-4 font-semibold">Email</th>
                    <th className="py-3 px-4 font-semibold">Nombre</th>
                    <th className="py-3 px-4 font-semibold">Rol</th>
                    <th className="py-3 px-4 font-semibold">Empresa</th>
                    <th className="py-3 px-4 font-semibold">Estado</th>
                    <th className="py-3 px-4 font-semibold">Creado</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gray-50">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{u.email}</td>
                      <td className="py-3 px-4 font-medium text-brand-gray-800">{u.nombre || "—"}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${ROL_COLOR[u.rol] || ROL_COLOR.USER}`}>
                          {ROL_LABEL[u.rol] || u.rol}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-brand-gray-500">{u.tenantNombre || "—"}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          u.activo
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-brand-gray-400">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("es-EC") : "—"}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/usuarios/${u.id}`}
                          className="inline-flex items-center gap-1 text-brand-navy hover:text-brand-navy-light text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1"
                        >
                          <Edit className="w-3 h-3" /> Editar
                        </Link>
                        <button
                          onClick={() => handleDelete(u.id, u.email)}
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
