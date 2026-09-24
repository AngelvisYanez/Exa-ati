"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "sonner";
import {
  Plus, Search, X, Check, Wallet, Clock, AlertTriangle, HandCoins,
  Banknote, Trash2, Eye
} from "lucide-react";

type TipoCuenta = "COBRAR" | "PAGAR";

interface CuentaRow {
  id: string;
  tipo_documento: string;
  numero_documento: string | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  cliente_identificacion?: string | null;
  cliente_nombre?: string | null;
  cliente_email?: string | null;
  proveedor_identificacion?: string | null;
  proveedor_nombre?: string | null;
  proveedor_email?: string | null;
  monto_original: string;
  saldo_pendiente: string;
  pago_total?: string | null;
  estado: string;
  notas: string | null;
}

interface PagoRow {
  id: string;
  fecha: string;
  monto: string;
  metodo_pago: string | null;
  referencia: string | null;
  notas: string | null;
}

const ESTADOS = [
  { value: "TODOS", label: "Todos" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "PARCIAL", label: "Parcial" },
  { value: "VENCIDO", label: "Vencido" },
  { value: "PAGADO", label: "Pagado" },
  { value: "ANULADO", label: "Anulado" },
];

const METODOS_PAGO = [
  "EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE", "DEPOSITO", "BANCO", "OTRO",
];

function num(v: any): number {
  return Number(v ?? 0);
}

function fmtFecha(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function estadoBadge(estado: string): string {
  switch (estado) {
    case "PAGADO": return "bg-success-pale text-success";
    case "PARCIAL": return "bg-amber-100 text-amber-800";
    case "VENCIDO": return "bg-red-100 text-brand-red";
    case "ANULADO": return "bg-brand-gray-100 text-brand-gray-500";
    default: return "bg-sky-100 text-brand-sky";
  }
}

interface Props {
  tipo: TipoCuenta;
}

const basePath = (tipo: TipoCuenta) =>
  tipo === "COBRAR" ? "/api/cuentas-por-cobrar" : "/api/cuentas-por-pagar";

const sustantivo = (tipo: TipoCuenta) =>
  tipo === "COBRAR" ? "Cobrar" : "Pagar";

const labelContraparte = (tipo: TipoCuenta) =>
  tipo === "COBRAR" ? "Cliente" : "Proveedor";

export default function CuentasModule({ tipo }: Props) {
  const { hasSriLinked } = useAuth();
  const [rows, setRows] = useState<CuentaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState("TODOS");
  const [termino, setTermino] = useState("");
  const [resumen, setResumen] = useState<any>(null);
  const [aging, setAging] = useState<{ buckets: { key: string; label: string; monto: number; cuentas: number }[]; total: number } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    tipoIdentificacion: tipo === "COBRAR" ? "05" : "04",
    identificacion: "",
    nombre: "",
    email: "",
    tipoDocumento: "01",
    numeroDocumento: "",
    fechaEmision: new Date().toISOString().split("T")[0],
    fechaVencimiento: "",
    monto: "",
    notas: "",
  });
  const [saving, setSaving] = useState(false);

  const [pagoCuenta, setPagoCuenta] = useState<CuentaRow | null>(null);
  const [pagoForm, setPagoForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    monto: "",
    metodoPago: "EFECTIVO",
    referencia: "",
    notas: "",
  });
  const [pagoSaving, setPagoSaving] = useState(false);
  const [pagosVisible, setPagosVisible] = useState<CuentaRow | null>(null);
  const [pagos, setPagos] = useState<PagoRow[]>([]);

  const loadResumen = useCallback(async () => {
    try {
      const token = localStorage.getItem("sri_access_token");
      const res = await apiFetch(`${basePath(tipo)}?resumen=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setResumen(tipo === "COBRAR" ? data.porCobrar : data.porPagar);
      }
    } catch {}
  }, [tipo]);

  const loadAging = useCallback(async () => {
    try {
      const token = localStorage.getItem("sri_access_token");
      const res = await apiFetch(`${basePath(tipo)}/aging`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAging({ buckets: data.buckets || [], total: data.total || 0 });
      }
    } catch {}
  }, [tipo]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("sri_access_token");
      const params = new URLSearchParams();
      if (estado && estado !== "TODOS") params.set("estado", estado);
      if (termino) params.set("identificacion", termino);
      const res = await apiFetch(`${basePath(tipo)}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRows(data.data || []);
        setTotal(data.total || 0);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [tipo, estado, termino]);

  useEffect(() => {
    if (hasSriLinked) {
      loadRows();
      loadResumen();
      loadAging();
    } else {
      setLoading(false);
    }
  }, [hasSriLinked, loadRows, loadResumen, loadAging]);

  async function handleCreate() {
    if (!form.identificacion || !form.nombre) {
      toast.error(`Identificación y nombre del ${labelContraparte(tipo).toLowerCase()} son obligatorios`);
      return;
    }
    if (!form.monto || num(form.monto) <= 0) {
      toast.error("El monto debe ser mayor a cero");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(basePath(tipo), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          monto: num(form.monto),
          fechaVencimiento: form.fechaVencimiento || undefined,
          numeroDocumento: form.numeroDocumento || undefined,
          email: form.email || undefined,
          notas: form.notas || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(`Cuenta por ${sustantivo(tipo).toLowerCase()} creada`);
      setShowForm(false);
      setForm({
        tipoIdentificacion: tipo === "COBRAR" ? "05" : "04",
        identificacion: "",
        nombre: "",
        email: "",
        tipoDocumento: "01",
        numeroDocumento: "",
        fechaEmision: new Date().toISOString().split("T")[0],
        fechaVencimiento: "",
        monto: "",
        notas: "",
      });
      loadRows();
      loadResumen();
      loadAging();
    } catch (err: any) {
      toast.error(err.message || "Error al crear la cuenta");
    } finally {
      setSaving(false);
    }
  }

  async function handlePago() {
    if (!pagoCuenta) return;
    if (!pagoForm.monto || num(pagoForm.monto) <= 0) {
      toast.error("El monto del pago debe ser mayor a cero");
      return;
    }
    setPagoSaving(true);
    try {
      const res = await apiFetch(`${basePath(tipo)}/${pagoCuenta.id}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: pagoForm.fecha,
          monto: num(pagoForm.monto),
          metodoPago: pagoForm.metodoPago,
          referencia: pagoForm.referencia || undefined,
          notas: pagoForm.notas || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(
        `Pago registrado: $${num(data.montoAplicado).toFixed(2)} · Saldo $${num(data.saldoPendiente).toFixed(2)}`
      );
      setPagoCuenta(null);
      setPagoForm({ fecha: new Date().toISOString().split("T")[0], monto: "", metodoPago: "EFECTIVO", referencia: "", notas: "" });
      loadRows();
      loadResumen();
      loadAging();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar el pago");
    } finally {
      setPagoSaving(false);
    }
  }

  async function verPagos(cuenta: CuentaRow) {
    setPagosVisible(cuenta);
    setPagos([]);
    try {
      const token = localStorage.getItem("sri_access_token");
      const res = await apiFetch(`${basePath(tipo)}/${cuenta.id}/pagos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPagos(data.data || []);
      }
    } catch {}
  }

  async function eliminar(cuenta: CuentaRow) {
    const msg =
      num(cuenta.pago_total) > 0
        ? "Esta cuenta tiene pagos registrados. Se anulará en lugar de eliminarse. ¿Continuar?"
        : "¿Eliminar esta cuenta?";
    if (!confirm(msg)) return;
    try {
      const res = await apiFetch(`${basePath(tipo)}/${cuenta.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      toast.success("Cuenta eliminada");
      loadRows();
      loadResumen();
      loadAging();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  }

  const sumSaldo = rows.reduce((acc, r) => acc + num(r.saldo_pendiente), 0);

  if (!hasSriLinked) {
    return (
      <main className="p-6 w-full text-center text-brand-gray-500">
        Vincula tu RUC del SRI en Configuración para gestionar cuentas por {sustantivo(tipo).toLowerCase()}.
      </main>
    );
  }

  const stats = [
    {
      label: `Por ${sustantivo(tipo)}`,
      value: resumen?.saldoPorCobrar ?? resumen?.saldoPorPagar ?? 0,
      icon: Wallet,
      color: "bg-sky-100 text-brand-sky",
      money: true,
    },
    {
      label: "Vencido",
      value: resumen?.saldoVencido ?? 0,
      icon: AlertTriangle,
      color: "bg-red-100 text-brand-red",
      money: true,
    },
    {
      label: "Pendientes",
      value: resumen?.pendientes ?? 0,
      icon: Clock,
      color: "bg-amber-100 text-amber-700",
      money: false,
    },
    {
      label: "Cuentas",
      value: resumen?.totalCuentas ?? 0,
      icon: Banknote,
      color: "bg-success-pale text-success",
      money: false,
    },
  ];

  return (
    <main className="ui-page flex-1">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray-400" />
          <Input
            size={1}
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            placeholder={`Buscar por ${labelContraparte(tipo).toLowerCase()} (RUC/Cédula)...`}
            className="h-8 text-xs pl-8"
          />
        </div>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="h-8 text-xs rounded-lg border border-input bg-transparent px-2.5"
        >
          {ESTADOS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={loadRows}>
          Actualizar
        </Button>
        <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white ml-auto" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nueva Cuenta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-brand-gray-500 font-bold uppercase">{s.label}</p>
                <p className="text-base font-bold font-mono truncate">
                  {s.money ? `$${num(s.value).toFixed(2)}` : String(Math.round(num(s.value)))}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Aging buckets */}
      {aging && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {aging.buckets.map((b) => (
            <Card key={b.key} className="p-3">
              <p className="text-[10px] text-brand-gray-500 font-bold uppercase">Antigüedad {b.label}</p>
              <p className="text-base font-bold font-mono mt-1">${num(b.monto).toFixed(2)}</p>
              <p className="text-[10px] text-brand-gray-400 mt-0.5">{b.cuentas} cuenta(s)</p>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full text-xs">
            <TableHeader>
              <TableRow className="bg-brand-gray-50 border-b border-brand-gray-200">
                <TableHead className="text-left p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Documento</TableHead>
                <TableHead className="text-left p-3 font-bold text-brand-gray-500 uppercase tracking-wider">{labelContraparte(tipo)}</TableHead>
                <TableHead className="text-left p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Emisión</TableHead>
                <TableHead className="text-left p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Vencimiento</TableHead>
                <TableHead className="text-right p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Monto</TableHead>
                <TableHead className="text-right p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Saldo</TableHead>
                <TableHead className="text-center p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Estado</TableHead>
                <TableHead className="text-center p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="p-6"><TableSkeleton rows={4} columns={6} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-6">
                    <EmptyState
                      icon={<Wallet className="w-5 h-5" />}
                      title={`No hay cuentas por ${sustantivo(tipo).toLowerCase()}`}
                      description={`Registra una cuenta o emite una factura a crédito para generar cuentas por ${sustantivo(tipo).toLowerCase()} automáticamente.`}
                    />
                  </TableCell>
                </TableRow>
              ) : rows.map((r) => {
                const contraparte = tipo === "COBRAR" ? r.cliente_nombre : r.proveedor_nombre;
                const identificacion = tipo === "COBRAR" ? r.cliente_identificacion : r.proveedor_identificacion;
                return (
                  <TableRow key={r.id} className="border-b border-brand-gray-100 hover:bg-brand-gray-50">
                    <TableCell className="p-3">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold">{r.numero_documento || "—"}</span>
                        <span className="text-[10px] text-brand-gray-400">Tipo {r.tipo_documento}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{contraparte || "—"}</span>
                        <span className="text-[10px] text-brand-gray-400 font-mono">{identificacion || ""}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3">{fmtFecha(r.fecha_emision)}</TableCell>
                    <TableCell className="p-3">
                      <span className={num(r.saldo_pendiente) > 0 && r.estado === "VENCIDO" ? "text-brand-red font-bold" : ""}>
                        {fmtFecha(r.fecha_vencimiento)}
                      </span>
                    </TableCell>
                    <TableCell className="p-3 text-right font-mono font-bold">${num(r.monto_original).toFixed(2)}</TableCell>
                    <TableCell className="p-3 text-right font-mono font-bold">
                      <span className={num(r.saldo_pendiente) > 0 && r.estado === "VENCIDO" ? "text-brand-red" : ""}>
                        ${num(r.saldo_pendiente).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="p-3 text-center">
                      <Badge className={estadoBadge(r.estado)}>{r.estado}</Badge>
                    </TableCell>
                    <TableCell className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        {r.estado !== "PAGADO" && r.estado !== "ANULADO" && (
                          <Button variant="ghost" size="xs" title="Registrar pago" onClick={() => {
                            setPagoCuenta(r);
                            setPagoForm({ fecha: new Date().toISOString().split("T")[0], monto: num(r.saldo_pendiente).toFixed(2), metodoPago: "EFECTIVO", referencia: "", notas: "" });
                          }}>
                            <HandCoins className="w-3.5 h-3.5 text-success" />
                          </Button>
                        )}
                        <Button variant="ghost" size="xs" title="Ver pagos" onClick={() => verPagos(r)}>
                          <Eye className="w-3.5 h-3.5 text-brand-gray-500" />
                        </Button>
                        <Button variant="ghost" size="xs" title="Eliminar / Anular" onClick={() => eliminar(r)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {!loading && (
          <div className="px-4 py-2 border-t border-brand-gray-100 flex justify-between text-xs text-brand-gray-500">
            <span>{total} cuenta(s)</span>
            <span className="font-mono font-bold">Saldo total: ${sumSaldo.toFixed(2)}</span>
          </div>
        )}
      </Card>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-10 bg-black/30 overflow-y-auto">
          <Card className="w-full max-w-lg mx-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-brand-gray-600">
                Nueva Cuenta por {sustantivo(tipo)}
              </h3>
              <Button variant="ghost" size="xs" onClick={() => setShowForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px]">Tipo ID *</Label>
                <select
                  value={form.tipoIdentificacion}
                  onChange={(e) => setForm({ ...form, tipoIdentificacion: e.target.value })}
                  className="h-7 text-xs rounded-lg border border-input bg-transparent px-2 w-full"
                >
                  <option value="04">RUC</option>
                  <option value="05">Cédula</option>
                  <option value="06">Pasaporte</option>
                  <option value="07">Consumidor Final</option>
                </select>
              </div>
              <div>
                <Label className="text-[10px]">Identificación *</Label>
                <Input size={1} value={form.identificacion} onChange={(e) => setForm({ ...form, identificacion: e.target.value })} className="h-7 text-xs" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">{labelContraparte(tipo)} *</Label>
                <Input size={1} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="h-7 text-xs" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">Email</Label>
                <Input size={1} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-7 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Tipo Documento</Label>
                <select
                  value={form.tipoDocumento}
                  onChange={(e) => setForm({ ...form, tipoDocumento: e.target.value })}
                  className="h-7 text-xs rounded-lg border border-input bg-transparent px-2 w-full"
                >
                  <option value="01">Factura</option>
                  <option value="03">Liquidación</option>
                  <option value="04">Nota Crédito</option>
                  <option value="05">Nota Débito</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <Label className="text-[10px]">N° Documento</Label>
                <Input size={1} value={form.numeroDocumento} onChange={(e) => setForm({ ...form, numeroDocumento: e.target.value })} className="h-7 text-xs" placeholder="001-001-000000001" />
              </div>
              <div>
                <Label className="text-[10px]">Fecha Emisión *</Label>
                <Input type="date" size={1} value={form.fechaEmision} onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })} className="h-7 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Fecha Vencimiento</Label>
                <Input type="date" size={1} value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} className="h-7 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Monto *</Label>
                <Input type="number" size={1} min={0} step={0.01} value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className="h-7 text-xs" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">Notas</Label>
                <Input size={1} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="h-7 text-xs" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white" onClick={handleCreate} disabled={saving}>
                {saving ? "Guardando..." : <><Check className="w-3.5 h-3.5 mr-1" /> Crear Cuenta</>}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Payment modal */}
      {pagoCuenta && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-10 bg-black/30">
          <Card className="w-full max-w-md mx-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-brand-gray-600">
                Registrar Pago · {pagoCuenta.numero_documento || "Cuenta"}
              </h3>
              <Button variant="ghost" size="xs" onClick={() => setPagoCuenta(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="bg-brand-gray-50 rounded-lg p-3 mb-4 text-xs space-y-1">
              <p>{tipo === "COBRAR" ? pagoCuenta.cliente_nombre : pagoCuenta.proveedor_nombre}</p>
              <p className="font-mono">Saldo pendiente: <strong>${num(pagoCuenta.saldo_pendiente).toFixed(2)}</strong></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px]">Fecha</Label>
                <Input type="date" size={1} value={pagoForm.fecha} onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })} className="h-7 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Monto *</Label>
                <Input type="number" size={1} min={0} step={0.01} value={pagoForm.monto} onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })} className="h-7 text-xs" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">Método de Pago</Label>
                <select
                  value={pagoForm.metodoPago}
                  onChange={(e) => setPagoForm({ ...pagoForm, metodoPago: e.target.value })}
                  className="h-7 text-xs rounded-lg border border-input bg-transparent px-2 w-full"
                >
                  {METODOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">Referencia</Label>
                <Input size={1} value={pagoForm.referencia} onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })} className="h-7 text-xs" placeholder="N° transferencia, cheque..." />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">Notas</Label>
                <Input size={1} value={pagoForm.notas} onChange={(e) => setPagoForm({ ...pagoForm, notas: e.target.value })} className="h-7 text-xs" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setPagoCuenta(null)}>Cancelar</Button>
              <Button size="sm" className="bg-success hover:bg-success text-white" onClick={handlePago} disabled={pagoSaving}>
                {pagoSaving ? "Registrando..." : <><Banknote className="w-3.5 h-3.5 mr-1" /> Registrar Pago</>}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* View payments modal */}
      {pagosVisible && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-10 bg-black/30">
          <Card className="w-full max-w-md mx-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-brand-gray-600">
                Pagos · {pagosVisible.numero_documento || "Cuenta"}
              </h3>
              <Button variant="ghost" size="xs" onClick={() => setPagosVisible(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {pagos.length === 0 ? (
              <p className="text-xs text-brand-gray-400 text-center py-6">Sin pagos registrados</p>
            ) : (
              <div className="flex flex-col gap-2">
                {pagos.map((p) => (
                  <div key={p.id} className="bg-brand-gray-50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold">${num(p.monto).toFixed(2)}</p>
                      <p className="text-[10px] text-brand-gray-400">
                        {fmtFecha(p.fecha)} · {p.metodo_pago || "—"}
                        {p.referencia ? ` · ${p.referencia}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="text-right text-xs font-bold font-mono text-brand-gray-600 pt-1">
                  Total pagado: ${pagos.reduce((a, p) => a + num(p.monto), 0).toFixed(2)}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}
