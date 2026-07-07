"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/Topbar";
import { useAuth } from "@/contexts/AuthContext";
import { sriClient } from "@/lib/sriClient";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Trash2, User, Package, Search,
  Send, CheckCircle, Loader2, X, List
} from "lucide-react";

const TIPOS_ID = [
  { value: '04', label: 'RUC' },
  { value: '05', label: 'Cédula' },
  { value: '06', label: 'Pasaporte' },
  { value: '07', label: 'Consumidor Final' },
  { value: '08', label: 'Identificación del Exterior' },
];

const FORMAS_PAGO = [
  { value: '01', label: 'Sin uso sistema financiero' },
  { value: '15', label: 'Compensación deudas' },
  { value: '16', label: 'Tarjeta débito' },
  { value: '17', label: 'Dinero electrónico' },
  { value: '18', label: 'Tarjeta prepago' },
  { value: '19', label: 'Tarjeta crédito' },
  { value: '20', label: 'Otros uso sistema financiero' },
  { value: '21', label: 'Endoso títulos' },
];

interface EcomItem {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  ivaPorcentaje: number;
  descuento: number;
}

interface ProductoInv {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precio_unitario: string;
  iva_porcentaje: number;
  stock: string;
}

function createItem(): EcomItem {
  return { id: crypto.randomUUID(), codigo: '', descripcion: '', cantidad: 1, precioUnitario: 0, ivaPorcentaje: 15, descuento: 0 };
}

function calcTotals(items: EcomItem[]) {
  let subtotal = 0;
  let descTotal = 0;
  let ivaTotal = 0;
  for (const item of items) {
    const base = item.cantidad * item.precioUnitario;
    const desc = item.descuento || 0;
    const neto = base - desc;
    subtotal += neto;
    descTotal += desc;
    ivaTotal += neto * item.ivaPorcentaje / 100;
  }
  return {
    subtotal: Number(subtotal.toFixed(2)),
    descuentos: Number(descTotal.toFixed(2)),
    iva: Number(ivaTotal.toFixed(2)),
    total: Number((subtotal + ivaTotal).toFixed(2)),
  };
}

export default function EcommerceFacturarPage() {
  const { hasSriLinked } = useAuth();
  const [emisores, setEmisores] = useState<any[]>([]);
  const [emisorId, setEmisorId] = useState('');
  const [items, setItems] = useState<EcomItem[]>([createItem()]);
  const [formaPago, setFormaPago] = useState('19');
  const [plazo, setPlazo] = useState('');
  const [pedidoId, setPedidoId] = useState('');
  const [guiaRemision, setGuiaRemision] = useState('');
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const [tipoId, setTipoId] = useState('05');
  const [identificacion, setIdentificacion] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');

  const [showSelector, setShowSelector] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [productos, setProductos] = useState<ProductoInv[]>([]);
  const [searchProd, setSearchProd] = useState('');
  const [loadingProds, setLoadingProds] = useState(false);

  useEffect(() => {
    if (!hasSriLinked) return;
    sriClient.getEmisores().then((res: any) => {
      const list = res.emisores || [];
      setEmisores(list);
      if (list.length === 1) setEmisorId(list[0].id);
    }).catch(() => {});
  }, [hasSriLinked]);

  function addItem() { setItems([...items, createItem()]); }
  function removeItem(id: string) { if (items.length > 1) setItems(items.filter(i => i.id !== id)); }
  function updateItem(id: string, field: keyof EcomItem, value: any) {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  async function openProductSelector(itemId: string) {
    setSelectedItemId(itemId);
    setShowSelector(true);
    setSearchProd('');
    setLoadingProds(true);
    try {
      const token = localStorage.getItem('sri_access_token');
      const res = await fetch('/api/ecommerce/productos?activo=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setProductos(data.data || []);
    } catch {} finally {
      setLoadingProds(false);
    }
  }

  function selectProduct(prod: ProductoInv) {
    if (!selectedItemId) return;
    updateItem(selectedItemId, 'codigo', prod.codigo);
    updateItem(selectedItemId, 'descripcion', prod.nombre);
    updateItem(selectedItemId, 'precioUnitario', parseFloat(prod.precio_unitario));
    updateItem(selectedItemId, 'ivaPorcentaje', prod.iva_porcentaje);
    setShowSelector(false);
    setSelectedItemId(null);
  }

  const filteredProds = productos.filter(p =>
    !searchProd || p.codigo.toLowerCase().includes(searchProd.toLowerCase()) ||
    p.nombre.toLowerCase().includes(searchProd.toLowerCase())
  );

  const totales = calcTotals(items);

  async function handleEmitir() {
    if (!emisorId) { toast.error('Selecciona un emisor'); return; }
    if (!identificacion || !razonSocial) { toast.error('Completa los datos del cliente'); return; }
    if (!clienteEmail) { toast.error('El email del cliente es obligatorio'); return; }
    if (items.some(i => !i.codigo || !i.descripcion || i.precioUnitario <= 0)) {
      toast.error('Completa todos los items');
      return;
    }

    setEmitiendo(true);
    setResultado(null);
    try {
      const token = localStorage.getItem('sri_access_token');
      const res = await fetch('/api/ecommerce/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          emisorId,
          items: items.map(i => ({
            codigo: i.codigo, descripcion: i.descripcion, cantidad: i.cantidad,
            precioUnitario: i.precioUnitario, ivaPorcentaje: i.ivaPorcentaje, descuento: i.descuento,
          })),
          cliente: {
            tipoIdentificacion: tipoId, identificacion, razonSocial,
            email: clienteEmail, direccion: clienteDireccion || undefined,
          },
          formaPago,
          plazo: plazo || undefined,
          pedidoId: pedidoId || undefined,
          guiaRemision: guiaRemision || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResultado(data);
      toast.success(`Factura eCommerce emitida · Clave: ${data.claveAcceso}`);

      if (enviarEmail && data.claveAcceso) {
        try {
          await fetch(`/api/ecommerce/invoices/${data.claveAcceso}/send-email`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          toast.success('Email enviado al cliente');
        } catch {
          toast.warning('Factura emitida pero no se pudo enviar el email');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al emitir factura');
    } finally {
      setEmitiendo(false);
    }
  }

  if (!hasSriLinked) {
    return (
      <>
        <title>Facturar - eCommerce - EXA ATI</title>
        <Topbar title="Facturación eCommerce" />
        <main className="p-6 w-full text-center text-slate-500">
          Vincula tu RUC del SRI en Configuración para facturar.
        </main>
      </>
    );
  }

  if (resultado) {
    return (
      <>
        <title>Factura Emitida - EXA ATI</title>
        <Topbar title="Facturación eCommerce" />
        <main className="p-6 w-full">
          <Card className="p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-emerald-800">Factura Emitida</h2>
              <div className="bg-slate-50 rounded-lg p-4 w-full text-left font-mono text-xs space-y-1">
                <p><span className="text-slate-500">Clave:</span> <strong>{resultado.claveAcceso}</strong></p>
                <p><span className="text-slate-500">Total:</span> <strong>${totales.total.toFixed(2)}</strong></p>
                <p><span className="text-slate-500">Cliente:</span> <strong>{razonSocial}</strong></p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setResultado(null); setItems([createItem()]); }}>
                  Nueva Factura
                </Button>
                <a href={`/api/sri/comprobantes/${resultado.claveAcceso}/pdf`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline">Ver PDF</Button>
                </a>
              </div>
            </div>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <title>Facturar - eCommerce - EXA ATI</title>
      <Topbar title="Nueva Factura eCommerce" />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4" /> Emisor
            </h3>
            {emisores.length > 0 && (
              <select value={emisorId} onChange={e => setEmisorId(e.target.value)}
                className="h-7 text-xs rounded-lg border border-input bg-transparent px-2 w-full max-w-sm">
                <option value="">Seleccionar emisor...</option>
                {emisores.map(em => (
                  <option key={em.id} value={em.id}>{em.ruc} — {em.razonSocial}</option>
                ))}
              </select>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px]">Pedido ID (opcional)</Label>
              <Input size={1} value={pedidoId} onChange={e => setPedidoId(e.target.value)} className="h-7 text-xs" placeholder="#1234" />
            </div>
            <div>
              <Label className="text-[10px]">Guía Remisión (opcional)</Label>
              <Input size={1} value={guiaRemision} onChange={e => setGuiaRemision(e.target.value)} className="h-7 text-xs" placeholder="001-001-123456789" />
            </div>
            <div>
              <Label className="text-[10px]">Plazo (días, opcional)</Label>
              <Input type="number" size={1} value={plazo} onChange={e => setPlazo(e.target.value)} className="h-7 text-xs" placeholder="30" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold uppercase text-slate-500 tracking-wider">Cliente</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-[10px]">Tipo ID *</Label>
              <select value={tipoId} onChange={e => setTipoId(e.target.value)}
                className="h-7 text-xs rounded-lg border border-input bg-transparent px-2 w-full">
                {TIPOS_ID.filter(t => t.value !== '07').map(ti => <option key={ti.value} value={ti.value}>{ti.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Identificación *</Label>
              <Input size={1} value={identificacion} onChange={e => setIdentificacion(e.target.value)} className="h-7 text-xs" />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Razón Social *</Label>
              <Input size={1} value={razonSocial} onChange={e => setRazonSocial(e.target.value)} className="h-7 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Email *</Label>
              <Input type="email" size={1} value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} className="h-7 text-xs" placeholder="correo@ejemplo.com" />
            </div>
            <div className="col-span-5">
              <Label className="text-[10px]">Dirección</Label>
              <Input size={1} value={clienteDireccion} onChange={e => setClienteDireccion(e.target.value)} className="h-7 text-xs" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4" /> Productos / Servicios
            </h3>
            <Button variant="outline" size="xs" onClick={addItem}>
              <Plus className="w-3 h-3 mr-1" /> Agregar
            </Button>
          </div>

          <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] font-bold uppercase text-slate-400 mb-2 px-2">
            <div className="col-span-2">Código</div>
            <div className="col-span-3">Descripción</div>
            <div className="col-span-1 text-right">Cant.</div>
            <div className="col-span-1 text-right">P.Unit</div>
            <div className="col-span-1 text-right">Desc.</div>
            <div className="col-span-1 text-center">IVA%</div>
            <div className="col-span-2 text-right">Total</div>
            <div className="col-span-1"></div>
          </div>

          {items.map((item) => {
            const totalItem = item.cantidad * item.precioUnitario - (item.descuento || 0);
            return (
              <div key={item.id} className="grid grid-cols-12 gap-1.5 mb-1.5 items-center bg-slate-50 rounded-lg p-2">
                <div className="col-span-3 md:col-span-2 flex gap-1">
                  <Input size={1} value={item.codigo} onChange={e => updateItem(item.id, 'codigo', e.target.value)}
                    placeholder="Código" className="h-7 text-xs flex-1" />
                  <Button variant="outline" size="xs" onClick={() => openProductSelector(item.id)}
                    className="h-7 w-7 p-0 shrink-0" title="Buscar en inventario">
                    <List className="w-3 h-3" />
                  </Button>
                </div>
                <div className="col-span-5 md:col-span-3">
                  <Input size={1} value={item.descripcion} onChange={e => updateItem(item.id, 'descripcion', e.target.value)}
                    placeholder="Descripción" className="h-7 text-xs" />
                </div>
                <div className="col-span-1">
                  <Input type="number" size={1} value={item.cantidad} onChange={e => updateItem(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs text-right" min={0} step={1} />
                </div>
                <div className="col-span-1">
                  <Input type="number" size={1} value={item.precioUnitario} onChange={e => updateItem(item.id, 'precioUnitario', parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs text-right" min={0} step={0.01} />
                </div>
                <div className="col-span-1 hidden md:block">
                  <Input type="number" size={1} value={item.descuento} onChange={e => updateItem(item.id, 'descuento', parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs text-right" min={0} step={0.01} />
                </div>
                <div className="col-span-1">
                  <select value={item.ivaPorcentaje} onChange={e => updateItem(item.id, 'ivaPorcentaje', parseInt(e.target.value))}
                    className="h-7 text-xs rounded-lg border border-input bg-transparent px-1 w-full">
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={15}>15%</option>
                  </select>
                </div>
                <div className="col-span-2 text-xs font-mono font-bold text-right">
                  ${totalItem.toFixed(2)}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button variant="destructive" size="xs" onClick={() => removeItem(item.id)} disabled={items.length <= 1}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <Label className="text-[10px]">Forma de Pago</Label>
            <select value={formaPago} onChange={e => setFormaPago(e.target.value)}
              className="h-7 text-xs rounded-lg border border-input bg-transparent px-2 w-full mt-1">
              {FORMAS_PAGO.map(fp => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
            </select>
          </Card>

          <Card className="p-4 col-span-2">
            <div className="flex justify-between items-start">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between gap-8 text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-bold">${totales.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-8 text-slate-600">
                  <span>Descuentos</span>
                  <span className="font-mono font-bold text-red-500">-${totales.descuentos.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-8 text-slate-600">
                  <span>IVA</span>
                  <span className="font-mono font-bold">${totales.iva.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between gap-8 text-base font-bold text-slate-900">
                  <span>TOTAL</span>
                  <span className="font-mono">${totales.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={enviarEmail} onChange={e => setEnviarEmail(e.target.checked)}
              className="rounded border-slate-300" />
            <Send className="w-3.5 h-3.5" /> Enviar factura por email al cliente
          </label>
          <Button onClick={handleEmitir} disabled={emitiendo || !emisorId || !clienteEmail}
            className="bg-brand-navy hover:bg-brand-navy-light text-white px-8">
            {emitiendo ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Emitiendo...</> : `Emitir Factura · $${totales.total.toFixed(2)}`}
          </Button>
        </div>
      </main>

      {/* Product Selector Modal */}
      {showSelector && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 bg-black/30">
          <Card className="w-full max-w-lg mx-4 p-0 overflow-hidden max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-600">Seleccionar producto</h3>
              <Button variant="ghost" size="xs" onClick={() => { setShowSelector(false); setSelectedItemId(null); }}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input size={1} value={searchProd} onChange={e => setSearchProd(e.target.value)}
                  placeholder="Buscar producto..." className="h-8 text-xs pl-8" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingProds ? (
                <div className="p-6 text-center text-slate-400">Cargando...</div>
              ) : filteredProds.length === 0 ? (
                <div className="p-6 text-center text-slate-400">No hay productos disponibles</div>
              ) : filteredProds.map(prod => (
                <button key={prod.id} type="button"
                  onClick={() => selectProduct(prod)}
                  className="w-full text-left px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-400">{prod.codigo}</span>
                        <span className="text-xs font-medium truncate">{prod.nombre}</span>
                      </div>
                      {prod.descripcion && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{prod.descripcion}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs font-mono font-bold">${parseFloat(prod.precio_unitario).toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400">{prod.iva_porcentaje}% IVA · Stock: {parseFloat(prod.stock).toFixed(0)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
