"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import Dialog from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Plus, Users, Save } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

interface Empleado {
  cedula: string;
  nombre_completo: string;
  sueldo: number;
}

export default function EmpleadosPage() {
  const [items, setItems] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    cedula: "",
    nombres: "",
    apellidos: "",
    sueldoBase: "",
    cargasFamiliares: "0",
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/nomina/empleados");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      toast.error("Error al cargar empleados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/nomina/empleados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cedula: form.cedula,
          nombres: form.nombres,
          apellidos: form.apellidos,
          sueldoBase: parseFloat(form.sueldoBase),
          cargasFamiliares: parseInt(form.cargasFamiliares, 10),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Empleado registrado correctamente");
      setShowModal(false);
      setForm({ cedula: "", nombres: "", apellidos: "", sueldoBase: "", cargasFamiliares: "0" });
      load();
    } catch {
      toast.error("Error al guardar empleado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <title>Gestión de Empleados - OFSERCONT IA</title>
      <Topbar title="Ficha de Empleados" backLink={{ href: "/control-tributario", label: "Control Tributario" }} />

      <main className="ui-page flex-1">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-brand-gray-900">Personal y Ficha de Empleados</h1>
            <p className="text-xs text-brand-gray-500 mt-1">Registro de trabajadores, sueldos base y cargas para retención de Impuesto a la Renta.</p>
          </div>
          <Button onClick={() => setShowModal(true)} className="bg-brand-red text-white hover:bg-brand-red-bright">
            <Plus className="w-4 h-4 mr-1.5" /> Nuevo Empleado
          </Button>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-brand-gray-400">Cargando nómina de empleados...</div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={<Users className="w-5 h-5" />}
                  title="No hay empleados registrados."
                  description={'Haz clic en "Nuevo Empleado" para registrar al personal.'}
                />
              </CardContent>
            </Card>
          ) : (
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="bg-brand-gray-50 border-b text-left text-brand-gray-600 text-xs font-bold uppercase tracking-wider">
                  <TableHead className="py-3 px-4">Cédula</TableHead>
                  <TableHead className="py-3 px-4">Nombre Completo</TableHead>
                  <TableHead className="py-3 px-4 text-right">Sueldo Base ($)</TableHead>
                  <TableHead className="py-3 px-4 text-right">Aporte Ind. 9.45%</TableHead>
                  <TableHead className="py-3 px-4 text-right">Costo Patronal 11.15%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((emp) => {
                  const s = Number(emp.sueldo || 0);
                  return (
                    <TableRow key={emp.cedula} className="hover:bg-brand-gray-50 border-b border-brand-gray-100">
                      <TableCell className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-700">{emp.cedula}</TableCell>
                      <TableCell className="py-3 px-4 font-semibold text-brand-gray-900">{emp.nombre_completo}</TableCell>
                      <TableCell className="py-3 px-4 text-right font-bold text-brand-gray-900">${s.toFixed(2)}</TableCell>
                      <TableCell className="py-3 px-4 text-right font-medium text-amber-700">${(s * 0.0945).toFixed(2)}</TableCell>
                      <TableCell className="py-3 px-4 text-right font-medium text-success">${(s * 0.1115).toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      {showModal && (
        <Dialog open={showModal} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
            <h3 className="text-base font-bold text-brand-gray-900">Registrar Nuevo Empleado</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-brand-gray-700 block mb-1">Cédula / Identificación</label>
                <Input required value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="1712345678" />
              </div>
              <div>
                <label className="text-xs font-semibold text-brand-gray-700 block mb-1">Sueldo Base ($)</label>
                <Input required type="number" step="0.01" value={form.sueldoBase} onChange={(e) => setForm({ ...form, sueldoBase: e.target.value })} placeholder="600.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-brand-gray-700 block mb-1">Nombres</label>
                <Input required value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} placeholder="Juan Carlos" />
              </div>
              <div>
                <label className="text-xs font-semibold text-brand-gray-700 block mb-1">Apellidos</label>
                <Input required value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} placeholder="Pérez Gómez" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-brand-gray-700 block mb-1">Cargas Familiares (para Rebaja IR)</label>
              <Input type="number" min="0" max="10" value={form.cargasFamiliares} onChange={(e) => setForm({ ...form, cargasFamiliares: e.target.value })} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-brand-red text-white hover:bg-brand-red-bright">
                <Save className="w-4 h-4 mr-1.5" />
                {saving ? "Guardando..." : "Guardar Empleado"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
