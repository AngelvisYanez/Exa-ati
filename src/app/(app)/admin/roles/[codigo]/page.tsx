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

function EditarRolContent() {
  const { codigo: codigoParam } = useParams<{ codigo: string }>();
  const codigo = decodeURIComponent(codigoParam);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [activo, setActivo] = useState(true);
  const [esSistema, setEsSistema] = useState(false);
  const [usuariosCount, setUsuariosCount] = useState(0);
  const [allModulos, setAllModulos] = useState<Modulo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const [rolRes, modulosRes] = await Promise.all([
          apiFetch(`/api/admin/roles/${encodeURIComponent(codigo)}`),
          apiFetch("/api/admin/modulos"),
        ]);
        if (!rolRes.ok) throw new Error("No encontrado");
        const rolData = await rolRes.json();
        const r = rolData.data;
        setNombre(r.nombre || "");
        setDescripcion(r.descripcion || "");
        setActivo(r.activo ?? true);
        setEsSistema(Boolean(r.esSistema));
        setUsuariosCount(r.usuariosCount || 0);
        setSelected(new Set(r.modulos || []));

        if (modulosRes.ok) {
          const mData = await modulosRes.json();
          setAllModulos(mData.data || []);
        }
      } catch {
        toast.error("Error al cargar rol");
        router.push("/admin/roles");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [codigo, router]);

  const grouped = useMemo(() => {
    const map = new Map<string, Modulo[]>();
    for (const m of allModulos) {
      const list = map.get(m.grupo) || [];
      list.push(m);
      map.set(m.grupo, list);
    }
    return [...map.entries()];
  }, [allModulos]);

  const toggle = (modCodigo: string) => {
    if (codigo === "SUPERADMIN") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(modCodigo)) next.delete(modCodigo);
      else next.add(modCodigo);
      return next;
    });
  };

  const toggleGroup = (mods: Modulo[], allOn: boolean) => {
    if (codigo === "SUPERADMIN") return;
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
        apiFetch(`/api/admin/roles/${encodeURIComponent(codigo)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || null,
            activo: esSistema ? true : activo,
          }),
        }),
        apiFetch(`/api/admin/roles/${encodeURIComponent(codigo)}/modulos`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modulos: [...selected] }),
        }),
      ]);

      if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({}));
        throw new Error(err.message || "Error al guardar rol");
      }
      if (!modRes.ok) {
        const err = await modRes.json().catch(() => ({}));
        throw new Error(err.message || "Error al guardar módulos");
      }

      toast.success("Rol actualizado");
      router.push("/admin/roles");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Topbar title="Editar Rol" backLink={{ href: "/admin/roles", label: "Roles" }} />
        <main className="ui-page flex-1">
          <div className="animate-pulse h-40 bg-brand-gray-100 rounded-xl max-w-3xl" />
        </main>
      </>
    );
  }

  return (
    <>
      <title>{`Rol ${codigo} - Admin - OFSERCONT IA`}</title>
      <Topbar title={`Rol ${codigo}`} backLink={{ href: "/admin/roles", label: "Roles" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800 font-mono">
              {codigo}
            </h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">
              {esSistema ? "Rol de sistema" : "Rol personalizado"} · {usuariosCount} usuario
              {usuariosCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-3xl">
          <Card className="p-5 border-brand-gray-200">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Nombre *
                </Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Descripción
                </Label>
                <Input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              {!esSistema && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="w-4 h-4 rounded border-brand-gray-300 text-brand-red focus:ring-brand-red/30"
                  />
                  <span className="text-xs font-medium text-brand-gray-700">Rol activo</span>
                </label>
              )}
            </div>
          </Card>

          <Card className="p-5 border-brand-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-brand-gray-800">Módulos asignados</h2>
                <p className="text-[10px] text-brand-gray-400">
                  {selected.size} de {allModulos.length} seleccionados
                  {codigo === "SUPERADMIN" ? " · SUPERADMIN siempre tiene todos" : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {grouped.map(([grupo, mods]) => {
                const allOn = mods.every((m) => selected.has(m.codigo));
                return (
                  <div key={grupo}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">
                        {grupo}
                      </h3>
                      {codigo !== "SUPERADMIN" && (
                        <button
                          type="button"
                          onClick={() => toggleGroup(mods, !allOn)}
                          className="text-[10px] font-semibold text-brand-red hover:text-brand-red-bright cursor-pointer"
                        >
                          {allOn ? "Quitar grupo" : "Todo el grupo"}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {mods.map((m) => (
                        <label
                          key={m.codigo}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            selected.has(m.codigo)
                              ? "border-brand-red/30 bg-brand-red-subtle/40"
                              : "border-brand-gray-100 hover:bg-brand-gray-50"
                          } ${codigo === "SUPERADMIN" ? "opacity-80 cursor-default" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(m.codigo)}
                            onChange={() => toggle(m.codigo)}
                            disabled={codigo === "SUPERADMIN"}
                            className="mt-0.5 w-4 h-4 rounded border-brand-gray-300 text-brand-red focus:ring-brand-red/30"
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-brand-gray-800">
                              {m.nombre}
                            </span>
                            <span className="block text-[10px] text-brand-gray-400 font-mono">
                              {m.codigo} · {m.ruta}
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

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-brand-red hover:bg-brand-red-bright text-white"
            >
              {submitting ? "Guardando..." : "Guardar cambios"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/admin/roles")}>
              Cancelar
            </Button>
          </div>
        </form>
      </main>
    </>
  );
}

export default function EditarRolPage() {
  return (
    <ModuleGate module="admin.roles">
      <EditarRolContent />
    </ModuleGate>
  );
}
