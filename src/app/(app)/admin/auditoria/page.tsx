"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, ChevronLeft, ChevronRight, Download, FileText, FileSpreadsheet } from "lucide-react";

interface LogEntry {
  id: number;
  usuarioEmail: string;
  accion: string;
  recurso: string;
  descripcion: string;
  exitoso: boolean;
  createdAt: string;
}

interface Filtros {
  acciones: string[];
  recursos: string[];
}

const ACCION_COLOR: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPDATE: "bg-blue-50 text-blue-700 border-blue-200",
  DELETE: "bg-red-50 text-red-700 border-red-200",
  LOGIN: "bg-purple-50 text-purple-700 border-purple-200",
  SYNC: "bg-amber-50 text-amber-700 border-amber-200",
  EMITIR: "bg-sky-50 text-sky-700 border-sky-200",
};

export default function AdminAuditoriaPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filtros, setFiltros] = useState<Filtros>({ acciones: [], recursos: [] });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const [accionFilter, setAccionFilter] = useState("");
  const [recursoFilter, setRecursoFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [desdeFilter, setDesdeFilter] = useState("");
  const [hastaFilter, setHastaFilter] = useState("");

  const buildUrl = useCallback((p: number) => {
    const params = new URLSearchParams();
    if (accionFilter) params.set("accion", accionFilter);
    if (recursoFilter) params.set("recurso", recursoFilter);
    if (emailFilter.trim()) params.set("email", emailFilter.trim());
    if (desdeFilter) params.set("desde", desdeFilter);
    if (hastaFilter) params.set("hasta", hastaFilter);
    params.set("page", String(p));
    params.set("pageSize", String(pageSize));
    return `/api/admin/auditoria?${params}`;
  }, [accionFilter, recursoFilter, emailFilter, desdeFilter, hastaFilter]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(buildUrl(page));
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setLogs(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      if (data.filtros) setFiltros(data.filtros);
    } catch {
      toast.error("Error al cargar logs");
    } finally {
      setLoading(false);
    }
  }, [buildUrl, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [accionFilter, recursoFilter, emailFilter, desdeFilter, hastaFilter]);

  const handleExport = async (format: "csv" | "pdf") => {
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      if (accionFilter) params.set("accion", accionFilter);
      if (recursoFilter) params.set("recurso", recursoFilter);
      if (emailFilter.trim()) params.set("email", emailFilter.trim());
      if (desdeFilter) params.set("desde", desdeFilter);
      if (hastaFilter) params.set("hasta", hastaFilter);

      const res = await fetch(`/api/admin/auditoria/export?${params}`);
      if (!res.ok) throw new Error("Error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auditoria.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exportado como ${format.toUpperCase()}`);
    } catch {
      toast.error("Error al exportar");
    }
  };

  const formatFecha = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-EC", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <>
      <title>Auditoría - Admin - OFSERCONT IA</title>
      <Topbar title="Auditoría del Sistema" backLink={{ href: "/admin", label: "Admin" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Auditoría</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Registro de eventos del sistema ({total} registros)</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              className="text-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              className="text-xs"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <select
            value={accionFilter}
            onChange={(e) => setAccionFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          >
            <option value="">Todas las acciones</option>
            {filtros.acciones.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <select
            value={recursoFilter}
            onChange={(e) => setRecursoFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          >
            <option value="">Todos los recursos</option>
            {filtros.recursos.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray-400" />
            <Input
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              placeholder="Email usuario..."
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Input
            type="date"
            value={desdeFilter}
            onChange={(e) => setDesdeFilter(e.target.value)}
            className="h-8 text-xs"
            title="Desde"
          />

          <Input
            type="date"
            value={hastaFilter}
            onChange={(e) => setHastaFilter(e.target.value)}
            className="h-8 text-xs"
            title="Hasta"
          />
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-brand-gray-500 animate-pulse">Cargando logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center text-sm text-brand-gray-400">No se encontraron registros.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-brand-gray-100 text-[9px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <th className="py-2.5 px-3 font-semibold">Fecha</th>
                    <th className="py-2.5 px-3 font-semibold">Usuario</th>
                    <th className="py-2.5 px-3 font-semibold">Acción</th>
                    <th className="py-2.5 px-3 font-semibold">Recurso</th>
                    <th className="py-2.5 px-3 font-semibold">Descripción</th>
                    <th className="py-2.5 px-3 font-semibold">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gray-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <td className="py-2.5 px-3 text-[11px] text-brand-gray-500 whitespace-nowrap">
                        {formatFecha(log.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-brand-gray-700 max-w-[130px] truncate">
                        {log.usuarioEmail || "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${ACCION_COLOR[log.accion] || "bg-brand-gray-100 text-brand-gray-600 border-brand-gray-200"}`}>
                          {log.accion}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-brand-gray-500 text-[11px]">{log.recurso || "—"}</td>
                      <td className="py-2.5 px-3 text-brand-gray-500 text-[11px] max-w-[250px] truncate">
                        {log.descripcion || "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        {log.exitoso ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Éxito
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                            Error
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-brand-gray-500">
            <span>Página {page} de {totalPages} ({total} resultados)</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-gray-200 hover:bg-brand-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-3 h-3" /> Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-gray-200 hover:bg-brand-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Siguiente <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
