"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface CuentaRef {
  id: string;
  codigo: string;
  nombre: string;
  nivel: number;
}

const TIPOS = [
  { value: "ACTIVO", label: "Activo" },
  { value: "PASIVO", label: "Pasivo" },
  { value: "PATRIMONIO", label: "Patrimonio" },
  { value: "INGRESO", label: "Ingreso" },
  { value: "GASTO", label: "Gasto" },
  { value: "COSTO", label: "Costo" },
];

export default function NuevaCuentaPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [cuentasPadre, setCuentasPadre] = useState<CuentaRef[]>([]);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [nivel, setNivel] = useState(1);
  const [tipo, setTipo] = useState("ACTIVO");
  const [esAuxiliar, setEsAuxiliar] = useState(false);
  const [permiteMovimiento, setPermiteMovimiento] = useState(true);
  const [cuentaPadreId, setCuentaPadreId] = useState("");

  useEffect(() => {
    fetch("/api/contabilidad/plan-cuentas")
      .then((r) => r.json())
      .then((data) => {
        const list = data.cuentas || data.data || [];
        setCuentasPadre(list);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim() || !nombre.trim()) {
      toast.warning("Código y nombre son obligatorios");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contabilidad/plan-cuentas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: codigo.trim(),
          nombre: nombre.trim(),
          nivel: Number(nivel),
          tipo,
          esAuxiliar,
          permiteMovimiento,
          cuentaPadreId: cuentaPadreId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al crear la cuenta");
      }
      toast.success("Cuenta creada correctamente");
      router.push("/contabilidad/plan-cuentas");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <title>Nueva Cuenta - OFSERCONT IA</title>
      <Topbar title="Nueva Cuenta" backLink={{ href: "/contabilidad/plan-cuentas", label: "Plan de Cuentas" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Crear Cuenta Contable</h1>

        <Card className="p-5 border-brand-gray-200">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Código *</Label>
                <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej. 1.01.01" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Nivel</Label>
                <Input type="number" min={1} max={6} value={nivel} onChange={(e) => setNivel(Number(e.target.value))} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la cuenta" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Tipo</Label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Cuenta Padre</Label>
              <select
                value={cuentaPadreId}
                onChange={(e) => setCuentaPadreId(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              >
                <option value="">Sin cuenta padre (raíz)</option>
                {cuentasPadre.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} - {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={esAuxiliar}
                  onChange={(e) => setEsAuxiliar(e.target.checked)}
                  className="w-4 h-4 rounded border-brand-gray-300 text-brand-navy focus:ring-brand-navy/30"
                />
                <span className="text-xs font-medium text-brand-gray-700">Es Auxiliar</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={permiteMovimiento}
                  onChange={(e) => setPermiteMovimiento(e.target.checked)}
                  className="w-4 h-4 rounded border-brand-gray-300 text-brand-navy focus:ring-brand-navy/30"
                />
                <span className="text-xs font-medium text-brand-gray-700">Permite Movimiento</span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="bg-brand-navy hover:bg-brand-navy-light text-white">
                {submitting ? "Guardando..." : "Guardar Cuenta"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
