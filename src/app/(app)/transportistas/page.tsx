"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, Truck } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";
interface Transportista {
  id: string;
  ruc: string;
  razonSocial: string;
  placa: string;
  telefono?: string;
  activo: boolean;
}

export default function TransportistasPage() {
  const [items, setItems] = useState<Transportista[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ruc: "", razonSocial: "", placa: "", telefono: "" });
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setForm({ ruc: "", razonSocial: "", placa: "", telefono: "" });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(t: Transportista) {
    setForm({ ruc: t.ruc, razonSocial: t.razonSocial, placa: t.placa, telefono: t.telefono || "" });
    setEditingId(t.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.ruc || !form.razonSocial || !form.placa) {
      toast.error('RUC, Razón Social y Placa son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/transportistas/${editingId}` : '/api/transportistas';
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(editingId ? 'Transportista actualizado' : 'Transportista creado');
      closeForm();
      load();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = search.trim() ? `?q=${search.trim()}` : "";
      const res = await apiFetch(`/api/transportistas${params}`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setItems(data.transportistas || data.data || []);
    } catch {
      toast.error("Error al cargar transportistas");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar a "${nombre}"?`)) return;
    try {
      const res = await apiFetch(`/api/transportistas?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success("Transportista eliminado");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <>
      <title>Transportistas - OFSERCONT IA</title>
      <Topbar title="Transportistas" />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Transportistas</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Registro de transportistas para guías de remisión</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 h-8 text-xs" />
            </div>
            <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" /> Nuevo
            </Button>
          </div>
        </div>

        {showForm && (
          <div className="bg-white border border-brand-red/30 rounded-xl p-4 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-brand-gray-600">
                {editingId ? 'Editar Transportista' : 'Nuevo Transportista'}
              </h3>
              <Button variant="ghost" size="sm" onClick={closeForm}>X</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase text-brand-gray-500">RUC *</span>
                <Input size={1} value={form.ruc} onChange={e => setForm({ ...form, ruc: e.target.value })} disabled={!!editingId} className="h-8 text-xs" />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <span className="text-[10px] font-bold uppercase text-brand-gray-500">Razón Social *</span>
                <Input size={1} value={form.razonSocial} onChange={e => setForm({ ...form, razonSocial: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase text-brand-gray-500">Placa *</span>
                <Input size={1} value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value })} className="h-8 text-xs" placeholder="ABC-1234" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase text-brand-gray-500">Teléfono</span>
                <Input size={1} value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="md:col-span-3 flex items-end justify-end gap-2">
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
              icon={<Truck className="w-5 h-5" />}
              title="No hay transportistas registrados."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse text-[13px]">
                <TableHeader>
                  <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <TableHead className="py-3 px-4 font-semibold">RUC</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Razón Social</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Placa</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Teléfono</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Estado</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {items.map((t) => (
                    <TableRow key={t.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <TableCell className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{t.ruc}</TableCell>
                      <TableCell className="py-3 px-4 font-medium text-brand-gray-800">{t.razonSocial}</TableCell>
                      <TableCell className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-600">{t.placa}</TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-500">{t.telefono || "—"}</TableCell>
                      <TableCell className="py-3 px-4">
                        {t.activo ? (
                          <span className="text-[10px] font-semibold bg-success-pale text-success px-2 py-0.5 rounded-full">Activo</span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-brand-gray-100 text-brand-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(t)} className="inline-flex items-center gap-1 text-brand-red hover:text-brand-red-bright text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1 cursor-pointer">
                          <Edit className="w-3 h-3" /> Editar
                        </button>
                        <button onClick={() => handleDelete(t.id, t.razonSocial)} className="inline-flex items-center gap-1 text-red-500 hover:text-brand-red text-xs font-semibold border border-red-100 hover:bg-brand-red-subtle px-2 py-1 rounded-lg transition-colors cursor-pointer">
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
