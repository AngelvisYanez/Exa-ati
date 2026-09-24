"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import DateRangeFilter, {
  DateRange,
  formatDateRangeLabel,
  getDefaultDateRange,
  toDateRangeParams,
} from "@/components/DateRangeFilter";
import { sriClient } from "@/lib/sriClient";
import { useAuth } from "@/contexts/AuthContext";

type DeclaracionRow = {
  id: string;
  periodo: string;
  tipo: string;
  tramite: string;
  fecha: string;
  estado: string;
  iva: number;
};

import XmlImportZone from "@/components/XmlImportZone";
import Dialog from "@/components/ui/Dialog";
import { Upload, FileCode2 } from "lucide-react";
import { toast } from "sonner";

export default function ComprobantesPage() {
  const { activeRuc } = useAuth();
  const [comprobantes, setComprobantes] = useState<DeclaracionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadDeclaraciones = async (range = dateRange) => {
    if (!sriClient.isAuthenticated()) {
      setError("Inicia sesión para ver el historial de declaraciones.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await sriClient.getDeclaraciones(toDateRangeParams(range));
      if (res.success) {
        setComprobantes(res.data || []);
      }
    } catch (err: any) {
      setError(err.message || "Error al cargar declaraciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeRuc) return;
    loadDeclaraciones(dateRange);
  }, [dateRange, activeRuc]);

  const handleImportXmls = async (files: FileList) => {
    setImporting(true);
    try {
      const xmls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === "text/xml" || file.name.endsWith(".xml")) {
          const text = await file.text();
          xmls.push(text);
        }
      }

      if (xmls.length === 0) {
        throw new Error("No se seleccionaron archivos XML válidos.");
      }

      const res = await sriClient.importXmls(xmls);
      if (res.success) {
        toast.success(`¡Importación completada! ${res.importedCount} comprobantes cargados e recalculados en el sistema.`);
        setShowImportModal(false);
        await loadDeclaraciones();
      }
    } catch (err: any) {
      toast.error(err.message || "Error al importar archivos XML");
    } finally {
      setImporting(false);
    }
  };

  const totalIva = comprobantes.reduce((s, c) => s + c.iva, 0);
  const aceptadas = comprobantes.filter((c) => c.estado === "REGISTRADA" || c.estado === "ACEPTADA").length;

  return (
    <>
      <title>Comprobantes - OFSERCONT IA</title>
      <meta name="description" content="Historial de declaraciones presentadas al SRI con descarga de comprobantes." />

      <Topbar title="Comprobantes" period={formatDateRangeLabel(dateRange)} />

      {!activeRuc ? (
        <main className="ui-page flex-1">
          <EmptyState
            icon={<FileCode2 className="w-5 h-5" />}
            title="Selecciona una empresa"
            description="Usa el selector de empresa en la parte superior derecha para elegir un RUC y ver sus comprobantes de declaración."
          />
        </main>
      ) : (
      <main className="ui-page flex-1">
        <DateRangeFilter value={dateRange} onChange={setDateRange} filterLabel="Período tributario" className="bg-white border border-brand-gray-200 rounded-xl px-4 py-3" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <PageHeader
            title="Historial de Declaraciones"
            description="Registro de declaraciones calculadas con tus comprobantes reales."
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 border border-brand-gray-200 bg-white text-brand-gray-800 hover:bg-brand-gray-50 text-[13px] font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4 text-brand-red" />
              Cargar XMLs
            </button>
            <Link
              href="/declaraciones/presentar"
              className="flex items-center gap-2 bg-brand-red text-white text-[13px] font-bold px-4 py-2.5 rounded-lg hover:bg-brand-red-bright transition-colors shrink-0"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Nueva Declaración
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Declaraciones registradas", value: loading ? "..." : comprobantes.length, color: "text-brand-gray-900" },
            { label: "IVA total registrado", value: loading ? "..." : `$${totalIva.toFixed(2)}`, color: "text-amber-700" },
            { label: "Registradas correctamente", value: loading ? "..." : comprobantes.length ? `${Math.round((aceptadas / comprobantes.length) * 100)}%` : "0%", color: "text-success" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-brand-gray-200 rounded-xl p-5">
              <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-brand-gray-500 font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-brand-gray-100 flex items-center justify-between">
            <span className="text-[13px] font-bold text-brand-gray-700">Comprobantes de Presentación</span>
            <span className="text-[11px] text-brand-gray-400">Datos desde auditoría del sistema</span>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <TableSkeleton rows={6} columns={5} />
            ) : comprobantes.length === 0 ? (
              <EmptyState
                icon={<FileCode2 className="w-5 h-5" />}
                title="Aún no hay declaraciones registradas."
                description="Presenta tu primera declaración desde el asistente."
                compact
              />
            ) : (
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="bg-brand-gray-50 border-b border-brand-gray-100">
                    {["Período", "Tipo", "No. Trámite", "Fecha Presentación", "IVA Pagado", "Estado", "Acciones"].map((h) => (
                      <TableHead key={h} className="text-left px-5 py-3 text-[11px] font-bold text-brand-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {comprobantes.map((c) => (
                    <TableRow key={c.id} className="hover:bg-brand-gray-50 transition-colors">
                      <TableCell className="px-5 py-3.5 text-[13px] font-semibold text-brand-gray-900">{c.periodo}</TableCell>
                      <TableCell className="px-5 py-3.5">
                        <span className="text-[11px] font-bold bg-brand-gray-100 text-brand-gray-600 px-2 py-0.5 rounded-full">{c.tipo}</span>
                      </TableCell>
                      <TableCell className="px-5 py-3.5 font-mono text-[12px] text-brand-gray-600">{c.tramite || "—"}</TableCell>
                      <TableCell className="px-5 py-3.5 text-[12.5px] text-brand-gray-600">{c.fecha}</TableCell>
                      <TableCell className="px-5 py-3.5 text-[13px] font-bold text-amber-700">${c.iva.toFixed(2)}</TableCell>
                      <TableCell className="px-5 py-3.5">
                        <span className="text-[10px] font-bold bg-success-pale text-success px-2 py-1 rounded-full">{c.estado}</span>
                      </TableCell>
                      <TableCell className="px-5 py-3.5">
                        <Link
                          href="/declaraciones"
                          className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-red hover:text-brand-red-bright transition-colors"
                        >
                          Ver detalle
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </main>
      )}

      {showImportModal && (
        <Dialog open={showImportModal} onClose={() => setShowImportModal(false)}>
          <div className="p-4 flex flex-col gap-4">
            <h3 className="text-base font-bold text-brand-gray-900">Cargar e Importar Comprobantes XML</h3>
            <p className="text-xs text-brand-gray-500">
              Selecciona o arrastra los archivos XML de comprobantes autorizados por el SRI. El sistema los procesará e integrará automáticamente al Control Tributario.
            </p>
            <XmlImportZone onImport={handleImportXmls} loading={importing} />
          </div>
        </Dialog>
      )}
    </>
  );
}
