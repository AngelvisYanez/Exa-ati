"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { ModuleGate } from "@/components/auth/ModuleGate";
import { slugifyPlanCodigo } from "@/lib/plans";

interface Modulo {
  codigo: string;
  nombre: string;
  grupo: string;
}

function NuevoPlanContent() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [maxEmpresas, setMaxEmpresas] = useState(1);
  const [precioMensual, setPrecioMensual] = useState(0);
  const [precioAnual, setPrecioAnual] = useState("");
  const [allModulos, setAllModulos] = useState<Modulo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch("/api/admin/modulos")
      .then((r) => r.json())
      .then((d) => setAllModulos(d.data || []))
      .catch(() => toast.error("No se pudieron cargar módulos"));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Modulo[]>();
    for (const m of allModulos) {
      if (m.codigo === "admin.empresas" || m.codigo === "admin.planes") continue;
      const list = map.get(m.grupo) || [];
      list.push(m);
      map.set(m.grupo, list);
    }
    return [...map.entries()];
  }, [allModulos]);

  const handleNombre = (v: string) => {
    setNombre(v);
    if (!codigo || codigo === slugifyPlanCodigo(nombre)) {
      setCodigo(slugifyPlanCodigo(v));
    }
  };

  const toggle = (modCodigo: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(modCodigo)) next.delete(modCodigo);
      else next.add(modCodigo);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.warning("El nombre es obligatorio");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/admin/planes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: codigo || slugifyPlanCodigo(nombre),
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          maxEmpresas,
          precioMensual,
          precioAnual: precioAnual === "" ? null : Number(precioAnual),
          modulos: [...selected],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error");
      }
      const data = await res.json();
      toast.success("Plan creado");
      router.push(`/administracion/planes/${encodeURIComponent(data.data.codigo)}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <title>Nuevo plan - Admin - OFSERCONT IA</title>
      <Topbar title="Nuevo plan" backLink={{ href: "/administracion/planes", label: "Planes" }} />
      <main className="ui-page flex-1 max-w-3xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Card className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Nombre</Label>
              <Input value={nombre} onChange={(e) => handleNombre(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Código</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(slugifyPlanCodigo(e.target.value))}
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Máx. empresas</Label>
              <Input
                type="number"
                min={1}
                value={maxEmpresas}
                onChange={(e) => setMaxEmpresas(Number(e.target.value) || 1)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Precio mensual</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={precioMensual}
                onChange={(e) => setPrecioMensual(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Precio anual</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={precioAnual}
                onChange={(e) => setPrecioAnual(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Descripción</Label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
          </Card>

          <Card className="p-5 flex flex-col gap-3">
            <h2 className="text-sm font-bold">Módulos iniciales</h2>
            {grouped.map(([grupo, mods]) => (
              <div key={grupo} className="border border-brand-gray-100 rounded-lg p-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-gray-400">
                  {grupo}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                  {mods.map((m) => (
                    <label key={m.codigo} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(m.codigo)}
                        onChange={() => toggle(m.codigo)}
                      />
                      {m.nombre}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting} className="bg-brand-red hover:bg-brand-red-bright">
              {submitting ? "Creando…" : "Crear plan"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/administracion/planes")}>
              Cancelar
            </Button>
          </div>
        </form>
      </main>
    </>
  );
}

export default function NuevoPlanPage() {
  return (
    <ModuleGate module="admin.planes">
      <NuevoPlanContent />
    </ModuleGate>
  );
}
