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

function NuevoRolContent() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = codigo.trim().toUpperCase();
    if (!code || !nombre.trim()) {
      toast.warning("Código y nombre son obligatorios");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: code,
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al crear rol");
      }
      toast.success("Rol creado. Asigna módulos a continuación.");
      router.push(`/admin/roles/${encodeURIComponent(code)}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <title>Nuevo Rol - Admin - OFSERCONT IA</title>
      <Topbar title="Nuevo Rol" backLink={{ href: "/admin/roles", label: "Roles" }} />
      <main className="ui-page flex-1">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Nuevo Rol</h1>

        <Card className="p-5 border-brand-gray-200 max-w-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                Código *
              </Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                placeholder="CONTADOR"
                maxLength={50}
                className="font-mono uppercase"
              />
              <p className="text-[10px] text-brand-gray-400">
                Solo letras, números y guion bajo. No se puede cambiar después.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                Nombre *
              </Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Contador"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                Descripción
              </Label>
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Acceso a contabilidad y declaraciones"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-brand-red hover:bg-brand-red-bright text-white"
              >
                {submitting ? "Creando..." : "Crear y asignar módulos"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/roles")}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}

export default function NuevoRolPage() {
  return (
    <ModuleGate module="admin.roles">
      <NuevoRolContent />
    </ModuleGate>
  );
}
