"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";
const ESTADO_BADGE: Record<string, string> = {
  BORRADOR: "bg-brand-gray-100 text-brand-gray-600 border-brand-gray-200",
  GENERADO: "bg-sky-50 text-brand-sky border-sky-200",
  PRESENTADO: "bg-success-pale text-success border-success-light/40",
};

interface Reporte {
  id: string;
  tipo: string;
  periodo: string;
  estado: string;
  fechaGeneracion: string;
  fechaPresentacion?: string;
  datos: Record<string, any>;
}

export default function VerReportePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/api/declaraciones/reportes/${id}`);
        if (!res.ok) throw new Error("No encontrado");
        const data = await res.json();
        const r = data.reporte || data.data || data;
        setReporte({
          ...r,
          datos: r.datos ?? r.data ?? {},
        });
      } catch {
        toast.error("Error al cargar reporte");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const updateEstado = async (estado: string) => {
    setUpdating(true);
    try {
      const res = await apiFetch(`/api/declaraciones/reportes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      toast.success(`Estado actualizado a ${estado}`);
      setReporte((prev) => prev ? { ...prev, estado } : prev);
    } catch {
      toast.error("Error al actualizar estado");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este reporte?")) return;
    try {
      const res = await apiFetch(`/api/declaraciones/reportes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success("Reporte eliminado");
      router.push("/declaraciones/reportes");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const handleDownload = () => {
    if (!reporte) return;
    const json = JSON.stringify(reporte.datos, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_${reporte.tipo}_${reporte.periodo}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <>
        <Topbar title="Reporte" backLink={{ href: "/declaraciones/reportes", label: "Reportes" }} />
        <main className="p-3 flex-1 flex items-center justify-center text-sm text-brand-gray-500 animate-pulse">Cargando...</main>
      </>
    );
  }

  if (!reporte) {
    return (
      <>
        <Topbar title="Reporte" backLink={{ href: "/declaraciones/reportes", label: "Reportes" }} />
        <main className="ui-page flex-1 w-full">
          <EmptyState title="Reporte no encontrado." />
        </main>
      </>
    );
  }

  return (
    <>
      <title>Reporte {reporte.tipo} - OFSERCONT IA</title>
      <Topbar title={`Reporte Form. ${reporte.tipo}`} backLink={{ href: "/declaraciones/reportes", label: "Reportes" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">
              Formulario {reporte.tipo}
            </h1>
            <Badge variant="outline" className={`text-[10px] ${ESTADO_BADGE[reporte.estado] || ""}`}>
              {reporte.estado}
            </Badge>
          </div>
          <div className="flex gap-2">
            {reporte.estado === "BORRADOR" && (
              <Button size="sm" onClick={() => updateEstado("GENERADO")} disabled={updating} className="bg-brand-red hover:bg-brand-red-bright text-white">
                Marcar como Generado
              </Button>
            )}
            {reporte.estado === "GENERADO" && (
              <Button size="sm" onClick={() => updateEstado("PRESENTADO")} disabled={updating} className="bg-success hover:bg-success text-white">
                Marcar como Presentado
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="w-3.5 h-3.5" /> Exportar
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-brand-gray-200">
            <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Período</p>
            <p className="text-sm font-semibold text-brand-gray-800 mt-1">{reporte.periodo}</p>
          </Card>
          <Card className="p-4 border-brand-gray-200">
            <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Generado</p>
            <p className="text-sm font-semibold text-brand-gray-800 mt-1">
              {reporte.fechaGeneracion ? new Date(reporte.fechaGeneracion).toLocaleDateString("es-EC") : "—"}
            </p>
          </Card>
          <Card className="p-4 border-brand-gray-200">
            <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Presentado</p>
            <p className="text-sm font-semibold text-brand-gray-800 mt-1">
              {reporte.fechaPresentacion ? new Date(reporte.fechaPresentacion).toLocaleDateString("es-EC") : "—"}
            </p>
          </Card>
        </div>

        <Card className="p-5 border-brand-gray-200">
          <h2 className="text-sm font-bold text-brand-gray-800 mb-3">Datos del Reporte</h2>
          {reporte.datos && Object.keys(reporte.datos).length > 0 ? (
            <div className="bg-brand-gray-50 rounded-lg p-4 overflow-auto max-h-[600px]">
              <Table className="w-full text-left text-xs font-mono">
                <TableBody>
                  {Object.entries(reporte.datos).map(([key, value]) => (
                    <TableRow key={key} className="border-b border-brand-gray-100">
                      <TableCell className="py-1.5 pr-4 font-semibold text-brand-gray-600 whitespace-nowrap">{key}</TableCell>
                      <TableCell className="py-1.5 text-brand-gray-800">{typeof value === "object" ? JSON.stringify(value) : String(value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="No hay datos disponibles en este reporte." compact />
          )}
        </Card>

        <div className="flex gap-2">
          <Link href={`/declaraciones/reportes/nuevo?tipo=${reporte.tipo}`}>
            <Button variant="outline">Crear nuevo reporte similar</Button>
          </Link>
        </div>
      </main>
    </>
  );
}
