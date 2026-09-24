"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";
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
  USER: "bg-sky-50 text-brand-sky border-sky-200",
  ADMIN: "bg-amber-50 text-amber-700 border-amber-200",
  SUPERADMIN: "bg-purple-50 text-purple-700 border-brand-gray-200",
};

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rolFilter, setRolFilter] = useState("");
  const [roles, setRoles] = useState<{ codigo: string; nombre: string }[]>([]);
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
      const res = await apiFetch(`/api/admin/usuarios?${params}`);
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

  useEffect(() => {
    apiFetch("/api/admin/roles")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data) {
          setRoles(
            data.data.map((r: { codigo: string; nombre: string }) => ({
              codigo: r.codigo,
              nombre: r.nombre,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [search, rolFilter]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar al usuario "${name}"?`)) return;
    try {
      const res = await apiFetch(`/api/admin/usuarios/${id}`, { method: "DELETE" });
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
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Usuarios</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">{total} usuarios registrados</p>
          </div>
          <Link href="/admin/usuarios/nuevo">
            <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white">
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
            {(roles.length > 0
              ? roles
              : [
                  { codigo: "USER", nombre: "USER" },
                  { codigo: "ADMIN", nombre: "ADMIN" },
                  { codigo: "SUPERADMIN", nombre: "SUPERADMIN" },
                ]
            ).map((r) => (
              <option key={r.codigo} value={r.codigo}>
                {r.codigo}
              </option>
            ))}
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
            <TableSkeleton rows={6} columns={5} />
          ) : usuarios.length === 0 ? (
            <EmptyState title="No se encontraron usuarios." compact />
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse text-[13px]">
                <TableHeader>
                  <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <TableHead className="py-3 px-4 font-semibold">Email</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Nombre</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Rol</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Empresa</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Estado</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Creado</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {usuarios.map((u) => (
                    <TableRow key={u.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <TableCell className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{u.email}</TableCell>
                      <TableCell className="py-3 px-4 font-medium text-brand-gray-800">{u.nombre || "—"}</TableCell>
                      <TableCell className="py-3 px-4">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${ROL_COLOR[u.rol] || ROL_COLOR.USER}`}>
                          {ROL_LABEL[u.rol] || u.rol}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-500">{u.tenantNombre || "—"}</TableCell>
                      <TableCell className="py-3 px-4">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          u.activo
                            ? "bg-success-pale text-success border border-success-light/40"
                            : "bg-brand-red-subtle text-brand-red border border-brand-red-pale"
                        }`}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-400">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("es-EC") : "—"}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/usuarios/${u.id}`}
                          className="inline-flex items-center gap-1 text-brand-red hover:text-brand-red-bright text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1"
                        >
                          <Edit className="w-3 h-3" /> Editar
                        </Link>
                        <button
                          onClick={() => handleDelete(u.id, u.email)}
                          className="inline-flex items-center gap-1 text-red-500 hover:text-brand-red text-xs font-semibold border border-red-100 hover:bg-brand-red-subtle px-2 py-1 rounded-lg transition-colors cursor-pointer"
                        >
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
