"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Package, Plus, Pencil, Trash2, Search, X, Check,
  PackageOpen, AlertTriangle, History, ArrowDown, ArrowUp, Settings2
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/apiFetch";
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

interface Movimiento {
  id: string;
  tipo: string;
  cantidad: string;
  stock_antes: string;
  stock_despues: string;
  motivo: string | null;
  referencia: string | null;
  created_at: string;
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
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loadingKardex, setLoadingKardex] = useState(false);
  const [movTipo, setMovTipo] = useState<'ENTRADA' | 'SALIDA' | 'AJUSTE'>('ENTRADA');
  const [movCantidad, setMovCantidad] = useState('');
  const [movMotivo, setMovMotivo] = useState('');
  const [savingMov, setSavingMov] = useState(false);

  const loadProductos = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sri_access_token');
      const params = new URLSearchParams();
      if (termino) params.set('termino', termino);
      const res = await apiFetch(`/api/ecommerce/productos?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setProductos(data.data || []);
    } catch {} finally {
      setLoading(false);
    }
  }, [termino]);

  const loadKardex = useCallback(async (productoId: string) => {
    setLoadingKardex(true);
    try {
      const res = await apiFetch(`/api/inventario/movimientos?productoId=${productoId}`);
      const data = await res.json();
      if (res.ok) setMovimientos(data.data || []);
    } catch {
      toast.error('Error al cargar kardex');
    } finally {
      setLoadingKardex(false);
    }
  }, []);

  function selectProducto(p: Producto) {
    setSelectedProducto(p);
    loadKardex(p.id);
  }

  async function handleMovimiento() {
    if (!selectedProducto || !movCantidad) {
      toast.error('Cantidad requerida');
      return;
    }
    setSavingMov(true);
    try {
      const res = await apiFetch('/api/inventario/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productoId: selectedProducto.id,
          tipo: movTipo,
          cantidad: parseFloat(movCantidad),
          motivo: movMotivo || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Movimiento registrado');
      setMovCantidad('');
      setMovMotivo('');
      const stockDespues = data?.data?.stock_despues;
      const productoId = selectedProducto.id;
      if (stockDespues != null) {
        setSelectedProducto((prev) =>
          prev ? { ...prev, stock: String(stockDespues) } : prev
        );
      }
      await loadKardex(productoId);
      await loadProductos();
      // Sincronizar badge de stock con lista actualizada
      setSelectedProducto((prev) => {
        if (!prev) return prev;
        // loadProductos actualiza estado async; usamos stock_despues si vino
        if (stockDespues != null) return { ...prev, stock: String(stockDespues) };
        return prev;
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar movimiento');
    } finally {
      setSavingMov(false);
    }
  }

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
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `/api/ecommerce/productos/${editingId}`
        : '/api/ecommerce/productos';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
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
      const res = await apiFetch(`/api/ecommerce/productos/${id}`, {
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
        <main className="ui-page flex-1">
          <EmptyState
            icon={<Package className="w-5 h-5" />}
            title="Vincula tu RUC del SRI en Configuración para gestionar productos."
          />
        </main>
      </>
    );
  }

  return (
    <>
      <title>Inventario - EXA ATI</title>
      <Topbar title="Inventario de Productos" />
      <main className="ui-page flex-1">
        {/* Search + Add */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray-400" />
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
          <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white ml-auto" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo Producto
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <Card className="p-4 border-brand-red/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-brand-gray-600">
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
                <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : <><Check className="w-3.5 h-3.5 mr-1" /> {editingId ? 'Actualizar' : 'Crear'}</>}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
              <Package className="w-4 h-4 text-brand-sky" />
            </div>
            <div>
              <p className="text-[10px] text-brand-gray-500 font-bold uppercase">Total</p>
              <p className="text-lg font-bold">{productos.length}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-success-pale flex items-center justify-center">
              <PackageOpen className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-[10px] text-brand-gray-500 font-bold uppercase">Activos</p>
              <p className="text-lg font-bold">{productos.filter(p => p.activo).length}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <p className="text-[10px] text-brand-gray-500 font-bold uppercase">Sin Stock</p>
              <p className="text-lg font-bold">{productos.filter(p => parseFloat(p.stock) <= 0).length}</p>
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="w-full text-xs">
              <TableHeader>
                <TableRow className="bg-brand-gray-50 border-b border-brand-gray-200">
                  <TableHead className="text-left p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Código</TableHead>
                  <TableHead className="text-left p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Nombre</TableHead>
                  <TableHead className="text-right p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Precio</TableHead>
                  <TableHead className="text-center p-3 font-bold text-brand-gray-500 uppercase tracking-wider">IVA</TableHead>
                  <TableHead className="text-right p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Stock</TableHead>
                  <TableHead className="text-center p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Estado</TableHead>
                  <TableHead className="text-center p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="p-6"><TableSkeleton rows={4} columns={6} /></TableCell></TableRow>
                ) : productos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState
                        icon={<Package className="w-5 h-5" />}
                        title="No hay productos."
                        description="Crea tu primer producto."
                        compact
                      />
                    </TableCell>
                  </TableRow>
                ) : productos.map(p => (
                  <TableRow
                    key={p.id}
                    className={`border-b border-brand-gray-100 hover:bg-brand-gray-50 cursor-pointer ${selectedProducto?.id === p.id ? 'bg-sky-50' : ''}`}
                    onClick={() => selectProducto(p)}
                  >
                    <TableCell className="p-3 font-mono font-bold text-xs">{p.codigo}</TableCell>
                    <TableCell className="p-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{p.nombre}</span>
                        {p.descripcion && <span className="text-[10px] text-brand-gray-400">{p.descripcion}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="p-3 text-right font-mono font-bold">${parseFloat(p.precio_unitario).toFixed(2)}</TableCell>
                    <TableCell className="p-3 text-center">{p.iva_porcentaje}%</TableCell>
                    <TableCell className="p-3 text-right font-mono">{parseFloat(p.stock).toFixed(0)}</TableCell>
                    <TableCell className="p-3 text-center">
                      <Badge className={p.activo ? 'bg-success-pale text-success' : 'bg-brand-gray-100 text-brand-gray-500'}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="xs" onClick={() => openEdit(p)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="xs" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Kardex */}
        {selectedProducto && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-brand-sky" />
              <h3 className="text-sm font-bold">
                Kardex — {selectedProducto.codigo} · {selectedProducto.nombre}
              </h3>
              <Badge className="ml-auto">Stock: {parseFloat(selectedProducto.stock).toFixed(0)}</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div>
                <Label className="text-[10px]">Tipo</Label>
                <select
                  value={movTipo}
                  onChange={e => setMovTipo(e.target.value as 'ENTRADA' | 'SALIDA' | 'AJUSTE')}
                  className="h-8 text-xs rounded-lg border border-input bg-transparent px-2 w-full"
                >
                  <option value="ENTRADA">Entrada</option>
                  <option value="SALIDA">Salida</option>
                  <option value="AJUSTE">Ajuste (stock final)</option>
                </select>
              </div>
              <div>
                <Label className="text-[10px]">Cantidad</Label>
                <Input type="number" size={1} value={movCantidad}
                  onChange={e => setMovCantidad(e.target.value)}
                  className="h-8 text-xs" min={0} step={1} />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">Motivo</Label>
                <Input size={1} value={movMotivo}
                  onChange={e => setMovMotivo(e.target.value)}
                  className="h-8 text-xs" placeholder="Opcional" />
              </div>
              <div className="flex items-end">
                <Button size="sm" className="w-full bg-brand-red hover:bg-brand-red-bright text-white"
                  onClick={handleMovimiento} disabled={savingMov}>
                  {savingMov ? '...' : 'Registrar'}
                </Button>
              </div>
            </div>

            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Antes</TableHead>
                  <TableHead className="text-right">Después</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingKardex ? (
                  <TableRow><TableCell colSpan={6} className="p-4"><TableSkeleton rows={2} columns={5} /></TableCell></TableRow>
                ) : movimientos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        icon={<History className="w-5 h-5" />}
                        title="Sin movimientos"
                        compact
                      />
                    </TableCell>
                  </TableRow>
                ) : movimientos.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>{new Date(m.created_at).toLocaleString('es-EC')}</TableCell>
                    <TableCell>
                      <Badge className={
                        m.tipo === 'ENTRADA' ? 'bg-success-pale text-success' :
                        m.tipo === 'SALIDA' ? 'bg-red-100 text-brand-red' :
                        'bg-amber-100 text-amber-800'
                      }>
                        {m.tipo === 'ENTRADA' && <ArrowDown className="w-3 h-3 mr-1 inline" />}
                        {m.tipo === 'SALIDA' && <ArrowUp className="w-3 h-3 mr-1 inline" />}
                        {m.tipo === 'AJUSTE' && <Settings2 className="w-3 h-3 mr-1 inline" />}
                        {m.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{parseFloat(m.cantidad).toFixed(0)}</TableCell>
                    <TableCell className="text-right font-mono">{parseFloat(m.stock_antes).toFixed(0)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{parseFloat(m.stock_despues).toFixed(0)}</TableCell>
                    <TableCell className="text-brand-gray-500">{m.motivo || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>
    </>
  );
}
