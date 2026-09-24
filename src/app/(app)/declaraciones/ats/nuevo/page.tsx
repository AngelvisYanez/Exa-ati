"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Download } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";

/** input type=month (YYYY-MM) → YYYYMM para la API */
function toPeriodoApi(monthValue: string): string {
  return monthValue.replace(/-/g, "");
}

export default function NuevoAtsPage() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [generando, setGenerando] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [atsId, setAtsId] = useState<string | null>(null);

  const handleGenerar = async () => {
    if (!periodo) {
      toast.warning("Selecciona un período");
      return;
    }
    setGenerando(true);
    setPreview(null);
    setAtsId(null);
    try {
      const res = await apiFetch("/api/declaraciones/ats/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo: toPeriodoApi(periodo) }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || "Error al generar");
      setPreview(payload.data ?? payload);
      if (payload.validacion && !payload.validacion.valido) {
        toast.warning(`ATS con observaciones: ${payload.validacion.errores?.join("; ")}`);
      } else {
        toast.success("ATS generado correctamente");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al generar ATS");
    } finally {
      setGenerando(false);
    }
  };

  const handleGuardar = async () => {
    if (!preview) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/declaraciones/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodo: toPeriodoApi(periodo),
          datos: preview,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || "Error al guardar");
      setAtsId(String(payload.data?.id ?? payload.id));
      toast.success("ATS guardado correctamente");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadXml = async () => {
    if (!atsId) return;
    try {
      const res = await apiFetch(`/api/declaraciones/ats/${atsId}/xml`);
      if (!res.ok) throw new Error("Error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ats_${toPeriodoApi(periodo)}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Error al descargar XML");
    }
  };

  return (
    <>
      <title>Nuevo ATS - OFSERCONT IA</title>
      <Topbar title="Nuevo ATS" backLink={{ href: "/declaraciones/ats", label: "ATS" }} />
      <main className="ui-page flex-1">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Generar ATS</h1>

        <Card className="p-5 border-brand-gray-200">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5 max-w-sm">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Período</Label>
              <input
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              />
            </div>

            <Button
              type="button"
              onClick={handleGenerar}
              disabled={generando}
              className="bg-brand-red hover:bg-brand-red-bright text-white self-start"
            >
              {generando ? "Generando..." : "Generar ATS"}
            </Button>
          </div>
        </Card>

        {preview && (
          <Card className="p-5 border-brand-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-brand-gray-800">Previsualización ATS</h2>
              <div className="flex gap-2">
                {!atsId && (
                  <Button onClick={handleGuardar} disabled={submitting} className="bg-brand-red hover:bg-brand-red-bright text-white">
                    {submitting ? "Guardando..." : "Guardar ATS"}
                  </Button>
                )}
                {atsId && (
                  <Button onClick={handleDownloadXml} variant="outline">
                    <Download className="w-3.5 h-3.5" /> Descargar XML
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
              <div className="rounded-lg bg-brand-gray-50 p-3">
                <p className="text-[10px] uppercase text-brand-gray-500 font-bold">Ventas</p>
                <p className="font-semibold text-brand-gray-800">{preview.ventas?.length ?? 0} · ${Number(preview.totalVentas || 0).toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-brand-gray-50 p-3">
                <p className="text-[10px] uppercase text-brand-gray-500 font-bold">Compras</p>
                <p className="font-semibold text-brand-gray-800">{preview.compras?.length ?? 0} · ${Number(preview.totalCompras || 0).toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-brand-gray-50 p-3">
                <p className="text-[10px] uppercase text-brand-gray-500 font-bold">Retenciones</p>
                <p className="font-semibold text-brand-gray-800">{preview.retenciones?.length ?? 0} · ${Number(preview.totalRetenciones || 0).toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-brand-gray-50 rounded-lg p-4 overflow-auto max-h-96">
              <pre className="text-xs text-brand-gray-600 font-mono whitespace-pre-wrap">
                {JSON.stringify(preview, null, 2)}
              </pre>
            </div>
            {atsId && (
              <div className="mt-4 flex gap-2">
                <Button onClick={() => router.push("/declaraciones/ats")} variant="outline">
                  Volver a ATS
                </Button>
              </div>
            )}
          </Card>
        )}
      </main>
    </>
  );
}
