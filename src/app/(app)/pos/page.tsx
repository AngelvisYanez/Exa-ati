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
  Plus, Trash2, Calculator, CreditCard, Banknote,
  Smartphone, Search, User, FileText, CheckCircle, XCircle
} from "lucide-react";

const TIPOS_ID = [
  { value: '04', label: 'RUC' },
  { value: '05', label: 'Cédula' },
  { value: '06', label: 'Pasaporte' },
  { value: '07', label: 'Consumidor Final' },
  { value: '08', label: 'Identificación del Exterior' },
];

const FORMAS_PAGO_POS = [
  { value: '01', label: 'Efectivo', icon: Banknote, color: 'emerald' },
  { value: '19', label: 'Tarjeta', icon: CreditCard, color: 'blue' },
  { value: '20', label: 'Transferencia', icon: Smartphone, color: 'violet' },
];

interface LineItem {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  ivaPorcentaje: number;
  descuento: number;
}

function createItem(): LineItem {
  return { id: crypto.randomUUID(), codigo: '', descripcion: '', cantidad: 1, precioUnitario: 0, ivaPorcentaje: 15, descuento: 0 };
}

function calcTotals(items: LineItem[], propina: number) {
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
    total: Number((subtotal + ivaTotal + propina).toFixed(2)),
  };
}

export default function PosPage() {
  const { hasSriLinked } = useAuth();
  const [emisores, setEmisores] = useState<any[]>([]);
  const [emisorId, setEmisorId] = useState('');
  const [items, setItems] = useState<LineItem[]>([createItem()]);
  const [propina, setPropina] = useState(0);
  const [formaPago, setFormaPago] = useState('01');
  const [observaciones, setObservaciones] = useState('');
  const [emitiendo, setEmitiendo] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [tipoId, setTipoId] = useState('07');
  const [identificacion, setIdentificacion] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');

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
  function updateItem(id: string, field: keyof LineItem, value: any) {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function setClienteConsumidorFinal() {
    setTipoId('07');
    setIdentificacion('9999999999999');
    setRazonSocial('CONSUMIDOR FINAL');
    setClienteEmail('');
    setClienteDireccion('');
  }

  const totales = calcTotals(items, propina);

  async function handleEmitir() {
    if (!emisorId) { toast.error('Selecciona un emisor'); return; }
    if (items.some(i => !i.codigo || !i.descripcion || i.precioUnitario <= 0)) {
      toast.error('Completa todos los items con código, descripción y precio');
      return;
    }

    setEmitiendo(true);
    setResultado(null);
    try {
      const res = await fetch('/api/sri/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sri_access_token')}` },
        body: JSON.stringify({
          emisorId,
          items: items.map(i => ({
            codigo: i.codigo,
            descripcion: i.descripcion,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
            ivaPorcentaje: i.ivaPorcentaje,
            descuento: i.descuento,
          })),
          formaPago,
          propina: propina > 0 ? propina : undefined,
          observaciones: observaciones || undefined,
          cliente: tipoId === '07' && identificacion === '9999999999999'
            ? undefined
            : { tipoIdentificacion: tipoId, identificacion, razonSocial, email: clienteEmail || undefined, direccion: clienteDireccion || undefined },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResultado(data);
      toast.success(`Factura POS emitida · Clave: ${data.claveAcceso}`);
    } catch (err: any) {
      toast.error(err.message || 'Error al emitir factura POS');
    } finally {
      setEmitiendo(false);
    }
  }

  function handleNuevaVenta() {
    setItems([createItem()]);
    setPropina(0);
    setObservaciones('');
    setResultado(null);
    setClienteConsumidorFinal();
  }

  if (!hasSriLinked) {
    return (
      <>
        <title>POS - EXA ATI</title>
        <Topbar title="Punto de Venta" />
        <main className="p-6 w-full text-center text-slate-500">
          Vincula tu RUC del SRI en Configuración para usar el POS.
        </main>
      </>
    );
  }

  return (
    <>
      <title>POS - EXA ATI</title>
      <Topbar title="Punto de Venta (POS)" />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        {resultado ? (
          <Card className="p-6 max-w-lg text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-emerald-800">Factura Emitida</h2>
              <div className="bg-slate-50 rounded-lg p-4 w-full text-left font-mono text-xs space-y-1">
                <p><span className="text-slate-500">Clave:</span> <strong>{resultado.claveAcceso}</strong></p>
                <p><span className="text-slate-500">Total:</span> <strong>${totales.total.toFixed(2)}</strong></p>
                <p><span className="text-slate-500">Items:</span> <strong>{items.length}</strong></p>
              </div>
              <Button onClick={handleNuevaVenta} className="bg-brand-navy hover:bg-brand-navy-light text-white">
                Nueva Venta
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 flex flex-col gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Items
                  </h3>
                  <div className="flex items-center gap-2">
                    {emisores.length > 0 && (
                      <select value={emisorId} onChange={e => setEmisorId(e.target.value)}
                        className="h-7 text-xs rounded-lg border border-input bg-transparent px-2">
                        <option value="">Seleccionar emisor...</option>
                        {emisores.map(em => (
                          <option key={em.id} value={em.id}>{em.ruc} — {em.razonSocial}</option>
                        ))}
                      </select>
                    )}
                    <Button variant="outline" size="xs" onClick={addItem} className="flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Agregar
                    </Button>
                  </div>
                </div>

                <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] font-bold uppercase text-slate-400 mb-2 px-2">
                  <div className="col-span-2">Código</div>
                  <div className="col-span-4">Descripción</div>
                  <div className="col-span-1 text-right">Cant.</div>
                  <div className="col-span-1 text-right">P.Unit</div>
                  <div className="col-span-1 text-right">Desc.</div>
                  <div className="col-span-1 text-center">IVA%</div>
                  <div className="col-span-1 text-right">Total</div>
                  <div className="col-span-1"></div>
                </div>

                {items.map((item) => {
                  const totalItem = item.cantidad * item.precioUnitario - (item.descuento || 0);
                  return (
                    <div key={item.id} className="grid grid-cols-12 gap-1.5 mb-1.5 items-center bg-slate-50 rounded-lg p-2">
                      <div className="col-span-3 md:col-span-2">
                        <Input size={1} value={item.codigo} onChange={e => updateItem(item.id, 'codigo', e.target.value)}
                          placeholder="Código" className="h-7 text-xs" />
                      </div>
                      <div className="col-span-5 md:col-span-4">
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
                      <div className="col-span-1 text-xs font-mono font-bold text-right pr-1">
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

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-bold uppercase text-slate-500 tracking-wider">Cliente</h3>
                  <button onClick={setClienteConsumidorFinal}
                    className="ml-auto text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer">
                    Consumidor Final
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-[10px]">Tipo ID</Label>
                    <select value={tipoId} onChange={e => setTipoId(e.target.value)}
                      className="h-7 text-xs rounded-lg border border-input bg-transparent px-2 w-full">
                      {TIPOS_ID.map(ti => <option key={ti.value} value={ti.value}>{ti.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Identificación</Label>
                    <Input size={1} value={identificacion} onChange={e => setIdentificacion(e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[10px]">Razón Social</Label>
                    <Input size={1} value={razonSocial} onChange={e => setRazonSocial(e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Email</Label>
                    <Input type="email" size={1} value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Dirección</Label>
                    <Input size={1} value={clienteDireccion} onChange={e => setClienteDireccion(e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card className="p-4">
                <h3 className="text-sm font-bold uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-2">
                  <Calculator className="w-4 h-4" /> Totales
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono font-bold">${totales.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Descuentos</span>
                    <span className="font-mono font-bold text-red-500">-${totales.descuentos.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>IVA {items[0]?.ivaPorcentaje || 0}%</span>
                    <span className="font-mono font-bold">${totales.iva.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 text-xs">Propina</span>
                    <Input type="number" value={propina} onChange={e => setPropina(parseFloat(e.target.value) || 0)}
                      className="h-7 text-xs w-24 ml-auto text-right" min={0} step={0.25} />
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base font-bold text-slate-900">
                    <span>TOTAL</span>
                    <span className="font-mono">${totales.total.toFixed(2)}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="text-sm font-bold uppercase text-slate-500 tracking-wider mb-3">Pago</h3>
                <div className="grid grid-cols-3 gap-2">
                  {FORMAS_PAGO_POS.map(fp => {
                    const Icon = fp.icon;
                    return (
                      <button key={fp.value} onClick={() => setFormaPago(fp.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer
                          ${formaPago === fp.value
                            ? 'bg-brand-navy text-white border-brand-navy'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                        <Icon className="w-5 h-5" />
                        <span className="text-[10px] font-bold">{fp.label}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-4">
                <Label className="text-[10px]">Observaciones</Label>
                <Input size={1} value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  className="h-7 text-xs mt-1" placeholder="Opcional" />
              </Card>

              <Button onClick={handleEmitir} disabled={emitiendo || !emisorId}
                className="w-full bg-brand-navy hover:bg-brand-navy-light text-white py-6 text-base font-bold">
                {emitiendo ? 'Emitiendo...' : `Emitir Factura · $${totales.total.toFixed(2)}`}
              </Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
