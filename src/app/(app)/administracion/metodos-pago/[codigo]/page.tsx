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
import { ModuleGate } from "@/components/auth/ModuleGate";

function EditarMetodoContent() {
  const { codigo: codigoParam } = useParams<{ codigo: string }>();
  const codigo = decodeURIComponent(codigoParam).toUpperCase();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [orden, setOrden] = useState(0);
  const [activo, setActivo] = useState(true);
  const [esSistema, setEsSistema] = useState(false);
  const [usoOperativo, setUsoOperativo] = useState(true);
  const [usoSuscripcion, setUsoSuscripcion] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/api/admin/metodos-pago/${encodeURIComponent(codigo)}`);
        if (!res.ok) throw new Error("No encontrado");
        const data = await res.json();
        const m = data.data;
        setNombre(m.nombre || "");
        setDescripcion(m.descripcion || "");
        setOrden(m.orden ?? 0);
        setActivo(m.activo ?? true);
        setEsSistema(Boolean(m.esSistema));
        setUsoOperativo(m.usoOperativo ?? true);
        setUsoSuscripcion(m.usoSuscripcion ?? false);
      } catch {
        toast.error("Error al cargar método");
        router.push("/administracion/metodos-pago");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [codigo, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.warning("El nombre es obligatorio");
      return;
    }
    if (!usoOperativo && !usoSuscripcion) {
      toast.warning("Selecciona al menos un uso");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/admin/metodos-pago/${encodeURIComponent(codigo)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          orden,
          activo,
          usoOperativo,
          usoSuscripcion,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error");
      }
      toast.success("Método actualizado");
      router.push("/administracion/metodos-pago");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Topbar
          title="Editar método"
          backLink={{ href: "/administracion/metodos-pago", label: "Métodos" }}
        />
        <main className="p-3 flex-1 flex items-center justify-center text-sm text-brand-gray-500 animate-pulse">
          Cargando...
        </main>
      </>
    );
  }

  return (
    <>
      <title>Editar método - Admin</title>
      <Topbar
        title="Editar método"
        backLink={{ href: "/administracion/metodos-pago", label: "Métodos" }}
      />
      <main className="ui-page flex-1">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">
          Editar método de pago
        </h1>
        <Card className="p-5 border-brand-gray-200 max-w-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase">Código</Label>
              <Input value={codigo} disabled className="font-mono bg-brand-gray-50" />
              {esSistema ? (
                <p className="text-[11px] text-brand-gray-400">Método de sistema</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase">Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase">
                Descripción
              </Label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase">Orden</Label>
              <Input
                type="number"
                value={orden}
                onChange={(e) => setOrden(Number(e.target.value) || 0)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={usoOperativo}
                onChange={(e) => setUsoOperativo(e.target.checked)}
                className="w-4 h-4 rounded border-brand-gray-300 text-brand-red"
              />
              <span className="text-xs font-medium text-brand-gray-700">Uso operativo (CxC/CxP)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={usoSuscripcion}
                onChange={(e) => setUsoSuscripcion(e.target.checked)}
                className="w-4 h-4 rounded border-brand-gray-300 text-brand-red"
              />
              <span className="text-xs font-medium text-brand-gray-700">Uso suscripción</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="w-4 h-4 rounded border-brand-gray-300 text-brand-red"
              />
              <span className="text-xs font-medium text-brand-gray-700">Activo</span>
            </label>
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-brand-red hover:bg-brand-red-bright text-white"
              >
                {submitting ? "Guardando..." : "Guardar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}

export default function EditarMetodoPage() {
  return (
    <ModuleGate module="admin.metodos-pago">
      <EditarMetodoContent />
    </ModuleGate>
  );
}
