"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { ModuleGate } from "@/components/auth/ModuleGate";

interface Modulo {
  codigo: string;
  nombre: string;
  grupo: string;
  ruta: string;
  orden: number;
}

function EditarPlanContent() {
  const { codigo: codigoParam } = useParams<{ codigo: string }>();
  const codigo = decodeURIComponent(codigoParam);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [maxEmpresas, setMaxEmpresas] = useState(1);
  const [precioMensual, setPrecioMensual] = useState(0);
  const [precioAnual, setPrecioAnual] = useState<string>("");
  const [moneda, setMoneda] = useState("USD");
  const [orden, setOrden] = useState(0);
  const [activo, setActivo] = useState(true);
  const [esSistema, setEsSistema] = useState(false);
  const [tenantsCount, setTenantsCount] = useState(0);
  const [allModulos, setAllModulos] = useState<Modulo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const [planRes, modulosRes] = await Promise.all([
          apiFetch(`/api/admin/planes/${encodeURIComponent(codigo)}`),
          apiFetch("/api/admin/modulos"),
        ]);
        if (!planRes.ok) throw new Error("No encontrado");
        const planData = await planRes.json();
        const p = planData.data;
        setNombre(p.nombre || "");
        setDescripcion(p.descripcion || "");
        setMaxEmpresas(p.maxEmpresas ?? 1);
        setPrecioMensual(Number(p.precioMensual) || 0);
        setPrecioAnual(
          p.precioAnual === null || p.precioAnual === undefined ? "" : String(p.precioAnual)
        );
        setMoneda(p.moneda || "USD");
        setOrden(p.orden ?? 0);
        setActivo(p.activo ?? true);
        setEsSistema(Boolean(p.esSistema));
        setTenantsCount(p.tenantsCount || 0);
        setSelected(new Set(p.modulos || []));

        if (modulosRes.ok) {
          const mData = await modulosRes.json();
          setAllModulos(mData.data || []);
        }
      } catch {
        toast.error("Error al cargar plan");
        router.push("/administracion/planes");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [codigo, router]);

  const grouped = useMemo(() => {
    const map = new Map<string, Modulo[]>();
    for (const m of allModulos) {
      // Plataforma no se vende en planes de producto (salvo que admin lo quiera)
      if (m.codigo === "admin.empresas" || m.codigo === "admin.planes") continue;
      const list = map.get(m.grupo) || [];
      list.push(m);
      map.set(m.grupo, list);
    }
    return [...map.entries()];
  }, [allModulos]);

  const toggle = (modCodigo: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(modCodigo)) next.delete(modCodigo);
      else next.add(modCodigo);
      return next;
    });
  };

  const toggleGroup = (mods: Modulo[], allOn: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of mods) {
        if (allOn) next.add(m.codigo);
        else next.delete(m.codigo);
      }
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
      const [metaRes, modRes] = await Promise.all([
        apiFetch(`/api/admin/planes/${encodeURIComponent(codigo)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || null,
            maxEmpresas,
            precioMensual,
            precioAnual: precioAnual === "" ? null : Number(precioAnual),
            moneda,
            orden,
            activo: esSistema ? true : activo,
          }),
        }),
        apiFetch(`/api/admin/planes/${encodeURIComponent(codigo)}/modulos`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modulos: [...selected] }),
        }),
      ]);

      if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({}));
        throw new Error(err.message || "Error al guardar plan");
      }
      if (!modRes.ok) {
        const err = await modRes.json().catch(() => ({}));
        throw new Error(err.message || "Error al guardar módulos");
      }

      toast.success("Plan actualizado — los usuarios verán el cambio al refrescar sesión");
      router.push("/administracion/planes");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Topbar title="Editar plan" backLink={{ href: "/administracion/planes", label: "Planes" }} />
        <main className="ui-page flex-1">
          <div className="animate-pulse h-40 bg-brand-gray-100 rounded-xl max-w-3xl" />
        </main>
      </>
    );
  }

  return (
    <>
      <title>Editar plan - Admin - OFSERCONT IA</title>
      <Topbar title="Editar plan" backLink={{ href: "/administracion/planes", label: "Planes" }} />
      <main className="ui-page flex-1 max-w-3xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gray-400">
                Código
              </p>
              <p className="font-mono text-sm font-semibold text-brand-gray-800">{codigo}</p>
              <p className="text-[11px] text-brand-gray-400 mt-1">
                {esSistema ? "Plan de sistema" : "Plan personalizado"} · {tenantsCount} tenant(s)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="desc">Descripción</Label>
                <Input
                  id="desc"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="max">Máx. empresas (RUCs)</Label>
                <Input
                  id="max"
                  type="number"
                  min={1}
                  max={50}
                  value={maxEmpresas}
                  onChange={(e) => setMaxEmpresas(Number(e.target.value) || 1)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="orden">Orden</Label>
                <Input
                  id="orden"
                  type="number"
                  value={orden}
                  onChange={(e) => setOrden(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pm">Precio mensual</Label>
                <Input
                  id="pm"
                  type="number"
                  min={0}
                  step="0.01"
                  value={precioMensual}
                  onChange={(e) => setPrecioMensual(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pa">Precio anual (opcional)</Label>
                <Input
                  id="pa"
                  type="number"
                  min={0}
                  step="0.01"
                  value={precioAnual}
                  onChange={(e) => setPrecioAnual(e.target.value)}
                  placeholder="—"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="moneda">Moneda</Label>
                <Input
                  id="moneda"
                  value={moneda}
                  maxLength={3}
                  onChange={(e) => setMoneda(e.target.value.toUpperCase())}
                />
              </div>
              {!esSistema ? (
                <label className="flex items-center gap-2 text-sm text-brand-gray-700 mt-6">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="rounded border-brand-gray-300"
                  />
                  Plan activo
                </label>
              ) : null}
            </div>
          </Card>

          <Card className="p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-brand-gray-800">Módulos del plan</h2>
                <p className="text-[11px] text-brand-gray-400">
                  Qué puede ver un usuario suscrito (después de cruzar con su rol). Seleccionados:{" "}
                  {selected.size}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {grouped.map(([grupo, mods]) => {
                const allOn = mods.every((m) => selected.has(m.codigo));
                return (
                  <div key={grupo} className="border border-brand-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-gray-400">
                        {grupo}
                      </span>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-brand-red cursor-pointer"
                        onClick={() => toggleGroup(mods, !allOn)}
                      >
                        {allOn ? "Quitar grupo" : "Marcar grupo"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {mods.map((m) => (
                        <label
                          key={m.codigo}
                          className="flex items-center gap-2 text-xs text-brand-gray-700 py-1 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(m.codigo)}
                            onChange={() => toggle(m.codigo)}
                            className="rounded border-brand-gray-300"
                          />
                          <span>
                            {m.nombre}{" "}
                            <span className="font-mono text-[10px] text-brand-gray-400">
                              {m.codigo}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting} className="bg-brand-red hover:bg-brand-red-bright">
              {submitting ? "Guardando…" : "Guardar plan"}
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

export default function EditarPlanPage() {
  return (
    <ModuleGate module="admin.planes">
      <EditarPlanContent />
    </ModuleGate>
  );
}
