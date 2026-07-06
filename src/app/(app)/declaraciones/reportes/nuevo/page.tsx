"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

function NuevoReporteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipoInicial = searchParams.get("tipo") || "103";
  const [tipo, setTipo] = useState(tipoInicial);
  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [generando, setGenerando] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleGenerar = async () => {
    if (!periodo) {
      toast.warning("Selecciona un período");
      return;
    }
    setGenerando(true);
    setPreview(null);
    try {
      const periodoNum = parseInt(periodo.replace('-', ''), 10);
      const res = await fetch(`/api/declaraciones/reportes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, periodo: periodoNum }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al generar reporte");
      }
      const data = await res.json();
      setPreview(data.data || data);
      toast.success("Reporte generado correctamente");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al generar datos");
    } finally {
      setGenerando(false);
    }
  };

  const handleGuardar = async () => {
    if (!preview) return;
    setSubmitting(true);
    try {
      const id = preview.id;
      toast.success("Reporte guardado correctamente");
      router.push(`/declaraciones/reportes/${id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <title>Nuevo Reporte - OFSERCONT IA</title>
      <Topbar title="Nuevo Reporte" backLink={{ href: "/declaraciones/reportes", label: "Reportes" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full max-w-3xl mx-auto">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Generar Reporte Fiscal</h1>

        <Card className="p-5 border-brand-gray-200">
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Tipo de Formulario</Label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                >
                  <option value="103">Formulario 103 - IVA</option>
                  <option value="104">Formulario 104 - Renta</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Período</Label>
                <input
                  type="month"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleGenerar}
              disabled={generando}
              className="bg-brand-navy hover:bg-brand-navy-light text-white self-start"
            >
              {generando ? "Generando..." : "Generar Datos"}
            </Button>
          </div>
        </Card>

        {preview && (
          <Card className="p-5 border-brand-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-brand-gray-800">Previsualización</h2>
              <div className="flex gap-2">
                <Button onClick={handleGuardar} disabled={submitting} className="bg-brand-navy hover:bg-brand-navy-light text-white">
                  {submitting ? "Guardando..." : "Guardar Reporte"}
                </Button>
                <Button variant="outline" onClick={() => setPreview(null)}>Cancelar</Button>
              </div>
            </div>
            <div className="bg-brand-gray-50 rounded-lg p-4 overflow-auto max-h-96">
              <pre className="text-xs text-brand-gray-600 font-mono whitespace-pre-wrap">
                {JSON.stringify(preview, null, 2)}
              </pre>
            </div>
          </Card>
        )}
      </main>
    </>
  );
}

export default function NuevoReportePage() {
  return (
    <Suspense fallback={<div className="p-6 text-brand-gray-500">Cargando...</div>}>
      <NuevoReporteForm />
    </Suspense>
  );
}
