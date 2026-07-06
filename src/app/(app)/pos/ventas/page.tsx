"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/Topbar";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, FileText, Download, Eye, RefreshCw } from "lucide-react";

const ESTADO_COLORS: Record<string, string> = {
  AUTORIZADO: 'bg-emerald-100 text-emerald-800',
  EN_PROCESO: 'bg-amber-100 text-amber-800',
  FIRMADO: 'bg-blue-100 text-blue-800',
  RECHAZADO: 'bg-red-100 text-red-800',
  PENDIENTE: 'bg-slate-100 text-slate-600',
};

export default function PosVentasPage() {
  const { hasSriLinked } = useAuth();
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });

  async function loadVentas(page = 1) {
    setLoading(true);
    try {
      const token = localStorage.getItem('sri_access_token');
      const params = new URLSearchParams();
      params.append('limit', '20');
      params.append('page', String(page));
      if (search) params.append('search', search);
      if (fechaDesde) params.append('fechaDesde', fechaDesde);
      if (fechaHasta) params.append('fechaHasta', fechaHasta);

      const res = await fetch(`/api/sri/pos?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setVentas(data.data);
        setMeta(data.meta);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (hasSriLinked) loadVentas();
    else setLoading(false);
  }, [hasSriLinked]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadVentas();
  }

  function getPdfUrl(claveAcceso: string) {
    return `/api/sri/comprobantes/${claveAcceso}/pdf`;
  }

  if (!hasSriLinked) {
    return (
      <>
        <title>Ventas POS - EXA ATI</title>
        <Topbar title="Historial de Ventas POS" />
        <main className="p-6 max-w-3xl mx-auto text-center text-slate-500">
          Vincula tu RUC del SRI para ver las ventas POS.
        </main>
      </>
    );
  }

  return (
    <>
      <title>Ventas POS - EXA ATI</title>
      <Topbar title="Historial de Ventas POS" />
      <main className="p-4 max-w-6xl mx-auto flex flex-col gap-4">
        <Card className="p-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-bold uppercase text-slate-500">Buscar</label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input size={1} value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Cliente, RUC, secuencial..." className="pl-8 h-8 text-xs" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Desde</label>
              <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Hasta</label>
              <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <Button type="submit" variant="outline" size="sm" className="h-8">
              <Search className="w-3.5 h-3.5 mr-1" /> Filtrar
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => loadVentas()}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </form>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3 font-bold text-slate-500 uppercase tracking-wider">#</th>
                  <th className="text-left p-3 font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="text-left p-3 font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="text-left p-3 font-bold text-slate-500 uppercase tracking-wider">Identificación</th>
                  <th className="text-right p-3 font-bold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="text-center p-3 font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="text-center p-3 font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-400">Cargando...</td></tr>
                ) : ventas.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-400">No hay ventas POS registradas</td></tr>
                ) : ventas.map((v, i) => (
                  <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-500">{((meta.page - 1) * 20) + i + 1}</td>
                    <td className="p-3">{v.fecha_emision ? new Date(v.fecha_emision).toLocaleDateString('es-EC') : '—'}</td>
                    <td className="p-3 font-medium">{v.receptor_razon_social || '—'}</td>
                    <td className="p-3 font-mono text-slate-500">{v.receptor_identificacion || '—'}</td>
                    <td className="p-3 text-right font-mono font-bold">${parseFloat(v.importe_total || 0).toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <Badge className={`${ESTADO_COLORS[v.estado] || 'bg-slate-100 text-slate-600'} text-[10px]`}>
                        {v.estado}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <a href={getPdfUrl(v.clave_acceso)} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                          title="Ver RIDE">
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                        <a href={getPdfUrl(v.clave_acceso)} download
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                          title="Descargar PDF">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => loadVentas(p)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer
                  ${p === meta.page ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
