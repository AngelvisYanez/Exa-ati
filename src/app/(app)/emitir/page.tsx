"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/Topbar";
import { sriClient } from "@/lib/sriClient";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const TIPOS: ({ cod: string; label: string; desc: string; color: string; icon: React.ReactNode })[] = [
  { cod: '01', label: 'Factura', desc: 'Comprobante de venta', color: 'emerald',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
  { cod: '03', label: 'Liquidación de Compra', desc: 'Adquisición a personas no obligadas', color: 'sky',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg> },
  { cod: '04', label: 'Nota de Crédito', desc: 'Anulación o descuento', color: 'amber',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" /><path d="M18 2l4 4-9 9-4-1 1-4 9-9z" /></svg> },
  { cod: '05', label: 'Nota de Débito', desc: 'Incremento del valor', color: 'red',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg> },
  { cod: '06', label: 'Guía de Remisión', desc: 'Transporte de mercadería', color: 'blue',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M22 12h-4l-3 9H9l-3-9H2" /><path d="M9 3l3 9 3-9" /></svg> },
  { cod: '07', label: 'Comprobante de Retención', desc: 'Retención en la fuente', color: 'violet',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg> },
];

const COLOR_MAP: Record<string, string> = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  sky: 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100',
  amber: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
  red: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
  blue: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100',
  violet: 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100',
};

const TIPOS_ID = [
  { value: '04', label: 'RUC' },
  { value: '05', label: 'Cédula' },
  { value: '06', label: 'Pasaporte' },
  { value: '07', label: 'Consumidor Final' },
  { value: '08', label: 'Identificación del Exterior' },
];

const COD_IVA = [
  { value: '2', label: 'IVA 15%', tarifa: 15 },
  { value: '3', label: 'IVA 5%', tarifa: 5 },
  { value: '0', label: '0%', tarifa: 0 },
  { value: '6', label: 'No objeto IVA', tarifa: 0 },
  { value: '7', label: 'Exento IVA', tarifa: 0 },
];

const FORMA_PAGO = [
  { value: '01', label: 'Sin utilización del sistema financiero' },
  { value: '15', label: 'Compensación de deudas' },
  { value: '16', label: 'Tarjeta de débito' },
  { value: '17', label: 'Dinero electrónico' },
  { value: '18', label: 'Tarjeta prepago' },
  { value: '19', label: 'Tarjeta de crédito' },
  { value: '20', label: 'Otros con utilización del sistema financiero' },
  { value: '21', label: 'Endoso de títulos' },
];

const COD_RETENCION = [
  { codigo: '1', label: 'Renta', retenciones: [
    { codigoRetencion: '303', label: 'Honorarios', porcentaje: 10 },
    { codigoRetencion: '304', label: 'Servicios profesionales', porcentaje: 10 },
    { codigoRetencion: '307', label: 'Arrendamiento bienes inmuebles', porcentaje: 8 },
    { codigoRetencion: '308', label: 'Arrendamiento bienes muebles', porcentaje: 8 },
    { codigoRetencion: '309', label: 'Seguros y reaseguros', porcentaje: 8 },
    { codigoRetencion: '310', label: 'Intereses', porcentaje: 10 },
    { codigoRetencion: '311', label: 'Comisiones', porcentaje: 10 },
    { codigoRetencion: '332', label: 'Compra de bienes', porcentaje: 2 },
    { codigoRetencion: '312', label: 'Servicios predomina intelectual', porcentaje: 10 },
    { codigoRetencion: '319', label: 'Publicidad y comunicación', porcentaje: 6 },
    { codigoRetencion: '320', label: 'Transporte privado', porcentaje: 2 },
    { codigoRetencion: '321', label: 'Transporte público', porcentaje: 2 },
    { codigoRetencion: '322', label: 'Alimentación', porcentaje: 2 },
    { codigoRetencion: '323', label: 'Otros servicios', porcentaje: 2 },
  ]},
  { codigo: '2', label: 'IVA', retenciones: [
    { codigoRetencion: '1', label: 'Retención IVA 30%', porcentaje: 30 },
    { codigoRetencion: '2', label: 'Retención IVA 70%', porcentaje: 70 },
    { codigoRetencion: '3', label: 'Retención IVA 100%', porcentaje: 100 },
    { codigoRetencion: '4', label: 'Retención IVA 20%', porcentaje: 20 },
    { codigoRetencion: '5', label: 'Retención IVA 50%', porcentaje: 50 },
    { codigoRetencion: '6', label: 'Retención IVA 10%', porcentaje: 10 },
  ]},
];

const COD_MOTIVO_NC = [
  { value: '1', label: 'Anulación total' },
  { value: '2', label: 'Anulación parcial' },
  { value: '3', label: 'Descuento total' },
  { value: '4', label: 'Descuento parcial' },
  { value: '5', label: 'Reintegro de gastos' },
  { value: '6', label: 'Otros' },
];

const COD_MOTIVO_ND = [
  { value: '1', label: 'Intereses por mora' },
  { value: '2', label: 'Aumento en valor' },
  { value: '3', label: 'Penalidades' },
  { value: '4', label: 'Otros' },
];

interface DetalleItem { codigoPrincipal: string; descripcion: string; cantidad: number; precioUnitario: number; descuento: number; iva: string; }
interface Destinatario { identificacion: string; razonSocial: string; dirDestino: string; motivoTraslado: string; codDocSustento: string; numDocSustento: string; detalles: DetalleItem[]; }

const L = (v: any) => v ?? 0;

function calcTotal(detalles: DetalleItem[]): { sinImp: number; desc: number; conIVA: number; total: number } {
  let sinImp = 0, desc = 0, total = 0;
  for (const d of detalles) {
    const base = d.cantidad * d.precioUnitario;
    sinImp += base - d.descuento;
    desc += d.descuento;
    const iva = COD_IVA.find(i => i.value === d.iva)?.tarifa || 0;
    total += (base - d.descuento) * (1 + iva / 100);
  }
  return { sinImp: Number(sinImp.toFixed(2)), desc: Number(desc.toFixed(2)), conIVA: Number((total - sinImp).toFixed(2)), total: Number(total.toFixed(2)) };
}

export default function EmitirPage() {
  const { hasSriLinked } = useAuth();
  const [selectedTipo, setSelectedTipo] = useState<any>(null);
  const [emitiendo, setEmitiendo] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  // Emisores vinculados
  const [emisores, setEmisores] = useState<any[]>([]);
  const [loadingEmisores, setLoadingEmisores] = useState(true);

  // Common fields
  const [ambiente, setAmbiente] = useState('2');
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
  const [emisorRuc, setEmisorRuc] = useState('');
  const [secuencial, setSecuencial] = useState('');
  const [tipoId, setTipoId] = useState('04');
  const [identificacion, setIdentificacion] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [direccion, setDireccion] = useState('');
  const [email, setEmail] = useState('');
  const [detalles, setDetalles] = useState<DetalleItem[]>([{ codigoPrincipal: '', descripcion: '', cantidad: 1, precioUnitario: 0, descuento: 0, iva: '2' }]);

  // Factura-specific
  const [propina, setPropina] = useState(0);
  const [formaPago, setFormaPago] = useState('01');

  // NC/ND-specific
  const [docModTipo, setDocModTipo] = useState('01');
  const [docModNumero, setDocModNumero] = useState('');
  const [docModFecha, setDocModFecha] = useState('');
  const [motivo, setMotivo] = useState('');
  const [codMotivoNC, setCodMotivoNC] = useState('1');
  const [motivosND, setMotivosND] = useState<{ razon: string; valor: number }[]>([{ razon: '', valor: 0 }]);

  // Retención-specific
  const [periodoFiscal, setPeriodoFiscal] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [retenciones, setRetenciones] = useState<any[]>([{ codigo: '1', codigoRetencion: '332', baseImponible: 0, porcentajeRetener: 2, valorRetenido: 0, codDocSustento: '01', numDocSustento: '', fechaEmisionDocSustento: '' }]);

  // Guía-specific
  const [transportista, setTransportista] = useState({ razonSocial: '', tipoIdentificacion: '04', identificacion: '', placa: '' });
  const [fechaIniTransporte, setFechaIniTransporte] = useState('');
  const [fechaFinTransporte, setFechaFinTransporte] = useState('');
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([{ identificacion: '', razonSocial: '', dirDestino: '', motivoTraslado: '', codDocSustento: '01', numDocSustento: '', detalles: [] }]);

  function handleRetencionChange(i: number, field: string, value: any) {
    const r = [...retenciones];
    (r[i] as any)[field] = value;
    if (field === 'baseImponible' || field === 'codigoRetencion') {
      const tipo = COD_RETENCION.find(t => t.codigo === r[i].codigo);
      const ret = tipo?.retenciones.find(x => x.codigoRetencion === r[i].codigoRetencion);
      if (ret) {
        r[i].porcentajeRetener = ret.porcentaje;
        r[i].valorRetenido = Number(((r[i].baseImponible || 0) * ret.porcentaje / 100).toFixed(2));
      }
    }
    setRetenciones(r);
  }

  function agregarRetencion() { setRetenciones([...retenciones, { codigo: '1', codigoRetencion: '332', baseImponible: 0, porcentajeRetener: 2, valorRetenido: 0, codDocSustento: '01', numDocSustento: '', fechaEmisionDocSustento: '' }]); }
  function eliminarRetencion(i: number) { if (retenciones.length > 1) setRetenciones(retenciones.filter((_, idx) => idx !== i)); }
  function agregarDetalle() { setDetalles([...detalles, { codigoPrincipal: '', descripcion: '', cantidad: 1, precioUnitario: 0, descuento: 0, iva: '2' }]); }
  function eliminarDetalle(i: number) { if (detalles.length > 1) setDetalles(detalles.filter((_, idx) => idx !== i)); }

  function agregarDestinatario() { setDestinatarios([...destinatarios, { identificacion: '', razonSocial: '', dirDestino: '', motivoTraslado: '', codDocSustento: '01', numDocSustento: '', detalles: [] }]); }
  function agregarMotivoND() { setMotivosND([...motivosND, { razon: '', valor: 0 }]); }

  function buildDatos(): any {
    const totales = calcTotal(detalles);
    const base = {
      fechaEmision,
      secuencial: secuencial || undefined,
      tipoIdentificacionComprador: tipoId,
      identificacionComprador: identificacion,
      razonSocialComprador: razonSocial,
      direccionComprador: direccion || undefined,
    };
    const impuestoMap = new Map<string, any>();
    for (const d of detalles) {
      const key = d.iva;
      const baseI = d.cantidad * d.precioUnitario - d.descuento;
      const iva = COD_IVA.find(i => i.value === d.iva);
      if (!impuestoMap.has(key)) impuestoMap.set(key, { codigo: '2', codigoPorcentaje: key, baseImponible: 0, tarifa: iva?.tarifa || 0, valor: 0 });
      const e = impuestoMap.get(key)!;
      e.baseImponible += baseI;
      e.valor += baseI * (iva?.tarifa || 0) / 100;
    }
    const totalConImpuestos = Array.from(impuestoMap.values()).map((e: any) => ({ ...e, baseImponible: Number(e.baseImponible.toFixed(2)), valor: Number(e.valor.toFixed(2)) }));

    if (selectedTipo.cod === '01') {
      return {
        ...base,
        emailComprador: email || undefined,
        totalSinImpuestos: totales.sinImp,
        totalDescuento: totales.desc,
        importeTotal: totales.total,
        propina: propina || undefined,
        totalConImpuestos,
        pagos: [{ formaPago: formaPago, total: totales.total }],
        detalles: detalles.map(d => ({
          codigoPrincipal: d.codigoPrincipal, descripcion: d.descripcion, cantidad: d.cantidad, precioUnitario: d.precioUnitario, descuento: d.descuento,
          precioTotalSinImpuesto: d.cantidad * d.precioUnitario - d.descuento,
          impuestos: [{ codigo: '2', codigoPorcentaje: d.iva, tarifa: COD_IVA.find(i => i.value === d.iva)?.tarifa || 0, baseImponible: d.cantidad * d.precioUnitario - d.descuento, valor: ((d.cantidad * d.precioUnitario - d.descuento) * (COD_IVA.find(i => i.value === d.iva)?.tarifa || 0) / 100) }],
        })),
      };
    }

    if (selectedTipo.cod === '04') {
      return {
        ...base,
        totalSinImpuestos: totales.sinImp,
        totalConImpuestos,
        importeTotal: totales.total,
        valorModificacion: totales.total,
        motivo,
        codDocModificado: docModTipo,
        numDocModificado: docModNumero,
        fechaEmisionDocSustento: docModFecha,
        detalles: detalles.map(d => ({
          codigoPrincipal: d.codigoPrincipal, descripcion: d.descripcion, cantidad: d.cantidad, precioUnitario: d.precioUnitario, descuento: d.descuento,
          precioTotalSinImpuesto: d.cantidad * d.precioUnitario - d.descuento,
          impuestos: [{ codigo: '2', codigoPorcentaje: d.iva, tarifa: COD_IVA.find(i => i.value === d.iva)?.tarifa || 0, baseImponible: d.cantidad * d.precioUnitario - d.descuento, valor: ((d.cantidad * d.precioUnitario - d.descuento) * (COD_IVA.find(i => i.value === d.iva)?.tarifa || 0) / 100) }],
        })),
      };
    }

    if (selectedTipo.cod === '05') {
      return {
        ...base,
        totalSinImpuestos: totales.sinImp,
        importeTotal: totales.total,
        valorTotal: totales.total,
        codDocModificado: docModTipo,
        numDocModificado: docModNumero,
        fechaEmisionDocSustento: docModFecha,
        motivos: motivosND.filter(m => m.razon && m.valor > 0),
        totalConImpuestos,
        impuestos: Array.from(impuestoMap.values()).map((e: any) => ({ ...e, baseImponible: Number(e.baseImponible.toFixed(2)), valor: Number(e.valor.toFixed(2)) })),
      };
    }

    if (selectedTipo.cod === '07') {
      return {
        ...base,
        periodoFiscal,
        impuestos: retenciones.map(r => ({
          codigo: r.codigo, codigoRetencion: r.codigoRetencion,
          baseImponible: r.baseImponible, porcentajeRetener: r.porcentajeRetener, valorRetenido: r.valorRetenido,
          codDocSustento: r.codDocSustento, numDocSustento: r.numDocSustento, fechaEmisionDocSustento: r.fechaEmisionDocSustento,
          totalSinImpuestos: r.baseImponible, importeTotal: r.baseImponible,
        })),
        infoCompRetencion: {
          fechaEmision,
          obligadoContabilidad: 'SI',
          tipoIdentificacionSujetoRetenido: tipoId,
          razonSocialSujetoRetenido: razonSocial,
          identificacionSujetoRetenido: identificacion,
          periodoFiscal,
        },
      };
    }

    if (selectedTipo.cod === '06') {
      return {
        ...base,
        infoGuiaRemision: {
          fechaEmision,
          dirPartida: direccion || '',
          razonSocialTransportista: transportista.razonSocial,
          tipoIdentificacionTransportista: transportista.tipoIdentificacion,
          rucTransportista: transportista.identificacion,
          obligadoContabilidad: 'SI',
          fechaIniTransporte: fechaIniTransporte || fechaEmision,
          fechaFinTransporte: fechaFinTransporte || fechaEmision,
          placa: transportista.placa,
        },
        destinatarios: destinatarios.filter(d => d.identificacion).map(d => ({
          identificacionDestinatario: d.identificacion,
          razonSocialDestinatario: d.razonSocial,
          dirDestinatario: d.dirDestino || undefined,
          motivoTraslado: d.motivoTraslado,
          codDocSustento: d.codDocSustento,
          numDocSustento: d.numDocSustento,
          numAutDocSustento: '',
          fechaEmisionDocSustento: fechaEmision,
          detalles: d.detalles.map((dd: DetalleItem) => ({
            codigoInterno: dd.codigoPrincipal, descripcion: dd.descripcion, cantidad: dd.cantidad,
          })),
        })),
      };
    }

    if (selectedTipo.cod === '03') {
      return {
        ...base,
        tipoIdentificacionProveedor: tipoId,
        identificacionProveedor: identificacion,
        razonSocialProveedor: razonSocial,
        totalSinImpuestos: totales.sinImp,
        totalDescuento: totales.desc,
        importeTotal: totales.total,
        totalConImpuestos,
        pagos: [{ formaPago: formaPago, total: totales.total }],
        detalles: detalles.map(d => ({
          codigoPrincipal: d.codigoPrincipal, descripcion: d.descripcion, cantidad: d.cantidad, precioUnitario: d.precioUnitario, descuento: d.descuento,
          precioTotalSinImpuesto: d.cantidad * d.precioUnitario - d.descuento,
          impuestos: [{ codigo: '2', codigoPorcentaje: d.iva, tarifa: COD_IVA.find(i => i.value === d.iva)?.tarifa || 0, baseImponible: d.cantidad * d.precioUnitario - d.descuento, valor: ((d.cantidad * d.precioUnitario - d.descuento) * (COD_IVA.find(i => i.value === d.iva)?.tarifa || 0) / 100) }],
        })),
      };
    }
  }

  useEffect(() => {
    if (!hasSriLinked) return;
    sriClient.getEmisores().then((res: any) => {
      const list = res.emisores || [];
      setEmisores(list);
      if (list.length === 1) {
        setEmisorRuc(list[0].ruc);
        setAmbiente(list[0].ambiente || '2');
      }
    }).catch(() => {}).finally(() => setLoadingEmisores(false));
  }, [hasSriLinked]);

  const handleEmitir = async () => {
    setEmitiendo(true);
    setResultado(null);
    try {
      const res = await sriClient.emitirGeneral({ tipo: selectedTipo.cod, emisorRuc, ambiente, datos: buildDatos() });
      setResultado(res);
      if (res.requierePolling) toast.info(`Enviado al SRI. Clave: ${res.claveAcceso}. El sistema lo consultará automáticamente.`);
      else if (res.estado === 'AUTORIZADO') toast.success(`AUTORIZADO · Nro: ${res.numeroAutorizacion}`);
      else toast.warning(`Estado: ${res.estado}. ${res.error?.mensaje || ''}`);
    } catch (err: any) { toast.error(err.message || 'Error al emitir'); }
    finally { setEmitiendo(false); }
  };

  if (!hasSriLinked) return (<><title>Emitir - OFSERCONT IA</title><Topbar title="Emitir Comprobantes" /><main className="p-6 w-full text-center text-slate-500">Vincula tu RUC del SRI en Configuración para emitir comprobantes.</main></>);
  if (!selectedTipo) return (<><title>Emitir - OFSERCONT IA</title><Topbar title="Emitir Comprobantes Electrónicos" /><main className="p-3 flex-1 flex flex-col gap-6 w-full"><p className="text-sm text-slate-500">Selecciona el tipo de comprobante a emitir:</p><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{TIPOS.map(t => (<button key={t.cod} onClick={() => setSelectedTipo(t)} className={`border rounded-xl p-5 flex flex-col gap-3 text-left transition-all cursor-pointer hover:shadow-md ${COLOR_MAP[t.color]}`}><div className="w-10 h-10 rounded-lg border flex items-center justify-center">{t.icon}</div><div><p className="text-sm font-bold">{t.label}</p><p className="text-xs text-slate-500 mt-0.5">{t.desc}</p></div><div className="text-[10px] font-bold flex items-center gap-1 mt-auto">Emitir →</div></button>))}</div></main></>);

  const t = selectedTipo.cod;
  const totales = t === '01' || t === '03' || t === '04' ? calcTotal(detalles) : null;

  return (
    <>
      <title>Emitir {selectedTipo.label} - OFSERCONT IA</title>
      <Topbar title={`Emitir ${selectedTipo.label}`} />
      <main className="p-3 flex-1 flex flex-col gap-5 w-full">
        <Button variant="outline" size="sm" className="self-start" onClick={() => { setSelectedTipo(null); setResultado(null); }}>← Cambiar tipo</Button>
        <Card className="p-5 flex flex-col gap-5">

          {/* === COMMON SECTION === */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5"><Label>RUC Emisor *</Label>
              {loadingEmisores ? (
                <Input value="Cargando..." disabled className="text-slate-400" />
              ) : (
                <select value={emisorRuc} onChange={e => {
                  const sel = emisores.find(em => em.ruc === e.target.value);
                  setEmisorRuc(e.target.value);
                  if (sel?.ambiente) setAmbiente(sel.ambiente);
                }} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  <option value="">Seleccionar RUC...</option>
                  {emisores.map(em => (
                    <option key={em.ruc} value={em.ruc}>
                      {em.ruc} — {em.razonSocial}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-col gap-1.5"><Label>Fecha Emisión *</Label><Input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label>Secuencial (opcional)</Label><Input value={secuencial} onChange={e => setSecuencial(e.target.value)} placeholder="Auto si vacío" /></div>
            <div className="flex flex-col gap-1.5"><Label>Moneda</Label><Input value="USD" disabled className="text-slate-400" /></div>
          </div>

          {/* === AMBIENTE === */}
          <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border">
            <span className="text-xs font-bold uppercase text-slate-500">Ambiente</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => setAmbiente('1')}
                className={`px-4 py-1.5 text-xs rounded-md border transition-all cursor-pointer ${ambiente === '1' ? 'bg-amber-100 border-amber-400 text-amber-800 font-semibold' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                Pruebas
              </button>
              <button type="button" onClick={() => setAmbiente('2')}
                className={`px-4 py-1.5 text-xs rounded-md border transition-all cursor-pointer ${ambiente === '2' ? 'bg-emerald-100 border-emerald-400 text-emerald-800 font-semibold' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                Producción
              </button>
            </div>
          </div>

          {/* === RECEPTOR / PROVEEDOR / SUJETO RETENIDO === */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="flex flex-col gap-1.5"><Label>Tipo ID</Label>
              <select value={tipoId} onChange={e => setTipoId(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">{TIPOS_ID.map(ti => <option key={ti.value} value={ti.value}>{ti.label}</option>)}</select>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Identificación *</Label><Input value={identificacion} onChange={e => setIdentificacion(e.target.value)} placeholder="Número" /></div>
            <div className="flex flex-col gap-1.5 col-span-2"><Label>Razón Social *</Label><Input value={razonSocial} onChange={e => setRazonSocial(e.target.value)} placeholder="Nombre" /></div>
            <div className="flex flex-col gap-1.5"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" /></div>
          </div>

          {/* === FACTURA / LC / NC: DETALLES === */}
          {(t === '01' || t === '03' || t === '04') && (
            <div>
              <div className="flex items-center justify-between mb-3"><h4 className="text-xs font-bold uppercase text-slate-500">Detalles</h4><Button variant="outline" size="xs" onClick={agregarDetalle}>+ Agregar</Button></div>
              {detalles.map((d, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-3 grid grid-cols-2 md:grid-cols-8 gap-2 mb-2">
                  <div className="col-span-2"><Label className="text-[10px]">Código</Label><Input size={1} value={d.codigoPrincipal} onChange={e => { const n = [...detalles]; n[i].codigoPrincipal = e.target.value; setDetalles(n); }} /></div>
                  <div className="col-span-2"><Label className="text-[10px]">Descripción</Label><Input size={1} value={d.descripcion} onChange={e => { const n = [...detalles]; n[i].descripcion = e.target.value; setDetalles(n); }} /></div>
                  <div><Label className="text-[10px]">Cant.</Label><Input type="number" size={1} value={d.cantidad} onChange={e => { const n = [...detalles]; n[i].cantidad = parseFloat(e.target.value) || 0; setDetalles(n); }} /></div>
                  <div><Label className="text-[10px]">P. Unit.</Label><Input type="number" size={1} value={d.precioUnitario} onChange={e => { const n = [...detalles]; n[i].precioUnitario = parseFloat(e.target.value) || 0; setDetalles(n); }} /></div>
                  <div><Label className="text-[10px]">Desc.</Label><Input type="number" size={1} value={d.descuento} onChange={e => { const n = [...detalles]; n[i].descuento = parseFloat(e.target.value) || 0; setDetalles(n); }} /></div>
                  <div><Label className="text-[10px]">IVA</Label>
                    <select value={d.iva} onChange={e => { const n = [...detalles]; n[i].iva = e.target.value; setDetalles(n); }} className="h-8 rounded-lg border border-input bg-transparent px-1 text-xs w-full">{COD_IVA.map(iv => <option key={iv.value} value={iv.value}>{iv.label}</option>)}</select>
                  </div>
                  <div className="flex items-end"><Button variant="destructive" size="xs" onClick={() => eliminarDetalle(i)} disabled={detalles.length <= 1}>×</Button></div>
                </div>
              ))}
              {totales && (
                <div className="bg-slate-50 rounded-lg p-3 flex gap-6 text-xs font-mono mt-2">
                  <span>Sin Imp: <strong>${totales.sinImp.toFixed(2)}</strong></span>
                  <span>IVA: <strong>${totales.conIVA.toFixed(2)}</strong></span>
                  <span>Total: <strong>${totales.total.toFixed(2)}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* === FACTURA-SPECIFIC: PROPINA + PAGO === */}
          {t === '01' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5"><Label>Propina</Label><Input type="number" value={propina} onChange={e => setPropina(parseFloat(e.target.value) || 0)} /></div>
              <div className="flex flex-col gap-1.5"><Label>Forma de Pago</Label>
                <select value={formaPago} onChange={e => setFormaPago(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">{FORMA_PAGO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
              </div>
            </div>
          )}

          {/* === NC/ND: DOCUMENTO MODIFICADO === */}
          {(t === '04' || t === '05') && (
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Documento Modificado</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1.5"><Label>Tipo</Label>
                  <select value={docModTipo} onChange={e => setDocModTipo(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                    <option value="01">Factura</option><option value="04">Nota de Crédito</option><option value="05">Nota de Débito</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5"><Label>Número</Label><Input value={docModNumero} onChange={e => setDocModNumero(e.target.value)} placeholder="001-001-000000001" /></div>
                <div className="flex flex-col gap-1.5"><Label>Fecha emisión</Label><Input type="date" value={docModFecha} onChange={e => setDocModFecha(e.target.value)} /></div>
              </div>
              {t === '04' && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5"><Label>Motivo</Label>
                    <select value={codMotivoNC} onChange={e => setCodMotivoNC(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">{COD_MOTIVO_NC.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
                  </div>
                  <div className="flex flex-col gap-1.5"><Label>Descripción del motivo</Label><Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Detalle" /></div>
                </div>
              )}
              {t === '05' && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2"><h4 className="text-xs font-bold uppercase text-slate-500">Motivos de Débito</h4><Button variant="outline" size="xs" onClick={agregarMotivoND}>+ Motivo</Button></div>
                  {motivosND.map((m, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                      <div className="flex flex-col gap-1.5"><Label className="text-[10px]">Razón</Label><Input value={m.razon} onChange={e => { const n = [...motivosND]; n[i].razon = e.target.value; setMotivosND(n); }} placeholder="Interés por mora" /></div>
                      <div className="flex flex-col gap-1.5"><Label className="text-[10px]">Valor</Label><Input type="number" value={m.valor} onChange={e => { const n = [...motivosND]; n[i].valor = parseFloat(e.target.value) || 0; setMotivosND(n); }} /></div>
                      {motivosND.length > 1 && <div className="flex items-end"><Button variant="destructive" size="xs" onClick={() => setMotivosND(motivosND.filter((_, idx) => idx !== i))}>×</Button></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* === RETENCIÓN: IMPUESTOS === */}
          {t === '07' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1.5"><Label>Período Fiscal</Label><Input type="month" value={periodoFiscal} onChange={e => setPeriodoFiscal(e.target.value)} /></div>
              </div>
              <div className="flex items-center justify-between mb-3"><h4 className="text-xs font-bold uppercase text-slate-500">Retenciones</h4><Button variant="outline" size="xs" onClick={agregarRetencion}>+ Retención</Button></div>
              {retenciones.map((r, i) => {
                const tipoRet = COD_RETENCION.find(rt => rt.codigo === r.codigo);
                return (
                  <div key={i} className="border border-slate-200 rounded-lg p-3 grid grid-cols-2 md:grid-cols-5 gap-3 mb-2">
                    <div className="flex flex-col gap-1"><Label className="text-[10px]">Tipo</Label>
                      <select value={r.codigo} onChange={e => handleRetencionChange(i, 'codigo', e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs">{COD_RETENCION.map(rt => <option key={rt.codigo} value={rt.codigo}>{rt.label}</option>)}</select>
                    </div>
                    <div className="flex flex-col gap-1 col-span-2"><Label className="text-[10px]">Concepto</Label>
                      <select value={r.codigoRetencion} onChange={e => handleRetencionChange(i, 'codigoRetencion', e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs">
                        {(tipoRet?.retenciones || []).map((re: any) => <option key={re.codigoRetencion} value={re.codigoRetencion}>{re.label} ({re.porcentaje}%)</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1"><Label className="text-[10px]">Base Imponible</Label><Input type="number" size={1} value={r.baseImponible} onChange={e => handleRetencionChange(i, 'baseImponible', parseFloat(e.target.value) || 0)} /></div>
                    <div className="flex flex-col gap-1"><Label className="text-[10px]">Valor Ret.</Label><Input type="number" size={1} value={r.valorRetenido} disabled className="text-xs" /></div>
                    {retenciones.length > 1 && <div className="flex items-end"><Button variant="destructive" size="xs" onClick={() => eliminarRetencion(i)}>×</Button></div>}
                  </div>
                );
              })}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="flex flex-col gap-1.5"><Label>Doc. Sustento (código)</Label>
                  <select value={retenciones[0]?.codDocSustento} onChange={e => handleRetencionChange(0, 'codDocSustento', e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                    <option value="01">Factura</option><option value="04">Nota de Crédito</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5"><Label>Doc. Sustento (número)</Label><Input value={retenciones[0]?.numDocSustento} onChange={e => handleRetencionChange(0, 'numDocSustento', e.target.value)} placeholder="001-001-000000001" /></div>
                <div className="flex flex-col gap-1.5"><Label>Fecha doc. sustento</Label><Input type="date" value={retenciones[0]?.fechaEmisionDocSustento} onChange={e => handleRetencionChange(0, 'fechaEmisionDocSustento', e.target.value)} /></div>
              </div>
            </div>
          )}

          {/* === GUÍA DE REMISIÓN === */}
          {t === '06' && (
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Transportista</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div className="col-span-2"><Label>Tipo ID</Label>
                  <select value={transportista.tipoIdentificacion} onChange={e => setTransportista({ ...transportista, tipoIdentificacion: e.target.value })} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">{TIPOS_ID.map(ti => <option key={ti.value} value={ti.value}>{ti.label}</option>)}</select>
                </div>
                <div className="col-span-2"><Label>RUC/ID Transportista</Label><Input value={transportista.identificacion} onChange={e => setTransportista({ ...transportista, identificacion: e.target.value })} placeholder="Número" /></div>
                <div><Label>Razón Social</Label><Input value={transportista.razonSocial} onChange={e => setTransportista({ ...transportista, razonSocial: e.target.value })} placeholder="Nombre" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div><Label>Placa</Label><Input value={transportista.placa} onChange={e => setTransportista({ ...transportista, placa: e.target.value })} placeholder="ABC-1234" /></div>
                <div><Label>Fecha inicio transporte</Label><Input type="date" value={fechaIniTransporte} onChange={e => setFechaIniTransporte(e.target.value)} /></div>
                <div><Label>Fecha fin transporte</Label><Input type="date" value={fechaFinTransporte} onChange={e => setFechaFinTransporte(e.target.value)} /></div>
              </div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Destinatarios</h4>
              <Button variant="outline" size="xs" onClick={agregarDestinatario} className="mb-2">+ Destinatario</Button>
              {destinatarios.map((d, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-3 mb-2">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-2">
                    <div><Label className="text-[10px]">ID Destinatario</Label><Input size={1} value={d.identificacion} onChange={e => { const n = [...destinatarios]; n[i].identificacion = e.target.value; setDestinatarios(n); }} /></div>
                    <div><Label className="text-[10px]">Razón Social</Label><Input size={1} value={d.razonSocial} onChange={e => { const n = [...destinatarios]; n[i].razonSocial = e.target.value; setDestinatarios(n); }} /></div>
                    <div><Label className="text-[10px]">Dir. Destino</Label><Input size={1} value={d.dirDestino} onChange={e => { const n = [...destinatarios]; n[i].dirDestino = e.target.value; setDestinatarios(n); }} /></div>
                    <div><Label className="text-[10px]">Motivo</Label><Input size={1} value={d.motivoTraslado} onChange={e => { const n = [...destinatarios]; n[i].motivoTraslado = e.target.value; setDestinatarios(n); }} placeholder="Venta" /></div>
                    <div><Label className="text-[10px]">Doc. Sustento</Label><Input size={1} value={d.numDocSustento} onChange={e => { const n = [...destinatarios]; n[i].numDocSustento = e.target.value; setDestinatarios(n); }} /></div>
                  </div>
                  {destinatarios.length > 1 && <Button variant="destructive" size="xs" onClick={() => setDestinatarios(destinatarios.filter((_, idx) => idx !== i))}>Eliminar destinatario</Button>}
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleEmitir} disabled={emitiendo || !emisorRuc || !identificacion || !razonSocial} className="bg-brand-navy hover:bg-brand-navy-light text-white self-start px-8">
            {emitiendo ? 'Emitiendo...' : `Emitir ${selectedTipo.label}`}
          </Button>
        </Card>

        {resultado && <Card className="p-4"><h4 className="text-xs font-bold text-slate-700 mb-2">Resultado:</h4><pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">{JSON.stringify(resultado, null, 2)}</pre></Card>}
      </main>
    </>
  );
}
