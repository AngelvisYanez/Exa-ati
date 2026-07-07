"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, UserCheck } from "lucide-react";

interface Contacto {
  id: string;
  identificacion: string;
  razonSocial: string;
  nombreComercial?: string;
  tipoIdentificacion: string;
  tipo: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  esCliente: boolean;
  esProveedor: boolean;
  activo: boolean;
}

const TIPO_ID_LABEL: Record<string, string> = {
  "04": "RUC",
  "05": "Cédula",
  "06": "Pasaporte",
  "07": "Cons. Final",
};

export default function ContactosPage() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"todos" | "clientes" | "proveedores">("todos");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (tab === "clientes") params.set("tipo", "cliente");
      if (tab === "proveedores") params.set("tipo", "proveedor");
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/contactos?${params}`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setContactos(data.contactos || data.data || []);
    } catch {
      toast.error("Error al cargar contactos");
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar a "${nombre}"?`)) return;
    try {
      const res = await fetch(`/api/contactos?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success("Contacto eliminado");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const handleValidarSri = async (identificacion: string) => {
    toast.info(`Validando ${identificacion} en el SRI...`);
    try {
      const res = await fetch(`/api/sri/validar?identificacion=${identificacion}`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      if (data.valido) {
        toast.success(`Contribuyente válido: ${data.razonSocial || identificacion}`);
      } else {
        toast.warning(`La identificación ${identificacion} no es válida según el SRI`);
      }
    } catch {
      toast.error("Error al validar en SRI");
    }
  };

  const tabs = [
    { key: "todos" as const, label: "Todos" },
    { key: "clientes" as const, label: "Clientes" },
    { key: "proveedores" as const, label: "Proveedores" },
  ];

  return (
    <>
      <title>Contactos - OFSERCONT IA</title>
      <Topbar title="Contactos" />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Contactos</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Clientes, proveedores y terceros registrados</p>
          </div>
          <Link href="/contactos/nuevo">
            <Button size="sm" className="bg-brand-navy hover:bg-brand-navy-light text-white">
              <Plus className="w-3.5 h-3.5" /> Nuevo Contacto
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex gap-1 bg-brand-gray-100 p-1 rounded-lg">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  tab === t.key ? "bg-white text-brand-navy shadow-sm" : "text-brand-gray-500 hover:text-brand-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-sm w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o identificación..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-brand-gray-500 animate-pulse">Cargando contactos...</div>
          ) : contactos.length === 0 ? (
            <div className="p-10 text-center text-sm text-brand-gray-400">No se encontraron contactos.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <th className="py-3 px-4 font-semibold">Identificación</th>
                    <th className="py-3 px-4 font-semibold">Razón Social</th>
                    <th className="py-3 px-4 font-semibold">Tipo ID</th>
                    <th className="py-3 px-4 font-semibold">Tipo</th>
                    <th className="py-3 px-4 font-semibold">Email</th>
                    <th className="py-3 px-4 font-semibold">Teléfono</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gray-50">
                  {contactos.map((c) => (
                    <tr key={c.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{c.identificacion}</td>
                      <td className="py-3 px-4 font-medium text-brand-gray-800">{c.razonSocial}</td>
                      <td className="py-3 px-4 text-xs text-brand-gray-500">{TIPO_ID_LABEL[c.tipoIdentificacion] || c.tipoIdentificacion}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {c.esCliente && <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Cliente</Badge>}
                          {c.esProveedor && <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">Proveedor</Badge>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-brand-gray-500">{c.email || "—"}</td>
                      <td className="py-3 px-4 text-xs text-brand-gray-500">{c.telefono || "—"}</td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleValidarSri(c.identificacion)}
                          className="inline-flex items-center gap-1 text-brand-navy hover:text-brand-navy-light text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1 cursor-pointer"
                          title="Validar en SRI"
                        >
                          <UserCheck className="w-3 h-3" /> SRI
                        </button>
                        <Link
                          href={`/contactos/${c.id}`}
                          className="inline-flex items-center gap-1 text-brand-navy hover:text-brand-navy-light text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1"
                        >
                          <Edit className="w-3 h-3" /> Editar
                        </Link>
                        <button
                          onClick={() => handleDelete(c.id, c.razonSocial)}
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
