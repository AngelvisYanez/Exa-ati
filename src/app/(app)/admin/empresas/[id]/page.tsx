"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function EditarEmpresaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nombre, setNombre] = useState("");
  const [ruc, setRuc] = useState("");
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/tenants/${id}`);
        if (!res.ok) throw new Error("No encontrado");
        const data = await res.json();
        const t = data.data;
        setNombre(t.nombre || "");
        setRuc(t.ruc || "");
        setActivo(t.activo ?? true);
      } catch {
        toast.error("Error al cargar empresa");
        router.push("/admin/empresas");
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
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          ruc: ruc.trim() || null,
          activo,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al actualizar");
      }
      toast.success("Empresa actualizada");
      router.push("/admin/empresas");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar esta empresa?")) return;
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error");
      }
      toast.success("Empresa eliminada");
      router.push("/admin/empresas");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  if (loading) {
    return (
      <>
        <Topbar title="Editar Empresa" backLink={{ href: "/admin/empresas", label: "Empresas" }} />
        <main className="p-3 flex-1 flex items-center justify-center text-sm text-brand-gray-500 animate-pulse">Cargando...</main>
      </>
    );
  }

  return (
    <>
      <title>Editar Empresa - Admin - OFSERCONT IA</title>
      <Topbar title="Editar Empresa" backLink={{ href: "/admin/empresas", label: "Empresas" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Editar Empresa</h1>

        <Card className="p-5 border-brand-gray-200 max-w-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">RUC</Label>
              <Input value={ruc} onChange={(e) => setRuc(e.target.value)} maxLength={13} />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="w-4 h-4 rounded border-brand-gray-300 text-brand-navy focus:ring-brand-navy/30" />
              <span className="text-xs font-medium text-brand-gray-700">Empresa activa</span>
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
