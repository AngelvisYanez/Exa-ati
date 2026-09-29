"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { ModuleGate } from "@/components/auth/ModuleGate";
import { slugifyMetodoCodigo } from "@/lib/metodos-pago";

function NuevoMetodoContent() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [orden, setOrden] = useState(50);
  const [usoOperativo, setUsoOperativo] = useState(true);
  const [usoSuscripcion, setUsoSuscripcion] = useState(false);

  const handleNombre = (v: string) => {
    setNombre(v);
    if (!codigo || codigo === slugifyMetodoCodigo(nombre)) {
      setCodigo(slugifyMetodoCodigo(v));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.warning("El nombre es obligatorio");
      return;
    }
    if (!usoOperativo && !usoSuscripcion) {
      toast.warning("Selecciona al menos un uso (operativo o suscripción)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/admin/metodos-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: codigo || slugifyMetodoCodigo(nombre),
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          orden,
          usoOperativo,
          usoSuscripcion,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error");
      }
      const data = await res.json();
      toast.success("Método creado");
      router.push(`/administracion/metodos-pago/${encodeURIComponent(data.data.codigo)}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <title>Nuevo método de pago - Admin</title>
      <Topbar
        title="Nuevo método"
        backLink={{ href: "/administracion/metodos-pago", label: "Métodos" }}
      />
      <main className="ui-page flex-1">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Nuevo método de pago</h1>
        <Card className="p-5 border-brand-gray-200 max-w-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase">Nombre *</Label>
              <Input value={nombre} onChange={(e) => handleNombre(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase">Código</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(slugifyMetodoCodigo(e.target.value))}
                className="font-mono uppercase"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase">Descripción</Label>
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
              <span className="text-xs font-medium text-brand-gray-700">
                Uso suscripción (canales de cobro)
              </span>
            </label>
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-brand-red hover:bg-brand-red-bright text-white"
              >
                {submitting ? "Guardando..." : "Crear"}
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

export default function NuevoMetodoPage() {
  return (
    <ModuleGate module="admin.metodos-pago">
      <NuevoMetodoContent />
    </ModuleGate>
  );
}
