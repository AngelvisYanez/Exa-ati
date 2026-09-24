"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuth } from "@/contexts/AuthContext";
import { sriClient } from "@/lib/sriClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ShoppingCart, Package, TrendingUp, Clock,
  CheckCircle, AlertCircle, Send, ExternalLink, RefreshCw
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { apiFetch } from "@/lib/apiFetch";
const ESTADO_COLORS: Record<string, string> = {
  AUTORIZADO: 'bg-success-pale text-success',
  EN_PROCESO: 'bg-amber-100 text-amber-800',
  FIRMADO: 'bg-sky-100 text-brand-sky',
  RECHAZADO: 'bg-red-100 text-brand-red',
  PENDIENTE: 'bg-brand-gray-100 text-brand-gray-600',
};

export default function EcommerceDashboardPage() {
  const { hasSriLinked } = useAuth();
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState<string | null>(null);

  async function loadFacturas() {
    setLoading(true);
    try {
      const token = localStorage.getItem('sri_access_token');
      const res = await apiFetch('/api/ecommerce/invoices?limit=20', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setFacturas(data.data || []);
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (hasSriLinked) loadFacturas();
    else setLoading(false);
  }, [hasSriLinked]);

  async function handleSendEmail(claveAcceso: string) {
    setEnviando(claveAcceso);
    try {
      const token = localStorage.getItem('sri_access_token');
      const res = await apiFetch(`/api/ecommerce/invoices/${claveAcceso}/send-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) toast.success('Email enviado correctamente');
      else toast.error(data.message || 'Error al enviar email');
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar email');
    } finally {
      setEnviando(null);
    }
  }

  const autorizadas = facturas.filter(f => f.estado === 'AUTORIZADO');
  const pendientes = facturas.filter(f => f.estado !== 'AUTORIZADO');
  const totalVentas = autorizadas.reduce((s, f) => s + parseFloat(f.importe_total || 0), 0);

  if (!hasSriLinked) {
    return (
      <>
        <title>eCommerce - EXA ATI</title>
        <Topbar title="eCommerce" />
        <main className="ui-page flex-1">
          <EmptyState
            icon={<ShoppingCart className="w-5 h-5" />}
            title="Vincula tu RUC del SRI en Configuración para usar el módulo eCommerce."
          />
        </main>
      </>
    );
  }

  return (
    <>
      <title>eCommerce - EXA ATI</title>
      <Topbar title="Facturación eCommerce" />
      <main className="ui-page flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-success-pale flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-brand-gray-500 font-bold uppercase">Facturadas</p>
              <p className="text-xl font-bold text-brand-gray-900">{autorizadas.length}</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-brand-gray-500 font-bold uppercase">Pendientes</p>
              <p className="text-xl font-bold text-brand-gray-900">{pendientes.length}</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-brand-sky" />
            </div>
            <div>
              <p className="text-xs text-brand-gray-500 font-bold uppercase">Total Ventas</p>
              <p className="text-xl font-bold text-brand-gray-900">${totalVentas.toFixed(2)}</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-violet-700" />
            </div>
            <div>
              <p className="text-xs text-brand-gray-500 font-bold uppercase">Total</p>
              <p className="text-xl font-bold text-brand-gray-900">{facturas.length}</p>
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase text-brand-gray-500 tracking-wider">Facturas Recientes</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadFacturas}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualizar
            </Button>
            <Link href="/ecommerce/facturar">
              <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white">
                Nueva Factura
              </Button>
            </Link>
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="w-full text-xs">
              <TableHeader>
                <TableRow className="bg-brand-gray-50 border-b border-brand-gray-200">
                  <TableHead className="text-left p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Factura</TableHead>
                  <TableHead className="text-left p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Cliente</TableHead>
                  <TableHead className="text-left p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Email</TableHead>
                  <TableHead className="text-right p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Total</TableHead>
                  <TableHead className="text-center p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Estado</TableHead>
                  <TableHead className="text-center p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="p-6"><TableSkeleton rows={4} columns={6} /></TableCell></TableRow>
                ) : facturas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        icon={<ShoppingCart className="w-5 h-5" />}
                        title="No hay facturas eCommerce."
                        action={<Link href="/ecommerce/facturar" className="text-brand-red underline">Crear primera factura</Link>}
                        compact
                      />
                    </TableCell>
                  </TableRow>
                ) : facturas.map((f) => (
                  <TableRow key={f.id} className="border-b border-brand-gray-100 hover:bg-brand-gray-50">
                    <TableCell className="p-3">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold">{f.serie}-{f.secuencial}</span>
                        <span className="text-[10px] text-brand-gray-400">{f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-EC') : '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3 font-medium">{f.receptor_razon_social || '—'}</TableCell>
                    <TableCell className="p-3 text-brand-gray-500">{f.receptor_email || '—'}</TableCell>
                    <TableCell className="p-3 text-right font-mono font-bold">${parseFloat(f.importe_total || 0).toFixed(2)}</TableCell>
                    <TableCell className="p-3 text-center">
                      <Badge className={`${ESTADO_COLORS[f.estado] || 'bg-brand-gray-100 text-brand-gray-600'} text-[10px]`}>
                        {f.estado === 'AUTORIZADO' ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <AlertCircle className="w-3 h-3 inline mr-1" />}
                        {f.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-3 text-center">
                      {f.estado === 'AUTORIZADO' ? (
                        <Button variant="ghost" size="xs" onClick={() => handleSendEmail(f.clave_acceso)}
                          disabled={enviando === f.clave_acceso}>
                          <Send className={`w-3.5 h-3.5 ${enviando === f.clave_acceso ? 'animate-pulse' : ''}`} />
                        </Button>
                      ) : (
                        <span className="text-brand-gray-300">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </main>
    </>
  );
}
