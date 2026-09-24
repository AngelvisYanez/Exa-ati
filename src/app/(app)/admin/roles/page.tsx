"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Shield } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { ModuleGate } from "@/components/auth/ModuleGate";

interface Rol {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  esSistema: boolean;
  activo: boolean;
  modulosCount: number;
  usuariosCount: number;
  createdAt: string;
}

function AdminRolesContent() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/admin/roles");
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setRoles(data.data || []);
    } catch {
      toast.error("Error al cargar roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (codigo: string, nombre: string) => {
    if (!confirm(`¿Eliminar el rol "${nombre}"?`)) return;
    try {
      const res = await apiFetch(`/api/admin/roles/${encodeURIComponent(codigo)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error");
      }
      toast.success("Rol eliminado");
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  return (
    <>
      <title>Roles - Admin - OFSERCONT IA</title>
      <Topbar title="Roles" backLink={{ href: "/admin", label: "Admin" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Roles y módulos</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">
              Define roles y qué módulos puede usar cada uno
            </p>
          </div>
          <Link href="/admin/roles/nuevo">
            <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white">
              <Plus className="w-3.5 h-3.5" /> Nuevo Rol
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : roles.length === 0 ? (
            <EmptyState
              icon={<Shield className="w-5 h-5" />}
              title="No hay roles configurados."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse text-[13px]">
                <TableHeader>
                  <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <TableHead className="py-3 px-4 font-semibold">Código</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Nombre</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Tipo</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Módulos</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Usuarios</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Estado</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {roles.map((r) => (
                    <TableRow key={r.codigo} className="hover:bg-brand-gray-50/40 transition-colors">
                      <TableCell className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">
                        {r.codigo}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="font-medium text-brand-gray-800">{r.nombre}</div>
                        {r.descripcion ? (
                          <div className="text-[11px] text-brand-gray-400 mt-0.5 line-clamp-1">
                            {r.descripcion}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            r.esSistema
                              ? "bg-violet-50 text-violet-700 border-violet-200"
                              : "bg-sky-50 text-brand-sky border-sky-200"
                          }`}
                        >
                          {r.esSistema ? "Sistema" : "Custom"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-600">
                        {r.modulosCount}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-600">
                        {r.usuariosCount}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            r.activo
                              ? "bg-success-pale text-success border border-success-light/40"
                              : "bg-brand-red-subtle text-brand-red border border-brand-red-pale"
                          }`}
                        >
                          {r.activo ? "Activo" : "Inactivo"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/roles/${encodeURIComponent(r.codigo)}`}
                          className="inline-flex items-center gap-1 text-brand-red hover:text-brand-red-bright text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1"
                        >
                          <Edit className="w-3 h-3" /> Editar
                        </Link>
                        {!r.esSistema && (
                          <button
                            onClick={() => handleDelete(r.codigo, r.nombre)}
                            className="inline-flex items-center gap-1 text-red-500 hover:text-brand-red text-xs font-semibold border border-red-100 hover:bg-brand-red-subtle px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Eliminar
                          </button>
                        )}
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

export default function AdminRolesPage() {
  return (
    <ModuleGate module="admin.roles">
      <AdminRolesContent />
    </ModuleGate>
  );
}
