"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Search } from "lucide-react";

const TIPOS_ID = [
  { value: "04", label: "RUC" },
  { value: "05", label: "Cédula" },
  { value: "06", label: "Pasaporte" },
  { value: "07", label: "Consumidor Final" },
];

export default function EditarContactoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tipoIdentificacion, setTipoIdentificacion] = useState("04");
  const [identificacion, setIdentificacion] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [esCliente, setEsCliente] = useState(true);
  const [esProveedor, setEsProveedor] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/contactos?id=${id}`);
        if (!res.ok) throw new Error("No encontrado");
        const data = await res.json();
        const c = data.contacto || data.data || data;
        setTipoIdentificacion(c.tipoIdentificacion || "04");
        setIdentificacion(c.identificacion || "");
        setRazonSocial(c.razonSocial || "");
        setNombreComercial(c.nombreComercial || "");
        setEmail(c.email || "");
        setTelefono(c.telefono || "");
        setDireccion(c.direccion || "");
        setEsCliente(c.esCliente ?? true);
        setEsProveedor(c.esProveedor ?? false);
      } catch {
        toast.error("Error al cargar contacto");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identificacion.trim() || !razonSocial.trim()) {
      toast.warning("Identificación y razón social son obligatorios");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contactos?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoIdentificacion,
          identificacion: identificacion.trim(),
          razonSocial: razonSocial.trim(),
          nombreComercial: nombreComercial.trim() || undefined,
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
          direccion: direccion.trim() || undefined,
          esCliente,
          esProveedor,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al actualizar");
      }
      toast.success("Contacto actualizado");
      router.push("/contactos");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este contacto?")) return;
    try {
      const res = await fetch(`/api/contactos?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success("Contacto eliminado");
      router.push("/contactos");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const handleBuscarSri = async () => {
    if (!identificacion.trim() || tipoIdentificacion !== "04") {
      toast.warning("Se requiere un RUC para buscar en SRI");
      return;
    }
    try {
      const res = await fetch(`/api/sri/contribuyente?ruc=${identificacion}`);
      if (!res.ok) throw new Error("No encontrado");
      const data = await res.json();
      setRazonSocial(data.razonSocial || razonSocial);
      setNombreComercial(data.nombreComercial || nombreComercial);
      setDireccion(data.direccion || direccion);
      if (data.razonSocial) toast.success("Datos actualizados desde el SRI");
    } catch {
      toast.error("No se pudo consultar el SRI");
    }
  };

  if (loading) {
    return (
      <>
        <Topbar title="Editar Contacto" backLink={{ href: "/contactos", label: "Contactos" }} />
        <main className="p-3 flex-1 flex items-center justify-center text-sm text-brand-gray-500 animate-pulse">Cargando...</main>
      </>
    );
  }

  return (
    <>
      <title>Editar Contacto - OFSERCONT IA</title>
      <Topbar title="Editar Contacto" backLink={{ href: "/contactos", label: "Contactos" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Editar Contacto</h1>
        <Card className="p-5 border-brand-gray-200">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Tipo Identificación</Label>
                <select value={tipoIdentificacion} onChange={(e) => setTipoIdentificacion(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
                  {TIPOS_ID.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Identificación *</Label>
                <div className="flex gap-1">
                  <Input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} className="flex-1" />
                  <Button type="button" variant="outline" size="sm" onClick={handleBuscarSri} title="Buscar en SRI">
                    <Search className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Razón Social *</Label>
              <Input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Nombre Comercial</Label>
              <Input value={nombreComercial} onChange={(e) => setNombreComercial(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Teléfono</Label>
                <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Dirección</Label>
              <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={esCliente} onChange={(e) => setEsCliente(e.target.checked)} className="w-4 h-4 rounded border-brand-gray-300 text-brand-navy focus:ring-brand-navy/30" />
                <span className="text-xs font-medium text-brand-gray-700">Es Cliente</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={esProveedor} onChange={(e) => setEsProveedor(e.target.checked)} className="w-4 h-4 rounded border-brand-gray-300 text-brand-navy focus:ring-brand-navy/30" />
                <span className="text-xs font-medium text-brand-gray-700">Es Proveedor</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="bg-brand-navy hover:bg-brand-navy-light text-white">
                {submitting ? "Guardando..." : "Guardar Cambios"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
              <Button type="button" variant="destructive" onClick={handleDelete} className="ml-auto">Eliminar</Button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
