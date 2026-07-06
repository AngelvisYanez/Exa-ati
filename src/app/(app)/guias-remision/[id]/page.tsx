"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, ArrowLeft, FileText } from "lucide-react";

interface GuiaRemision {
  id: string;
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  fechaEmision: string;
  dirPartida: string;
  razonSocialTransportista: string;
  rucTransportista: string;
  placa: string;
  fechaIniTransporte: string;
  fechaFinTransporte: string;
  estado: string;
  numeroAutorizacion?: string;
  claveAcceso?: string;
  fechaAutorizacion?: string;
  ambiente?: string;
  destinatarios?: {
    identificacionDestinatario: string;
    razonSocialDestinatario: string;
    dirDestinatario?: string;
    motivoTraslado: string;
    numDocSustento: string;
    detalles: { codigoInterno: string; descripcion: string; cantidad: number }[];
  }[];
}

const ESTADO_BADGE: Record<string, string> = {
  AUTORIZADO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDIENTE: "bg-amber-50 text-amber-700 border-amber-200",
  RECHAZADO: "bg-red-50 text-red-700 border-red-200",
  EN_PROCESO: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function VerGuiaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [guia, setGuia] = useState<GuiaRemision | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/sri/guia-remision?id=${id}`);
        if (!res.ok) throw new Error("No encontrada");
        const data = await res.json();
        setGuia(data.guia || data.data || data);
      } catch {
        toast.error("Error al cargar guía de remisión");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleDownloadRide = async () => {
    if (!guia?.claveAcceso) {
      toast.warning("No hay clave de acceso disponible");
      return;
    }
    try {
      const res = await fetch(`/api/sri/comprobantes/${guia.claveAcceso}/pdf`);
      if (!res.ok) throw new Error("Error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `guia_${guia.claveAcceso}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Error al descargar RIDE");
    }
  };

  if (loading) {
    return (
      <>
        <Topbar title="Guía de Remisión" backLink={{ href: "/guias-remision", label: "Guías de Remisión" }} />
        <main className="p-3 flex-1 flex items-center justify-center text-sm text-brand-gray-500 animate-pulse">Cargando...</main>
      </>
    );
  }

  if (!guia) {
    return (
      <>
        <Topbar title="Guía de Remisión" backLink={{ href: "/guias-remision", label: "Guías de Remisión" }} />
        <main className="p-3 flex-1 flex items-center justify-center text-sm text-brand-gray-400">Guía no encontrada.</main>
      </>
    );
  }

  const secuencial = `${guia.establecimiento}-${guia.puntoEmision}-${guia.secuencial}`;

  return (
    <>
      <title>Guía {secuencial} - OFSERCONT IA</title>
      <Topbar title={`Guía ${secuencial}`} backLink={{ href: "/guias-remision", label: "Guías de Remisión" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Guía de Remisión</h1>
            <Badge variant="outline" className={`text-[10px] ${ESTADO_BADGE[guia.estado] || ""}`}>{guia.estado}</Badge>
          </div>
          <div className="flex gap-2">
            {guia.claveAcceso && (
              <Button size="sm" onClick={handleDownloadRide} variant="outline">
                <Download className="w-3.5 h-3.5" /> RIDE PDF
              </Button>
            )}
            {guia.claveAcceso && (
              <Button size="sm" variant="outline">
                <FileText className="w-3.5 h-3.5" /> XML
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-brand-gray-200">
            <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Secuencial</p>
            <p className="text-sm font-semibold font-mono text-brand-gray-800 mt-1">{secuencial}</p>
          </Card>
          <Card className="p-4 border-brand-gray-200">
            <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Fecha Emisión</p>
            <p className="text-sm font-semibold text-brand-gray-800 mt-1">
              {guia.fechaEmision ? new Date(guia.fechaEmision).toLocaleDateString("es-EC") : "—"}
            </p>
          </Card>
          <Card className="p-4 border-brand-gray-200">
            <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Autorización</p>
            <p className="text-sm font-semibold font-mono text-brand-gray-800 mt-1 text-xs break-all">
              {guia.numeroAutorizacion || "Pendiente"}
            </p>
          </Card>
        </div>

        <Card className="p-5 border-brand-gray-200">
          <h2 className="text-sm font-bold text-brand-gray-800 mb-4">Datos del Transportista</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">RUC</p>
              <p className="text-sm font-semibold font-mono text-brand-gray-800 mt-1">{guia.rucTransportista || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Razón Social</p>
              <p className="text-sm font-semibold text-brand-gray-800 mt-1">{guia.razonSocialTransportista}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Placa</p>
              <p className="text-sm font-semibold font-mono text-brand-gray-800 mt-1">{guia.placa}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-brand-gray-200">
          <h2 className="text-sm font-bold text-brand-gray-800 mb-4">Ruta</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Dirección Partida</p>
              <p className="text-sm font-semibold text-brand-gray-800 mt-1">{guia.dirPartida || "—"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Inicio</p>
                <p className="text-sm font-semibold text-brand-gray-800 mt-1">
                  {guia.fechaIniTransporte ? new Date(guia.fechaIniTransporte).toLocaleDateString("es-EC") : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Fin</p>
                <p className="text-sm font-semibold text-brand-gray-800 mt-1">
                  {guia.fechaFinTransporte ? new Date(guia.fechaFinTransporte).toLocaleDateString("es-EC") : "—"}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {guia.destinatarios && guia.destinatarios.length > 0 && (
          <Card className="p-5 border-brand-gray-200">
            <h2 className="text-sm font-bold text-brand-gray-800 mb-4">Destinatarios ({guia.destinatarios.length})</h2>
            {guia.destinatarios.map((d, i) => (
              <div key={i} className="border border-brand-gray-100 rounded-lg p-4 mb-3 last:mb-0">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <p className="text-[10px] font-bold text-brand-gray-400 uppercase">Identificación</p>
                    <p className="text-xs font-semibold font-mono text-brand-gray-800 mt-0.5">{d.identificacionDestinatario}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-brand-gray-400 uppercase">Razón Social</p>
                    <p className="text-xs font-semibold text-brand-gray-800 mt-0.5">{d.razonSocialDestinatario}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-brand-gray-400 uppercase">Dirección</p>
                    <p className="text-xs text-brand-gray-600 mt-0.5">{d.dirDestinatario || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-brand-gray-400 uppercase">Doc. Sustento</p>
                    <p className="text-xs font-mono text-brand-gray-600 mt-0.5">{d.numDocSustento || "—"}</p>
                  </div>
                </div>
                {d.detalles.length > 0 && (
                  <div className="bg-brand-gray-50 rounded-lg p-3">
                    <p className="text-[9px] font-bold text-brand-gray-400 uppercase mb-2">Detalles</p>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-[9px] font-bold text-brand-gray-400 uppercase">
                          <th className="pb-1 pr-2">Código</th>
                          <th className="pb-1 pr-2">Descripción</th>
                          <th className="pb-1 text-right">Cantidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.detalles.map((det, ddi) => (
                          <tr key={ddi} className="border-t border-brand-gray-100">
                            <td className="py-1 pr-2 font-mono">{det.codigoInterno}</td>
                            <td className="py-1 pr-2">{det.descripcion}</td>
                            <td className="py-1 text-right font-semibold">{det.cantidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </Card>
        )}

        {guia.numeroAutorizacion && (
          <Card className="p-5 border-brand-gray-200">
            <h2 className="text-sm font-bold text-brand-gray-800 mb-3">Autorización SRI</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Número</p>
                <p className="text-xs font-mono font-semibold text-brand-gray-800 mt-1 break-all">{guia.numeroAutorizacion}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Clave de Acceso</p>
                <p className="text-xs font-mono text-brand-gray-600 mt-1 break-all">{guia.claveAcceso}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Ambiente</p>
                <p className="text-xs font-semibold text-brand-gray-800 mt-1">{guia.ambiente === "1" ? "Pruebas" : "Producción"}</p>
              </div>
            </div>
          </Card>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </Button>
        </div>
      </main>
    </>
  );
}
