"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Landmark } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";
interface PosicionFiscal {
  id: string;
  nombre: string;
  tipoContribuyente?: string;
  activo: boolean;
}

export default function PosicionesFiscalesPage() {
  const [items, setItems] = useState<PosicionFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: "", tipoContribuyente: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/contabilidad/posiciones-fiscales");
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setItems(data.posiciones || data.data || []);
    } catch {
      toast.error("Error al cargar posiciones fiscales");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm({ nombre: "", tipoContribuyente: "" });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(p: PosicionFiscal) {
    setForm({ nombre: p.nombre, tipoContribuyente: p.tipoContribuyente || "" });
    setEditingId(p.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/contabilidad/posiciones-fiscales/${editingId}` : '/api/contabilidad/posiciones-fiscales';
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(editingId ? 'Posición fiscal actualizada' : 'Posición fiscal creada');
      closeForm();
      load();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    try {
      const res = await apiFetch(`/api/contabilidad/posiciones-fiscales/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success("Posición fiscal eliminada");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <>
      <title>Posiciones Fiscales - OFSERCONT IA</title>
      <Topbar title="Posiciones Fiscales" backLink={{ href: "/contabilidad", label: "Contabilidad" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Posiciones Fiscales</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Configuración de posiciones fiscales</p>
          </div>
          <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5" /> Nueva Posición
          </Button>
        </div>

        {showForm && (
          <div className="bg-white border border-brand-red/30 rounded-xl p-4 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-brand-gray-600">
                {editingId ? 'Editar Posición' : 'Nueva Posición'}
              </h3>
              <Button variant="ghost" size="sm" onClick={closeForm}>X</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase text-brand-gray-500">Nombre *</span>
                <Input size={1} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase text-brand-gray-500">Tipo Contribuyente</span>
                <Input size={1} value={form.tipoContribuyente} onChange={e => setForm({ ...form, tipoContribuyente: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="md:col-span-2 flex items-end justify-end gap-2">
                <Button variant="outline" size="sm" onClick={closeForm}>Cancelar</Button>
                <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Landmark className="w-5 h-5" />}
              title="No hay posiciones fiscales configuradas."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse text-[13px]">
                <TableHeader>
                  <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <TableHead className="py-3 px-4 font-semibold">Nombre</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Tipo Contribuyente</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Estado</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {items.map((p) => (
                    <TableRow key={p.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <TableCell className="py-3 px-4">
                        <span className="font-medium text-brand-gray-800">{p.nombre}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">
                        {p.tipoContribuyente || "—"}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        {p.activo ? (
                          <span className="text-[10px] font-semibold bg-success-pale text-success px-2 py-0.5 rounded-full">Activo</span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-brand-gray-100 text-brand-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(p)} className="inline-flex items-center gap-1 text-brand-red hover:text-brand-red-bright text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1 cursor-pointer">
                          <Edit className="w-3 h-3" /> Editar
                        </button>
                        <button onClick={() => handleDelete(p.id, p.nombre)} className="inline-flex items-center gap-1 text-red-500 hover:text-brand-red text-xs font-semibold border border-red-100 hover:bg-brand-red-subtle px-2 py-1 rounded-lg transition-colors cursor-pointer">
                          <Trash2 className="w-3 h-3" /> Eliminar
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
