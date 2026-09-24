"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, UserCheck, Users } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";
interface Contacto {
  id: string;
  identificacion: string;
  razonSocial: string;
  tipoIdentificacion: string;
  email?: string;
  telefono?: string;
  esCliente: boolean;
  esProveedor: boolean;
  activo: boolean;
}

export default function ClientesPage() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ tipo: "cliente" });
      if (search.trim()) params.set("q", search.trim());
      const res = await apiFetch(`/api/contactos?${params}`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setContactos(data.contactos || data.data || []);
    } catch {
      toast.error("Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar al cliente "${nombre}"?`)) return;
    try {
      const res = await apiFetch(`/api/contactos?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success("Cliente eliminado");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <>
      <title>Clientes - OFSERCONT IA</title>
      <Topbar title="Clientes" />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Clientes</h1>
              <Link href="/contactos" className="text-xs text-brand-red hover:text-brand-red-bright font-semibold underline">
                Ir a Contactos
              </Link>
            </div>
            <p className="text-xs text-brand-gray-500 mt-0.5">Gestión de clientes vinculados al módulo de contactos</p>
          </div>
          <Link href="/contactos/nuevo">
            <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white">
              <Plus className="w-3.5 h-3.5" /> Nuevo Cliente
            </Button>
          </Link>
        </div>

        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-8 h-8 text-xs" />
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : contactos.length === 0 ? (
            <EmptyState
              icon={<Users className="w-5 h-5" />}
              title="No se encontraron clientes."
              description={'Crea un contacto marcado como "Cliente" desde el módulo de contactos.'}
              action={
                <Link href="/contactos/nuevo">
                  <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white">
                    <Plus className="w-3.5 h-3.5" /> Crear Cliente
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse text-[13px]">
                <TableHeader>
                  <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <TableHead className="py-3 px-4 font-semibold">Identificación</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Razón Social</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Email</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Teléfono</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Estado</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {contactos.map((c) => (
                    <TableRow key={c.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <TableCell className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{c.identificacion}</TableCell>
                      <TableCell className="py-3 px-4 font-medium text-brand-gray-800">{c.razonSocial}</TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-500">{c.email || "—"}</TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-500">{c.telefono || "—"}</TableCell>
                      <TableCell className="py-3 px-4">
                        {c.activo ? (
                          <span className="text-[10px] font-semibold bg-success-pale text-success px-2 py-0.5 rounded-full">Activo</span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-brand-gray-100 text-brand-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                        <Link href={`/contactos/${c.id}`} className="inline-flex items-center gap-1 text-brand-red hover:text-brand-red-bright text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1">
                          <Edit className="w-3 h-3" /> Editar
                        </Link>
                        <button onClick={() => handleDelete(c.id, c.razonSocial)} className="inline-flex items-center gap-1 text-red-500 hover:text-brand-red text-xs font-semibold border border-red-100 hover:bg-brand-red-subtle px-2 py-1 rounded-lg transition-colors cursor-pointer">
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
