"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import ListToolbar from "@/components/lists/ListToolbar";
import { RecordCard, RecordGrid } from "@/components/lists/RecordGrid";
import { useViewMode } from "@/components/lists/useViewMode";
import { Search, FileText, Download, Eye, RefreshCw } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";
const ESTADO_COLORS: Record<string, string> = {
  AUTORIZADO: "bg-success-pale text-success",
  EN_PROCESO: "bg-brand-amber-pale text-brand-amber",
  FIRMADO: "bg-brand-sky/15 text-brand-sky",
  RECHAZADO: "bg-brand-red-subtle text-brand-red",
  PENDIENTE: "bg-brand-gray-100 text-brand-gray-600",
  DEVUELTA: "bg-brand-amber-pale text-brand-amber",
  ANULADO: "bg-brand-gray-100 text-brand-gray-600",
};

export default function PosVentasPage() {
  const { hasSriLinked } = useAuth();
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useViewMode("ventas-pos");
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

      const res = await apiFetch(`/api/sri/pos?${params.toString()}`, {
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
        <main className="ui-page flex-1 w-full">
          <EmptyState
            icon={<FileText className="w-5 h-5" />}
            title="Vincula tu RUC del SRI para ver las ventas POS."
          />
        </main>
      </>
    );
  }

  return (
    <>
      <title>Ventas POS - EXA ATI</title>
      <Topbar title="Historial de Ventas POS" />
      <main className="ui-page flex-1">
        <Card className="p-4">
          <form onSubmit={handleSearch}>
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              placeholder="Cliente, RUC, secuencial..."
              view={view}
              onViewChange={setView}
            >
              <div>
                <label className="text-[10px] font-bold uppercase text-brand-gray-500">Desde</label>
                <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-brand-gray-500">Hasta</label>
                <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="h-8 text-xs mt-1" />
              </div>
              <Button type="submit" variant="outline" size="sm" className="h-8">
                <Search className="w-3.5 h-3.5 mr-1" /> Filtrar
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => loadVentas()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </ListToolbar>
          </form>
        </Card>

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-6"><TableSkeleton rows={4} columns={6} /></div>
          ) : ventas.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-5 h-5" />}
              title="No hay ventas POS registradas"
              compact
            />
          ) : view === "lista" ? (
          <div className="overflow-x-auto">
            <Table className="w-full text-xs">
              <TableHeader>
                <TableRow className="bg-brand-gray-50 border-b border-brand-gray-200">
                  <TableHead className="text-left p-3 font-bold text-brand-gray-500 uppercase tracking-wider">#</TableHead>
                  <TableHead className="text-left p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Fecha</TableHead>
                  <TableHead className="text-left p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Cliente</TableHead>
                  <TableHead className="text-left p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Identificación</TableHead>
                  <TableHead className="text-right p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Total</TableHead>
                  <TableHead className="text-center p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Estado</TableHead>
                  <TableHead className="text-center p-3 font-bold text-brand-gray-500 uppercase tracking-wider">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.map((v, i) => (
                  <TableRow key={v.id} className="border-b border-brand-gray-100 hover:bg-brand-gray-50">
                    <TableCell className="p-3 font-mono text-brand-gray-500">{((meta.page - 1) * 20) + i + 1}</TableCell>
                    <TableCell className="p-3">{v.fecha_emision ? new Date(v.fecha_emision).toLocaleDateString('es-EC') : '—'}</TableCell>
                    <TableCell className="p-3 font-medium">{v.receptor_razon_social || '—'}</TableCell>
                    <TableCell className="p-3 font-mono text-brand-gray-500">{v.receptor_identificacion || '—'}</TableCell>
                    <TableCell className="p-3 text-right font-mono font-bold">${parseFloat(v.importe_total || 0).toFixed(2)}</TableCell>
                    <TableCell className="p-3 text-center">
                      <Badge className={`${ESTADO_COLORS[v.estado] || 'bg-brand-gray-100 text-brand-gray-600'} text-[10px]`}>
                        {v.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <a href={getPdfUrl(v.clave_acceso)} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-md hover:bg-brand-gray-100 text-brand-gray-500 hover:text-brand-gray-800 transition-colors"
                          title="Ver RIDE">
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                        <a href={getPdfUrl(v.clave_acceso)} download
                          className="p-1.5 rounded-md hover:bg-brand-gray-100 text-brand-gray-500 hover:text-brand-gray-800 transition-colors"
                          title="Descargar PDF">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          ) : (
            <div className="p-3">
              <RecordGrid>
                {ventas.map((v, i) => (
                  <RecordCard
                    key={v.id}
                    title={v.receptor_razon_social || "—"}
                    subtitle={v.receptor_identificacion || "—"}
                    fields={[
                      { label: "#", value: ((meta.page - 1) * 20) + i + 1 },
                      { label: "Fecha", value: v.fecha_emision ? new Date(v.fecha_emision).toLocaleDateString("es-EC") : "—" },
                      { label: "Total", value: `$${parseFloat(v.importe_total || 0).toFixed(2)}` },
                      { label: "Estado", value: v.estado },
                    ]}
                    actions={
                      <div className="flex items-center gap-1">
                        <a href={getPdfUrl(v.clave_acceso)} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-md hover:bg-brand-gray-100 text-brand-gray-500 hover:text-brand-gray-800 transition-colors"
                          title="Ver RIDE">
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                        <a href={getPdfUrl(v.clave_acceso)} download
                          className="p-1.5 rounded-md hover:bg-brand-gray-100 text-brand-gray-500 hover:text-brand-gray-800 transition-colors"
                          title="Descargar PDF">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    }
                  />
                ))}
              </RecordGrid>
            </div>
          )}
        </Card>

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => loadVentas(p)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer
                  ${p === meta.page ? 'bg-brand-red text-white' : 'bg-brand-gray-100 text-brand-gray-600 hover:bg-brand-gray-200'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
