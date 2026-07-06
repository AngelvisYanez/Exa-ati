"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, UserCheck, Users } from "lucide-react";

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
      const res = await fetch(`/api/contactos?${params}`);
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
      const res = await fetch(`/api/contactos?id=${id}`, { method: "DELETE" });
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
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Clientes</h1>
              <Link href="/contactos" className="text-xs text-brand-navy hover:text-brand-navy-light font-semibold underline">
                Ir a Contactos
              </Link>
            </div>
            <p className="text-xs text-brand-gray-500 mt-0.5">Gestión de clientes vinculados al módulo de contactos</p>
          </div>
          <Link href="/contactos/nuevo">
            <Button size="sm" className="bg-brand-navy hover:bg-brand-navy-light text-white">
              <Plus className="w-3.5 h-3.5" /> Nuevo Cliente
            </Button>
          </Link>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-8 h-8 text-xs" />
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-brand-gray-500 animate-pulse">Cargando clientes...</div>
          ) : contactos.length === 0 ? (
            <div className="p-10 text-center text-sm text-brand-gray-400">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 rounded-full bg-brand-gray-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-brand-gray-400" />
                </div>
              </div>
              No se encontraron clientes. Crea un contacto marcado como "Cliente" desde el módulo de contactos.
              <div className="mt-4">
                <Link href="/contactos/nuevo">
                  <Button size="sm" className="bg-brand-navy hover:bg-brand-navy-light text-white">
                    <Plus className="w-3.5 h-3.5" /> Crear Cliente
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <th className="py-3 px-4 font-semibold">Identificación</th>
                    <th className="py-3 px-4 font-semibold">Razón Social</th>
                    <th className="py-3 px-4 font-semibold">Email</th>
                    <th className="py-3 px-4 font-semibold">Teléfono</th>
                    <th className="py-3 px-4 font-semibold">Estado</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gray-50">
                  {contactos.map((c) => (
                    <tr key={c.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{c.identificacion}</td>
                      <td className="py-3 px-4 font-medium text-brand-gray-800">{c.razonSocial}</td>
                      <td className="py-3 px-4 text-xs text-brand-gray-500">{c.email || "—"}</td>
                      <td className="py-3 px-4 text-xs text-brand-gray-500">{c.telefono || "—"}</td>
                      <td className="py-3 px-4">
                        {c.activo ? (
                          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Activo</span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactivo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link href={`/contactos/${c.id}`} className="inline-flex items-center gap-1 text-brand-navy hover:text-brand-navy-light text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1">
                          <Edit className="w-3 h-3" /> Editar
                        </Link>
                        <button onClick={() => handleDelete(c.id, c.razonSocial)} className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-semibold border border-red-100 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors cursor-pointer">
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
