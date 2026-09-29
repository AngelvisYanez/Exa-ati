"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Plus, Edit, Trash2, CreditCard } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { ModuleGate } from "@/components/auth/ModuleGate";

interface PlanRow {
  codigo: string;
  nombre: string;
  descripcion: string;
  maxEmpresas: number;
  precioMensual: number;
  precioAnual: number | null;
  moneda: string;
  orden: number;
  activo: boolean;
  esSistema: boolean;
  modulosCount: number;
  tenantsCount: number;
}

function formatMoney(amount: number, moneda: string) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: moneda || "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function AdminPlanesContent() {
  const [planes, setPlanes] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/admin/planes");
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setPlanes(data.data || []);
    } catch {
      toast.error("Error al cargar planes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (codigo: string, nombre: string) => {
    if (!confirm(`¿Eliminar el plan "${nombre}"?`)) return;
    try {
      const res = await apiFetch(`/api/admin/planes/${encodeURIComponent(codigo)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error");
      }
      toast.success("Plan eliminado");
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  return (
    <>
      <title>Planes - Admin - OFSERCONT IA</title>
      <Topbar title="Planes" backLink={{ href: "/administracion", label: "Admin" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">
              Planes de suscripción
            </h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">
              Precio, cupo de empresas y módulos visibles por plan. El acceso real es rol ∩ plan.
            </p>
          </div>
          <Link href="/administracion/planes/nuevo">
            <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white">
              <Plus className="w-3.5 h-3.5" /> Nuevo plan
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <TableSkeleton rows={4} columns={7} />
          ) : planes.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="w-5 h-5" />}
              title="No hay planes. Aplica la migración 007 o crea uno."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse text-[13px]">
                <TableHeader>
                  <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <TableHead className="py-3 px-4 font-semibold">Plan</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Precio / mes</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Empresas</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Módulos</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Tenants</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Estado</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {planes.map((p) => (
                    <TableRow key={p.codigo} className="hover:bg-brand-gray-50/40 transition-colors">
                      <TableCell className="py-3 px-4">
                        <div className="font-medium text-brand-gray-800">{p.nombre}</div>
                        <div className="text-[11px] font-mono text-brand-gray-400 mt-0.5">
                          {p.codigo}
                          {p.esSistema ? " · sistema" : ""}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4 font-semibold text-brand-gray-800">
                        {formatMoney(p.precioMensual, p.moneda)}
                        {p.precioAnual != null ? (
                          <div className="text-[10px] font-normal text-brand-gray-400">
                            {formatMoney(p.precioAnual, p.moneda)} / año
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-3 px-4">{p.maxEmpresas}</TableCell>
                      <TableCell className="py-3 px-4">{p.modulosCount}</TableCell>
                      <TableCell className="py-3 px-4">{p.tenantsCount}</TableCell>
                      <TableCell className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            p.activo
                              ? "bg-success-pale text-success"
                              : "bg-brand-gray-100 text-brand-gray-500"
                          }`}
                        >
                          {p.activo ? "Activo" : "Inactivo"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/administracion/planes/${encodeURIComponent(p.codigo)}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          {!p.esSistema ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-brand-red hover:text-brand-red"
                              onClick={() => handleDelete(p.codigo, p.nombre)}
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

export default function AdminPlanesPage() {
  return (
    <ModuleGate module="admin.planes">
      <AdminPlanesContent />
    </ModuleGate>
  );
}
