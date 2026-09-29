"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { ModuleGate } from "@/components/auth/ModuleGate";

interface MetodoRow {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  esSistema: boolean;
  usoOperativo: boolean;
  usoSuscripcion: boolean;
}

function AdminMetodosContent() {
  const [rows, setRows] = useState<MetodoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/admin/metodos-pago");
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setRows(data.data || []);
    } catch {
      toast.error("Error al cargar métodos de pago");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (codigo: string, nombre: string) => {
    if (!confirm(`¿Eliminar el método "${nombre}"?`)) return;
    try {
      const res = await apiFetch(`/api/admin/metodos-pago/${encodeURIComponent(codigo)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error");
      }
      toast.success("Método eliminado");
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  return (
    <>
      <title>Métodos de pago - Admin - OFSERCONT IA</title>
      <Topbar title="Métodos de pago" backLink={{ href: "/administracion", label: "Admin" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">
              Métodos de pago
            </h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">
              Catálogo para CxC/CxP (operativo) y canales de cobro de suscripción.
            </p>
          </div>
          <Link href="/administracion/metodos-pago/nuevo">
            <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white">
              <Plus className="w-3.5 h-3.5" /> Nuevo método
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <TableSkeleton rows={6} columns={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-5 h-5" />}
              title="No hay métodos. Aplica la migración 012 o crea uno."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse text-[13px]">
                <TableHeader>
                  <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <TableHead className="py-3 px-4 font-semibold">Método</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Uso</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Orden</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Estado</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {rows.map((m) => (
                    <TableRow key={m.codigo} className="hover:bg-brand-gray-50/40 transition-colors">
                      <TableCell className="py-3 px-4">
                        <div className="font-medium text-brand-gray-800">{m.nombre}</div>
                        <div className="text-[11px] font-mono text-brand-gray-400 mt-0.5">
                          {m.codigo}
                          {m.esSistema ? " · sistema" : ""}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {m.usoOperativo ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-gray-100 text-brand-gray-600">
                              CxC/CxP
                            </span>
                          ) : null}
                          {m.usoSuscripcion ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-red/10 text-brand-red">
                              Suscripción
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4">{m.orden}</TableCell>
                      <TableCell className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            m.activo
                              ? "bg-success-pale text-success"
                              : "bg-brand-gray-100 text-brand-gray-500"
                          }`}
                        >
                          {m.activo ? "Activo" : "Inactivo"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/administracion/metodos-pago/${encodeURIComponent(m.codigo)}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          {!m.esSistema ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-brand-red hover:text-brand-red"
                              onClick={() => handleDelete(m.codigo, m.nombre)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          ) : null}
                        </div>
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

export default function AdminMetodosPagoPage() {
  return (
    <ModuleGate module="admin.metodos-pago">
      <AdminMetodosContent />
    </ModuleGate>
  );
}
