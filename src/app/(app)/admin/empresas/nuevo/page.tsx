"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function NuevaEmpresaPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [nombre, setNombre] = useState("");
  const [ruc, setRuc] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.warning("El nombre es obligatorio");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          ruc: ruc.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al crear empresa");
      }
      toast.success("Empresa creada correctamente");
      router.push("/admin/empresas");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <title>Nueva Empresa - Admin - OFSERCONT IA</title>
      <Topbar title="Nueva Empresa" backLink={{ href: "/admin/empresas", label: "Empresas" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Nueva Empresa</h1>

        <Card className="p-5 border-brand-gray-200 max-w-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Razón social" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">RUC</Label>
              <Input value={ruc} onChange={(e) => setRuc(e.target.value)} placeholder="13 dígitos" maxLength={13} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="bg-brand-navy hover:bg-brand-navy-light text-white">
                {submitting ? "Guardando..." : "Crear Empresa"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
