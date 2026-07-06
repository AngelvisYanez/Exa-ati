"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";

const MOTIVOS_TRASLADO = [
  { value: "1", label: "Venta" },
  { value: "2", label: "Compra" },
  { value: "3", label: "Consignación" },
  { value: "4", label: "Devolución" },
  { value: "5", label: "Traslado entre establecimientos" },
  { value: "6", label: "Exportación" },
  { value: "7", label: "Importación" },
  { value: "8", label: "Otro" },
];

interface DestinatarioDetalle {
  codigoPrincipal: string;
  descripcion: string;
  cantidad: number;
}

interface Destinatario {
  identificacion: string;
  razonSocial: string;
  dirDestino: string;
  motivoTraslado: string;
  codDocSustento: string;
  numDocSustento: string;
  detalles: DestinatarioDetalle[];
}

export default function NuevaGuiaPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [buscandoContacto, setBuscandoContacto] = useState(false);

  const [identificacion, setIdentificacion] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [direccion, setDireccion] = useState("");
  const [placa, setPlaca] = useState("");
  const [transportistaRuc, setTransportistaRuc] = useState("");
  const [transportistaRazonSocial, setTransportistaRazonSocial] = useState("");
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().split("T")[0]);
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split("T")[0]);
  const [numFacturaReferencia, setNumFacturaReferencia] = useState("");

  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([
    { identificacion: "", razonSocial: "", dirDestino: "", motivoTraslado: "1", codDocSustento: "01", numDocSustento: "", detalles: [{ codigoPrincipal: "", descripcion: "", cantidad: 1 }] },
  ]);

  const handleBuscarDestinatario = async (idx: number) => {
    const id = destinatarios[idx].identificacion;
    if (!id.trim()) return;
    setBuscandoContacto(true);
    try {
      const res = await fetch(`/api/contactos?q=${id}`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      const contactos = data.contactos || data.data || [];
      if (contactos.length > 0) {
        const c = contactos[0];
        const n = [...destinatarios];
        n[idx] = { ...n[idx], razonSocial: c.razonSocial || "", dirDestino: c.direccion || n[idx].dirDestino };
        setDestinatarios(n);
        toast.success(`Destinatario encontrado: ${c.razonSocial}`);
      } else {
        toast.warning("No se encontró el contacto");
      }
    } catch {
      toast.error("Error al buscar contacto");
    } finally {
      setBuscandoContacto(false);
    }
  };

  function actualizarDestinatario(i: number, field: string, value: any) {
    const n = [...destinatarios];
    (n[i] as any)[field] = value;
    setDestinatarios(n);
  }

  function agregarDetalle(destIdx: number) {
    const n = [...destinatarios];
    n[destIdx].detalles.push({ codigoPrincipal: "", descripcion: "", cantidad: 1 });
    setDestinatarios(n);
  }

  function eliminarDetalle(destIdx: number, detIdx: number) {
    const n = [...destinatarios];
    n[destIdx].detalles = n[destIdx].detalles.filter((_, i) => i !== detIdx);
    setDestinatarios(n);
  }

  function agregarDestinatario() {
    setDestinatarios([
      ...destinatarios,
      { identificacion: "", razonSocial: "", dirDestino: "", motivoTraslado: "1", codDocSustento: "01", numDocSustento: "", detalles: [{ codigoPrincipal: "", descripcion: "", cantidad: 1 }] },
    ]);
  }

  function eliminarDestinatario(i: number) {
    if (destinatarios.length > 1) setDestinatarios(destinatarios.filter((_, idx) => idx !== i));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placa.trim() || !transportistaRuc.trim()) {
      toast.warning("Placa y RUC del transportista son obligatorios");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/sri/guia-remision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placa: placa.trim(),
          transportistaRuc: transportistaRuc.trim(),
          transportistaRazonSocial: transportistaRazonSocial.trim(),
          fechaIniTransporte: fechaInicio,
          fechaFinTransporte: fechaFin,
          dirPartida: direccion,
          numFacturaReferencia: numFacturaReferencia.trim() || undefined,
          destinatarios: destinatarios.filter((d) => d.identificacion).map((d) => ({
            identificacionDestinatario: d.identificacion,
            razonSocialDestinatario: d.razonSocial,
            dirDestinatario: d.dirDestino,
            motivoTraslado: d.motivoTraslado,
            codDocSustento: d.codDocSustento,
            numDocSustento: d.numDocSustento,
            detalles: d.detalles.filter((dd) => dd.codigoPrincipal).map((dd) => ({
              codigoInterno: dd.codigoPrincipal,
              descripcion: dd.descripcion,
              cantidad: dd.cantidad,
            })),
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al crear guía");
      }
      toast.success("Guía de remisión creada correctamente");
      router.push("/guias-remision");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <title>Nueva Guía de Remisión - OFSERCONT IA</title>
      <Topbar title="Nueva Guía de Remisión" backLink={{ href: "/guias-remision", label: "Guías de Remisión" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full max-w-4xl mx-auto">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Nueva Guía de Remisión</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Card className="p-5 border-brand-gray-200">
            <h2 className="text-sm font-bold text-brand-gray-800 mb-4">Datos del Destinatario</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Identificación</Label>
                <div className="flex gap-1">
                  <Input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} placeholder="RUC/Cédula" />
                  <Button type="button" variant="outline" size="sm" disabled={buscandoContacto} onClick={async () => {
                    if (!identificacion.trim()) return;
                    try {
                      const res = await fetch(`/api/contactos?q=${identificacion}`);
                      const data = await res.json();
                      const list = data.contactos || data.data || [];
                      if (list.length > 0) {
                        const c = list[0];
                        setRazonSocial(c.razonSocial || "");
                        setDireccion(c.direccion || "");
                        toast.success("Datos cargados desde contactos");
                      } else toast.warning("No encontrado");
                    } catch { toast.error("Error"); }
                  }}>
                    <Search className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Razón Social</Label>
                <Input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-4">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Dirección de Partida</Label>
              <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección fiscal" />
            </div>
          </Card>

          <Card className="p-5 border-brand-gray-200">
            <h2 className="text-sm font-bold text-brand-gray-800 mb-4">Datos del Transporte</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Placa *</Label>
                <Input value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC-1234" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">RUC Transportista *</Label>
                <Input value={transportistaRuc} onChange={(e) => setTransportistaRuc(e.target.value)} placeholder="Número RUC" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Razón Social Transportista</Label>
                <Input value={transportistaRazonSocial} onChange={(e) => setTransportistaRazonSocial(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Inicio Transporte</Label>
                <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Fin Transporte</Label>
                <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Factura Referencia (opcional)</Label>
                <Input value={numFacturaReferencia} onChange={(e) => setNumFacturaReferencia(e.target.value)} placeholder="001-001-000000001" />
              </div>
            </div>
          </Card>

          <Card className="p-5 border-brand-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-brand-gray-800">Destinatarios y Detalles</h2>
              <Button type="button" variant="outline" size="sm" onClick={agregarDestinatario}>
                <Plus className="w-3.5 h-3.5" /> Agregar Destinatario
              </Button>
            </div>

            {destinatarios.map((dest, di) => (
              <div key={di} className="border border-brand-gray-200 rounded-lg p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-brand-gray-600">Destinatario #{di + 1}</span>
                  {destinatarios.length > 1 && (
                    <Button type="button" variant="destructive" size="xs" onClick={() => eliminarDestinatario(di)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px]">Identificación</Label>
                    <div className="flex gap-1">
                      <Input size={1} value={dest.identificacion} onChange={(e) => actualizarDestinatario(di, "identificacion", e.target.value)} />
                      <Button type="button" variant="outline" size="xs" onClick={() => handleBuscarDestinatario(di)}>
                        <Search className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px]">Razón Social</Label>
                    <Input size={1} value={dest.razonSocial} onChange={(e) => actualizarDestinatario(di, "razonSocial", e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px]">Dir. Destino</Label>
                    <Input size={1} value={dest.dirDestino} onChange={(e) => actualizarDestinatario(di, "dirDestino", e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px]">Motivo</Label>
                    <select value={dest.motivoTraslado} onChange={(e) => actualizarDestinatario(di, "motivoTraslado", e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-1 text-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
                      {MOTIVOS_TRASLADO.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px]">Doc. Sustento</Label>
                    <Input size={1} value={dest.numDocSustento} onChange={(e) => actualizarDestinatario(di, "numDocSustento", e.target.value)} placeholder="Número" />
                  </div>
                </div>

                <div className="bg-brand-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-brand-gray-500 uppercase">Detalles</span>
                    <Button type="button" variant="outline" size="xs" onClick={() => agregarDetalle(di)}>
                      <Plus className="w-3 h-3" /> Ítem
                    </Button>
                  </div>
                  {dest.detalles.map((det, ddi) => (
                    <div key={ddi} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                      <div className="flex flex-col gap-0.5">
                        <Label className="text-[9px]">Código</Label>
                        <Input size={1} value={det.codigoPrincipal} onChange={(e) => {
                          const n = [...destinatarios];
                          n[di].detalles[ddi].codigoPrincipal = e.target.value;
                          setDestinatarios(n);
                        }} />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <Label className="text-[9px]">Descripción</Label>
                        <Input size={1} value={det.descripcion} onChange={(e) => {
                          const n = [...destinatarios];
                          n[di].detalles[ddi].descripcion = e.target.value;
                          setDestinatarios(n);
                        }} />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <Label className="text-[9px]">Cantidad</Label>
                        <Input type="number" size={1} value={det.cantidad} onChange={(e) => {
                          const n = [...destinatarios];
                          n[di].detalles[ddi].cantidad = Number(e.target.value) || 0;
                          setDestinatarios(n);
                        }} />
                      </div>
                      {dest.detalles.length > 1 && (
                        <div className="flex items-end">
                          <Button type="button" variant="destructive" size="xs" onClick={() => eliminarDetalle(di, ddi)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting} className="bg-brand-navy hover:bg-brand-navy-light text-white">
              {submitting ? "Guardando..." : "Guardar Guía de Remisión"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          </div>
        </form>
      </main>
    </>
  );
}
