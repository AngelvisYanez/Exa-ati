"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const TIPOS = [
  { value: "IVA", label: "IVA" },
  { value: "ICE", label: "ICE" },
  { value: "RENTA", label: "Renta" },
  { value: "IVA_RET", label: "Retención IVA" },
  { value: "IRBPNR", label: "IRBPNR" },
];

export default function EditarImpuestoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [porcentaje, setPorcentaje] = useState(0);
  const [tarifa, setTarifa] = useState(0);
  const [tipo, setTipo] = useState("IVA");
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/contabilidad/impuestos?id=${id}`);
        if (!res.ok) throw new Error("No encontrado");
        const data = await res.json();
        const imp = data.impuesto || data.data || data;
        setCodigo(imp.codigo || "");
        setNombre(imp.nombre || "");
        setPorcentaje(imp.porcentaje || 0);
        setTarifa(imp.tarifa || 0);
        setTipo(imp.tipo || "IVA");
        setActivo(imp.activo ?? true);
      } catch {
        toast.error("Error al cargar el impuesto");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim() || !nombre.trim()) {
      toast.warning("Código y nombre son obligatorios");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contabilidad/impuestos?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: codigo.trim(), nombre: nombre.trim(), porcentaje: Number(porcentaje), tarifa: Number(tarifa), tipo, activo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al actualizar");
      }
      toast.success("Impuesto actualizado");
      router.push("/contabilidad/impuestos");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este impuesto?")) return;
    try {
      const res = await fetch(`/api/contabilidad/impuestos?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success("Impuesto eliminado");
      router.push("/contabilidad/impuestos");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  if (loading) {
    return (
      <>
        <Topbar title="Editar Impuesto" backLink={{ href: "/contabilidad/impuestos", label: "Impuestos" }} />
        <main className="p-3 flex-1 flex items-center justify-center text-sm text-brand-gray-500 animate-pulse">Cargando...</main>
      </>
    );
  }

  return (
    <>
      <title>Editar Impuesto - OFSERCONT IA</title>
      <Topbar title="Editar Impuesto" backLink={{ href: "/contabilidad/impuestos", label: "Impuestos" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full max-w-2xl mx-auto">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Editar Impuesto</h1>
        <Card className="p-5 border-brand-gray-200">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Código *</Label>
                <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Nombre *</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Porcentaje (%)</Label>
                <Input type="number" step="0.01" value={porcentaje} onChange={(e) => setPorcentaje(Number(e.target.value))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Tarifa</Label>
                <Input type="number" step="0.01" value={tarifa} onChange={(e) => setTarifa(Number(e.target.value))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Tipo</Label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
                  {TIPOS.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="w-4 h-4 rounded border-brand-gray-300 text-brand-navy focus:ring-brand-navy/30" />
              <span className="text-xs font-medium text-brand-gray-700">Activo</span>
            </label>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="bg-brand-navy hover:bg-brand-navy-light text-white">
                {submitting ? "Guardando..." : "Guardar Cambios"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
              <Button type="button" variant="destructive" onClick={handleDelete} className="ml-auto">Eliminar</Button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
