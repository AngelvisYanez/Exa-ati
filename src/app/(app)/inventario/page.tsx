"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/Topbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package, Plus, Pencil, Trash2, Search, X, Check,
  PackageOpen, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precio_unitario: string;
  iva_porcentaje: number;
  stock: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface ProductoForm {
  codigo: string;
  nombre: string;
  descripcion: string;
  precioUnitario: string;
  ivaPorcentaje: number;
  stock: string;
}

const emptyForm = (): ProductoForm => ({
  codigo: '',
  nombre: '',
  descripcion: '',
  precioUnitario: '',
  ivaPorcentaje: 15,
  stock: '0',
});

export default function InventarioPage() {
  const { hasSriLinked } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [termino, setTermino] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductoForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const loadProductos = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sri_access_token');
      const params = new URLSearchParams();
      if (termino) params.set('termino', termino);
      const res = await fetch(`/api/ecommerce/productos?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setProductos(data.data || []);
    } catch {} finally {
      setLoading(false);
    }
  }, [termino]);

  useEffect(() => {
    if (hasSriLinked) loadProductos();
    else setLoading(false);
  }, [hasSriLinked, loadProductos]);

  function openCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(p: Producto) {
    setForm({
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      precioUnitario: p.precio_unitario,
      ivaPorcentaje: p.iva_porcentaje,
      stock: p.stock,
    });
    setEditingId(p.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.codigo || !form.nombre || !form.precioUnitario) {
      toast.error('Código, nombre y precio son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('sri_access_token');
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `/api/ecommerce/productos/${editingId}`
        : '/api/ecommerce/productos';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          codigo: form.codigo,
          nombre: form.nombre,
          descripcion: form.descripcion || null,
          precioUnitario: parseFloat(form.precioUnitario),
          ivaPorcentaje: form.ivaPorcentaje,
          stock: parseFloat(form.stock) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(editingId ? 'Producto actualizado' : 'Producto creado');
      closeForm();
      loadProductos();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      const token = localStorage.getItem('sri_access_token');
      const res = await fetch(`/api/ecommerce/productos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      toast.success('Producto eliminado');
      loadProductos();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    }
  }

  if (!hasSriLinked) {
    return (
      <>
        <title>Inventario - EXA ATI</title>
        <Topbar title="Inventario" />
        <main className="p-6 max-w-3xl mx-auto text-center text-slate-500">
          Vincula tu RUC del SRI en Configuración para gestionar productos.
        </main>
      </>
    );
  }

  return (
    <>
      <title>Inventario - EXA ATI</title>
      <Topbar title="Inventario de Productos" />
      <main className="p-4 max-w-6xl mx-auto flex flex-col gap-4">
        {/* Search + Add */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              size={1}
              value={termino}
              onChange={e => setTermino(e.target.value)}
              placeholder="Buscar por código o nombre..."
              className="h-8 text-xs pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={loadProductos}>
            <Package className="w-3.5 h-3.5 mr-1" /> Actualizar
          </Button>
          <Button size="sm" className="bg-brand-navy hover:bg-brand-navy-light text-white ml-auto" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo Producto
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <Card className="p-4 border-brand-navy/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-600">
                {editingId ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <Button variant="ghost" size="xs" onClick={closeForm}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <Label className="text-[10px]">Código *</Label>
                <Input size={1} value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })}
                  className="h-7 text-xs" placeholder="PROD-001" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">Nombre *</Label>
                <Input size={1} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="h-7 text-xs" placeholder="Nombre del producto" />
              </div>
              <div>
                <Label className="text-[10px]">Precio Unitario *</Label>
                <Input type="number" size={1} value={form.precioUnitario}
                  onChange={e => setForm({ ...form, precioUnitario: e.target.value })}
                  className="h-7 text-xs" min={0} step={0.01} />
              </div>
              <div>
                <Label className="text-[10px]">IVA %</Label>
                <select value={form.ivaPorcentaje}
                  onChange={e => setForm({ ...form, ivaPorcentaje: parseInt(e.target.value) })}
                  className="h-7 text-xs rounded-lg border border-input bg-transparent px-2 w-full">
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={15}>15%</option>
                </select>
              </div>
              <div>
                <Label className="text-[10px]">Stock</Label>
                <Input type="number" size={1} value={form.stock}
                  onChange={e => setForm({ ...form, stock: e.target.value })}
                  className="h-7 text-xs" min={0} step={1} />
              </div>
              <div className="col-span-3">
                <Label className="text-[10px]">Descripción</Label>
                <Input size={1} value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  className="h-7 text-xs" placeholder="Descripción opcional" />
              </div>
              <div className="col-span-3 flex items-end justify-end gap-2">
                <Button variant="outline" size="sm" onClick={closeForm}>Cancelar</Button>
                <Button size="sm" className="bg-brand-navy hover:bg-brand-navy-light text-white" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : <><Check className="w-3.5 h-3.5 mr-1" /> {editingId ? 'Actualizar' : 'Crear'}</>}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Total</p>
              <p className="text-lg font-bold">{productos.length}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <PackageOpen className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Activos</p>
              <p className="text-lg font-bold">{productos.filter(p => p.activo).length}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Sin Stock</p>
              <p className="text-lg font-bold">{productos.filter(p => parseFloat(p.stock) <= 0).length}</p>
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3 font-bold text-slate-500 uppercase tracking-wider">Código</th>
                  <th className="text-left p-3 font-bold text-slate-500 uppercase tracking-wider">Nombre</th>
                  <th className="text-right p-3 font-bold text-slate-500 uppercase tracking-wider">Precio</th>
                  <th className="text-center p-3 font-bold text-slate-500 uppercase tracking-wider">IVA</th>
                  <th className="text-right p-3 font-bold text-slate-500 uppercase tracking-wider">Stock</th>
                  <th className="text-center p-3 font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="text-center p-3 font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-400">Cargando...</td></tr>
                ) : productos.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-400">
                    No hay productos. Crea tu primer producto.
                  </td></tr>
                ) : productos.map(p => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-xs">{p.codigo}</td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{p.nombre}</span>
                        {p.descripcion && <span className="text-[10px] text-slate-400">{p.descripcion}</span>}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold">${parseFloat(p.precio_unitario).toFixed(2)}</td>
                    <td className="p-3 text-center">{p.iva_porcentaje}%</td>
                    <td className="p-3 text-right font-mono">{parseFloat(p.stock).toFixed(0)}</td>
                    <td className="p-3 text-center">
                      <Badge className={p.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="xs" onClick={() => openEdit(p)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="xs" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </>
  );
}
