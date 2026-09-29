"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModuleGate } from "@/components/auth/ModuleGate";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "sonner";
import { Loader2, Save, Eye } from "lucide-react";

function EditarEmailContent() {
  const { codigo: codigoParam } = useParams<{ codigo: string }>();
  const codigo = decodeURIComponent(codigoParam);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpoHtml, setCuerpoHtml] = useState("");
  const [cuerpoTexto, setCuerpoTexto] = useState("");
  const [activo, setActivo] = useState(true);
  const [variables, setVariables] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ subject: string; html: string; text: string } | null>(
    null
  );
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/api/admin/emails/${encodeURIComponent(codigo)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "No encontrada");
        const p = data.data.plantilla;
        setNombre(p.nombre || "");
        setDescripcion(p.descripcion || "");
        setAsunto(p.asunto || "");
        setCuerpoHtml(p.cuerpoHtml || "");
        setCuerpoTexto(p.cuerpoTexto || "");
        setActivo(Boolean(p.activo));
        setVariables(p.variables || []);
        setPreview(data.data.preview || null);
      } catch {
        toast.error("Error al cargar plantilla");
        router.push("/administracion/emails");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [codigo, router]);

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const res = await apiFetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, asunto, cuerpoHtml, cuerpoTexto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error preview");
      setPreview(data.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al previsualizar");
    } finally {
      setPreviewing(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/admin/emails", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo,
          nombre,
          descripcion,
          asunto,
          cuerpoHtml,
          cuerpoTexto,
          activo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al guardar");
      toast.success("Plantilla guardada");
      await runPreview();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Topbar title="Email" backLink={{ href: "/administracion/emails", label: "Emails" }} />
        <main className="ui-page flex-1 flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-brand-gray-400" />
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar title={nombre || codigo} backLink={{ href: "/administracion/emails", label: "Emails" }} />
      <main className="ui-page flex-1 max-w-6xl mx-auto">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="desc">Descripción</Label>
              <Input
                id="desc"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="asunto">Asunto</Label>
              <Input id="asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="html">Cuerpo HTML</Label>
              <textarea
                id="html"
                value={cuerpoHtml}
                onChange={(e) => setCuerpoHtml(e.target.value)}
                rows={14}
                className="w-full mt-1 rounded-lg border border-brand-gray-200 bg-brand-gray-50 p-3 text-xs font-mono text-brand-gray-800 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/15"
              />
            </div>
            <div>
              <Label htmlFor="texto">Cuerpo texto (fallback)</Label>
              <textarea
                id="texto"
                value={cuerpoTexto}
                onChange={(e) => setCuerpoTexto(e.target.value)}
                rows={6}
                className="w-full mt-1 rounded-lg border border-brand-gray-200 bg-brand-gray-50 p-3 text-xs font-mono text-brand-gray-800 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/15"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-brand-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="rounded border-brand-gray-300"
              />
              Plantilla activa (se envía cuando corresponda)
            </label>
            {variables.length > 0 ? (
              <p className="text-[11px] text-brand-gray-500">
                Variables:{" "}
                {variables.map((v) => (
                  <code
                    key={v}
                    className="mx-0.5 px-1 py-0.5 rounded bg-brand-gray-100 text-brand-gray-700 font-mono"
                  >
                    {`{{${v}}}`}
                  </code>
                ))}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void runPreview()}
                disabled={previewing}
              >
                {previewing ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Eye className="size-4 mr-1.5" />
                )}
                Previsualizar
              </Button>
              <Button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="bg-brand-red hover:bg-brand-red-bright text-white"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Save className="size-4 mr-1.5" />
                )}
                Guardar
              </Button>
            </div>
          </div>

          <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden flex flex-col min-h-[420px]">
            <div className="px-4 py-3 border-b border-brand-gray-100 bg-brand-gray-50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-400">
                Vista previa
              </p>
              <p className="text-sm font-bold text-brand-gray-800 mt-1 truncate">
                {preview?.subject || "—"}
              </p>
            </div>
            <div className="flex-1 p-4 overflow-auto bg-white">
              {preview?.html ? (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              ) : (
                <p className="text-xs text-brand-gray-400 text-center py-12">
                  Pulsa Previsualizar para ver el email con datos de ejemplo.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default function AdminEmailEditPage() {
  return (
    <ModuleGate module="admin.emails">
      <EditarEmailContent />
    </ModuleGate>
  );
}
