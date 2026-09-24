"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Search, Download, Trash2, FileText, Upload } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";

interface Documento {
  id: string;
  periodo: number;
  nombre: string;
  tipo: string;
  modulo: string;
  mimeType?: string;
  createdAt: string;
}

const tipoColors: Record<string, string> = {
  COMPROBANTE_SRI: "bg-sky-100 text-brand-sky",
  PLANILLA_IESS: "bg-success-pale text-success",
  ATS: "bg-violet-100 text-violet-800",
  DECLARACION: "bg-amber-100 text-amber-800",
  OTRO: "bg-gray-100 text-gray-800",
};

const TIPOS = ["COMPROBANTE_SRI", "PLANILLA_IESS", "ATS", "DECLARACION", "OTRO"];

export default function DocumentosPage() {
  const [items, setItems] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Upload form
  const [upPeriodo, setUpPeriodo] = useState("");
  const [upNombre, setUpNombre] = useState("");
  const [upTipo, setUpTipo] = useState("DECLARACION");
  const [upArchivo, setUpArchivo] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (periodo) params.set("periodo", periodo);
      const res = await apiFetch(`/api/control-tributario/documentos?${params}`);
      if (!res.ok) throw new Error("Error");
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      toast.error("Error al cargar documentos");
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`\u00bfEliminar "${nombre}"?`)) return;
    try {
      const res = await apiFetch(`/api/control-tributario/documentos?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success("Documento eliminado");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const handleUpload = async () => {
    if (!upPeriodo || !upNombre || !upTipo || !upArchivo) {
      toast.warning("Complete todos los campos");
      return;
    }
    setUploading(true);
    try {
      const res = await apiFetch("/api/control-tributario/documentos", {
        method: "POST",
        body: JSON.stringify({
          periodo: parseInt(upPeriodo),
          nombre: upNombre,
          tipo: upTipo,
          modulo: "CONTROL_TRIBUTARIO",
          archivoPath: URL.createObjectURL(upArchivo),
          mimeType: upArchivo.type,
          tamanoBytes: upArchivo.size,
        }),
      });
      if (!res.ok) throw new Error("Error");
      toast.success("Documento registrado");
      setShowUpload(false);
      setUpNombre("");
      setUpArchivo(null);
      load();
    } catch {
      toast.error("Error al subir documento");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <title>Documentos Fiscales - Control Tributario</title>
      <Topbar title="Documentos Fiscales" backLink={{ href: "/control-tributario", label: "Control Tributario" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-xl font-bold text-brand-gray-800">Repositorio de Documentos Fiscales</h1>
          <div className="flex gap-2">
            <Input
              placeholder="Periodo (YYYYMM)"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-36"
            />
            <Button variant="outline" size="icon" onClick={load}>
              <Search className="w-4 h-4" />
            </Button>
            <Button onClick={() => setShowUpload(!showUpload)}>
              <Upload className="w-4 h-4 mr-1" /> Subir
            </Button>
          </div>
        </div>

        {showUpload && (
          <Card className="border-dashed border-2 border-brand-red">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-brand-gray-800">Registrar Documento</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-brand-gray-600">Periodo</label>
                  <Input value={upPeriodo} onChange={(e) => setUpPeriodo(e.target.value)} placeholder="202601" className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-gray-600">Nombre</label>
                  <Input value={upNombre} onChange={(e) => setUpNombre(e.target.value)} placeholder="Declaraci\u00f3n Ene 2026" className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-gray-600">Tipo</label>
                  <select value={upTipo} onChange={(e) => setUpTipo(e.target.value)} className="w-full border rounded-md h-8 text-sm px-2">
                    {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-gray-600">Archivo</label>
                  <input
                    ref={fileRef}
                    type="file"
                    onChange={(e) => setUpArchivo(e.target.files?.[0] || null)}
                    className="w-full text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowUpload(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleUpload} disabled={uploading}>
                  {uploading ? "Subiendo..." : "Guardar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-brand-gray-400">Cargando...</p>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={<FileText className="w-5 h-5" />}
                title="No hay documentos registrados."
                description={'Use "Subir" para agregar uno.'}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((doc) => (
              <Card key={doc.id} className="border-brand-gray-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand-gray-400" />
                      <div>
                        <CardTitle className="text-sm font-semibold">{doc.nombre}</CardTitle>
                        <p className="text-xs text-brand-gray-500">Periodo {doc.periodo}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`text-[10px] ${tipoColors[doc.tipo] || "bg-gray-100 text-gray-800"}`}>
                      {doc.tipo}
                    </Badge>
                    <span className="text-[10px] text-brand-gray-400">{doc.modulo}</span>
                  </div>
                  <p className="text-[10px] text-brand-gray-400 mb-2">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="w-7 h-7" title="Descargar">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-red-500"
                      title="Eliminar"
                      onClick={() => handleDelete(doc.id, doc.nombre)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
