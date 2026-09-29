"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";

interface PlanOption {
  codigo: string;
  nombre: string;
  maxEmpresas: number;
  precioMensual: number;
  moneda: string;
  activo: boolean;
}

export default function EditarEmpresaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nombre, setNombre] = useState("");
  const [ruc, setRuc] = useState("");
  const [activo, setActivo] = useState(true);
  const [planCodigo, setPlanCodigo] = useState("emprendedor");
  const [planes, setPlanes] = useState<PlanOption[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [tenantRes, planesRes] = await Promise.all([
          apiFetch(`/api/admin/tenants/${id}`),
          apiFetch("/api/admin/planes"),
        ]);
        if (!tenantRes.ok) throw new Error("No encontrado");
        const data = await tenantRes.json();
        const t = data.data;
        setNombre(t.nombre || "");
        setRuc(t.ruc || "");
        setActivo(t.activo ?? true);
        setPlanCodigo(t.planCodigo || "emprendedor");

        if (planesRes.ok) {
          const pData = await planesRes.json();
          setPlanes(
            (pData.data || []).filter((p: PlanOption) => p.activo || p.codigo === t.planCodigo)
          );
        }
      } catch {
        toast.error("Error al cargar empresa");
        router.push("/administracion/empresas");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.warning("El nombre es obligatorio");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/admin/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          ruc: ruc.trim() || null,
          activo,
          planCodigo,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al actualizar");
      }
      toast.success("Empresa actualizada");
      router.push("/administracion/empresas");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar esta empresa?")) return;
    try {
      const res = await apiFetch(`/api/admin/tenants/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error");
      }
      toast.success("Empresa eliminada");
      router.push("/administracion/empresas");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  if (loading) {
    return (
      <>
        <Topbar title="Editar Empresa" backLink={{ href: "/administracion/empresas", label: "Empresas" }} />
        <main className="p-3 flex-1 flex items-center justify-center text-sm text-brand-gray-500 animate-pulse">
          Cargando...
        </main>
      </>
    );
  }

  const selectedPlan = planes.find((p) => p.codigo === planCodigo);

  return (
    <>
      <title>Editar Empresa - Admin - OFSERCONT IA</title>
      <Topbar title="Editar Empresa" backLink={{ href: "/administracion/empresas", label: "Empresas" }} />
      <main className="ui-page flex-1">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Editar Empresa</h1>

        <Card className="p-5 border-brand-gray-200 max-w-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                Nombre *
              </Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                RUC
              </Label>
              <Input value={ruc} onChange={(e) => setRuc(e.target.value)} maxLength={13} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                Plan de suscripción
              </Label>
              <select
                value={planCodigo}
                onChange={(e) => setPlanCodigo(e.target.value)}
                className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {planes.length === 0 ? (
                  <option value={planCodigo}>{planCodigo}</option>
                ) : (
                  planes.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.nombre} · {p.maxEmpresas} empresa(s) · ${Number(p.precioMensual).toFixed(2)}
                      /mes
                    </option>
                  ))
                )}
              </select>
              {selectedPlan ? (
                <p className="text-[11px] text-brand-gray-400">
                  Cupo: {selectedPlan.maxEmpresas} RUC(s). Los módulos visibles dependen de este plan
                  ∩ rol del usuario.
                </p>
              ) : null}
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="w-4 h-4 rounded border-brand-gray-300 text-brand-red focus:ring-brand-red/30"
              />
              <span className="text-xs font-medium text-brand-gray-700">Empresa activa</span>
            </label>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-brand-red hover:bg-brand-red-bright text-white"
              >
                {submitting ? "Guardando..." : "Guardar Cambios"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={handleDelete} className="ml-auto">
                Eliminar
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
