"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import Topbar from "@/components/layout/Topbar";
import {
  DateRange,
  filterByDateRange,
  formatDateRangeLabel,
  getComprobantesListLimit,
  getDefaultDateRange,
  toDateRangeParams,
} from "@/components/DateRangeFilter";
import { sriClient, Comprobante } from "@/lib/sriClient";
import { downloadComprobantePng } from "@/lib/documentos-png";
import TablePaginator, { DEFAULT_PAGE_SIZE } from "@/components/TablePaginator";
import Dialog from "@/components/ui/Dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import XmlImportZone from "@/components/XmlImportZone";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { X, Download, FileText, ChevronDown, DownloadCloud } from "lucide-react";
import DocumentosFilters, {
  type DocumentosViewFilter,
} from "@/components/documentos/DocumentosFilters";
import { TIPO_DESC } from "@/components/documentos/constants";

import { apiFetch } from "@/lib/apiFetch";
import { generateExcelReport } from "@/lib/excel-export";
import { buildScrapePayloadForClave } from "@/lib/sri-scrape-from-clave";

const SyncProgressDialog = dynamic(
  () => import("@/components/modals/SyncProgressDialog"),
  { ssr: false }
);
const MassDownloadModal = dynamic(
  () => import("@/components/modals/MassDownloadModal"),
  { ssr: false }
);

import type { SyncResultSummary } from "@/components/modals/SyncProgressDialog";

export default function Documentos() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasSriLinked, activeRuc, refreshSriStatus, isLoading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<DocumentosViewFilter>("todos");
  const [realDocs, setRealDocs] = useState<Comprobante[]>([]);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Comprobante | null>(null);
  const [certWarning, setCertWarning] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSyncResult, setShowSyncResult] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResultSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [downloadingClave, setDownloadingClave] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [isClient, setIsClient] = useState(false);
  const prevActiveJobIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setDateRange(getDefaultDateRange());
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (searchParams.get("descargas") === "1") {
      setShowMassDownloadModal(true);
      router.replace("/documentos", { scroll: false });
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (authLoading) return;
    void refreshSriStatus();
  }, [authLoading, refreshSriStatus]);
  const [totalEnPeriodo, setTotalEnPeriodo] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [showMassDownloadModal, setShowMassDownloadModal] = useState(false);
  const [activeJobs, setActiveJobs] = useState<
    { id: string; status: string; progress_message?: string; fecha_desde?: string; fecha_hasta?: string }[]
  >([]);


  const loadRealDocuments = async (range: DateRange = dateRange) => {
    try {
      setIsLoading(true);
      const data = await sriClient.getComprobantes({
        limit: getComprobantesListLimit(range),
        ...toDateRangeParams(range),
      });
      if (data && data.data) {
        setRealDocs(data.data);
        setTotalEnPeriodo(data.meta?.total ?? data.data.length);
        setIsApiConnected(true);
      }

      // Consultar validez de firma
      try {
        const emisorRes = await sriClient.getEmisor();
        if (emisorRes.success && emisorRes.emisor.certificadoExpiracion) {
          const expDate = new Date(emisorRes.emisor.certificadoExpiracion);
          const now = new Date();
          const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            setCertWarning(`Tu firma electrónica expiró hace ${Math.abs(diffDays)} días (fecha: ${expDate.toLocaleDateString()}). Por favor, renuévala.`);
          } else if (diffDays <= 30) {
            setCertWarning(`Tu firma electrónica vencerá en ${diffDays} días (fecha: ${expDate.toLocaleDateString()}). Renuévala pronto para evitar interrupciones.`);
          } else {
            setCertWarning(null);
          }
        }
      } catch (err) {
        console.error("Error al obtener fecha de firma:", err);
      }
    } catch (err) {
      setIsApiConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportXmls = async (files: FileList) => {
    setImporting(true);
    setImportMessage(null);
    setImportError(null);
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
        const msg = `¡Importación completada! ${res.importedCount} comprobantes importados.${res.errorsCount > 0 ? ` ${res.errorsCount} archivos fallaron.` : ""}`;
        toast.success(msg);
        if (res.sync) {
          setSyncResult(res.sync);
          setShowSyncResult(true);
        }
        if (res.errors && res.errors.length > 0) {
          setImportError(res.errors.map((e: any) => `Archivo ${e.index + 1}: ${e.message}`).join("\n"));
        }
        await loadRealDocuments();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar la importación";
      setImportError(msg);
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const massDownloadDirection =
    viewFilter === 'emitidos' ? 'emitidos' : viewFilter === 'recibidos' ? 'recibidos' : 'ambos';

  const handleRetryPending = async () => {
    setRetrying(true);
    try {
      const res = await sriClient.retryPending();
      if (res.success) {
        toast.success(`Proceso finalizado. Se enviaron ${res.processed} facturas, logrando autorizar ${res.authorizedCount} de ellas.`);
        await loadRealDocuments();
      }
    } catch (err: unknown) {
      toast.error("Error al reintentar firmas: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setRetrying(false);
    }
  };

  const handleCategorize = async (claveAcceso: string, newCategory: string) => {
    try {
      const res = await sriClient.categorizeComprobante(claveAcceso, newCategory);
      if (res.success) {
        setRealDocs(prev => prev.map(doc => doc.claveAcceso === claveAcceso ? { ...doc, categoria: newCategory } : doc));
        if (selectedDoc && selectedDoc.claveAcceso === claveAcceso) {
          setSelectedDoc(prev => prev ? { ...prev, categoria: newCategory } : null);
        }
      }
    } catch (err: unknown) {
      toast.error("Error al actualizar la categoría: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const enqueueScrapeForXml = async (doc: Comprobante): Promise<string | null> => {
    if (!activeRuc) {
      throw new Error("No hay RUC activo vinculado al SRI para descargar el XML.");
    }
    const esEmitido = doc.emisor?.ruc === activeRuc;
    const payload = buildScrapePayloadForClave({
      claveAcceso: doc.claveAcceso,
      rucPortal: activeRuc,
      esEmitido,
    });
    if (!payload) {
      throw new Error("No se pudo armar la descarga masiva desde la clave de acceso.");
    }

    const token = localStorage.getItem("sri_access_token");
    const res = await apiFetch("/api/sri/scraping", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.jobId) {
      throw new Error(data.error || data.message || "No se pudo encolar la descarga masiva del SRI");
    }
    return String(data.jobId);
  };

  const handleDownloadXml = async (doc: Comprobante) => {
    try {
      setDownloadingClave(`xml:${doc.claveAcceso}`);
      const token = localStorage.getItem('sri_access_token');
      const response = await apiFetch(`/api/sri/comprobantes/${doc.claveAcceso}/xml`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => null);
        let msg = "No se pudo obtener el XML";
        if (errBody) {
          try { const j = JSON.parse(errBody); if (j.message) msg = j.message; } catch {}
        }
        const missingXml = /XML no disponible|No se encontró el XML/i.test(msg);
        if (missingXml) {
          const jobId = await enqueueScrapeForXml(doc);
          toast.info(
            `XML no local. Se encoló descarga masiva del SRI${jobId ? ` (job ${jobId})` : ""}. Cuando termine, vuelve a descargar.`
          );
          setShowMassDownloadModal(true);
          return;
        }
        throw new Error(msg);
      }
      const xmlText = await response.text();
      const blob = new Blob([xmlText], { type: "application/xml" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.claveAcceso}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast.error("Error al descargar XML: " + (err instanceof Error ? err.message : "Error"));
    } finally {
      setDownloadingClave(null);
    }
  };

  const handleDownloadPdf = async (doc: Comprobante) => {
    const downloadOnce = async () => {
      const token = localStorage.getItem('sri_access_token');
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 45000);
      try {
        const response = await apiFetch(`/api/sri/comprobantes/${doc.claveAcceso}/pdf`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!response.ok) {
          const errBody = await response.text().catch(() => null);
          let msg = "No se pudo obtener el PDF";
          if (errBody) {
            try { const j = JSON.parse(errBody); if (j.message) msg = j.message; } catch {}
          }
          throw new Error(msg);
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ride_${doc.claveAcceso}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    try {
      setDownloadingClave(`pdf:${doc.claveAcceso}`);
      try {
        await downloadOnce();
        return;
      } catch (firstErr: unknown) {
        const msg = firstErr instanceof Error ? firstErr.message : "";
        const missingXml = /No se encontró el XML|XML no disponible/i.test(msg);
        if (!missingXml) throw firstErr;

        const jobId = await enqueueScrapeForXml(doc);
        toast.info(
          `Sin XML local para el RIDE. Se encoló descarga masiva del portal SRI${jobId ? ` (job ${jobId})` : ""}. Al terminar, vuelve a pulsar RIDE PDF.`
        );
        setShowMassDownloadModal(true);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("La generación del RIDE tardó demasiado. Verifica que el XML esté disponible.");
      } else {
        toast.error("Error al descargar PDF: " + (err instanceof Error ? err.message : "Error"));
      }
    } finally {
      setDownloadingClave(null);
    }
  };

  const handleDownloadPng = (doc: Comprobante) => {
    try {
      downloadComprobantePng(doc, { activeRuc });
    } catch (err: unknown) {
      toast.error("Error al generar imagen PNG: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const handleDownloadCsv = (doc: Comprobante) => {
    try {
      const tipoLabel = TIPO_DESC[doc.tipoComprobante] || doc.tipoComprobante;
      const isDocVenta = doc.emisor?.ruc === activeRuc;
      const partnerLabel = isDocVenta ? "Receptor" : "Emisor";
      const partnerName = isDocVenta ? doc.receptorRazonSocial : (doc.emisor?.razonSocial || "—");
      const partnerIdent = isDocVenta ? doc.receptorIdentificacion : (doc.emisor?.ruc || "—");

      const headers = [
        "Clave de Acceso",
        "Tipo",
        "Serie",
        "Secuencial",
        "Fecha Emision",
        "Estado",
        "Subtotal",
        "Total",
        `${partnerLabel} Razon Social`,
        `${partnerLabel} Identificacion`,
        "Nro Autorizacion",
        "Fecha Autorizacion",
        "Categoria"
      ];

      const row = [
        `="${doc.claveAcceso}"`,
        tipoLabel,
        doc.serie || "—",
        doc.secuencial || "—",
        doc.fechaEmision ? new Date(doc.fechaEmision).toLocaleDateString('es-EC') : "—",
        doc.estado,
        (doc.subtotal || 0).toFixed(2),
        (doc.importeTotal || 0).toFixed(2),
        partnerName,
        `="${partnerIdent}"`,
        `="${doc.numeroAutorizacion || '—'}"`,
        doc.fechaAutorizacion ? new Date(doc.fechaAutorizacion).toLocaleDateString('es-EC') : "—",
        (doc as any).categoria || "Otros"
      ];

      const csvContent = "\uFEFF" + [
        headers.join(";"),
        row.map(val => `"${val.replace(/"/g, '""')}"`).join(";")
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprobante_${doc.claveAcceso}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error("Error al exportar CSV: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const handleExportAllCsv = async () => {
    try {
      if (filteredDocs.length === 0) {
        toast.warning("No hay comprobantes para exportar.");
        return;
      }

      await generateExcelReport({
        title: "Reporte General de Comprobantes Electrónicos SRI",
        subtitle: `RUC Emisor: ${activeRuc || "General"} · Registros: ${filteredDocs.length}`,
        filename: `Reporte_Comprobantes_${new Date().toISOString().slice(0, 10)}.xlsx`,
        columns: [
          { header: "Tipo", key: "tipo", width: 12 },
          { header: "Razon Social Emisor/Receptor", key: "partnerName", width: 35 },
          { header: "RUC / Identificación", key: "partnerIdent", width: 18 },
          { header: "Serie", key: "serie", width: 12 },
          { header: "Secuencial", key: "secuencial", width: 22 },
          { header: "Fecha Emisión", key: "fecha", width: 15 },
          { header: "Subtotal", key: "subtotal", width: 15 },
          { header: "Total ($)", key: "total", width: 15 },
          { header: "Estado SRI", key: "estado", width: 16 },
          { header: "Categoría", key: "categoria", width: 18 },
        ],
        data: filteredDocs.map((doc) => {
          const isDocVenta = doc.emisor?.ruc === activeRuc;
          const partnerName = isDocVenta
            ? doc.receptorRazonSocial
            : doc.emisor?.razonSocial || "—";
          const partnerIdent = isDocVenta
            ? doc.receptorIdentificacion
            : doc.emisor?.ruc || "—";
          const tipoLabel = TIPO_DESC[doc.tipoComprobante] || doc.tipoComprobante;

          return {
            tipo: tipoLabel,
            partnerName,
            partnerIdent,
            serie: doc.serie || "—",
            secuencial: doc.secuencial || "—",
            fecha: doc.fechaEmision
              ? new Date(doc.fechaEmision).toLocaleDateString("es-EC")
              : "—",
            subtotal: `$${(doc.subtotal || 0).toFixed(2)}`,
            total: `$${(doc.importeTotal || 0).toFixed(2)}`,
            estado: doc.estado,
            categoria: (doc as any).categoria || "Otros",
          };
        }),
      });

      toast.success("Reporte Excel descargado correctamente");
    } catch (err: any) {
      toast.error("Error al exportar reporte: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedDoc(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Solo listar lo ya sincronizado en BD para el periodo (sin re-sync SOAP ni descarga).
  useEffect(() => {
    if (isClient && hasSriLinked && activeRuc) {
      void loadRealDocuments(dateRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, hasSriLinked, activeRuc, isClient]);

  useEffect(() => {
    if (!isClient || !hasSriLinked) return;

    const pollJobs = async () => {
      try {
        const token = localStorage.getItem("sri_access_token");
        const res = await apiFetch("/api/sri/scraping", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        const jobs = (data.jobs || []).filter(
          (j: { status?: string }) => j.status === "PENDING" || j.status === "PROCESSING"
        ) as { id: string; status: string; progress_message?: string; fecha_desde?: string; fecha_hasta?: string }[];

        const nextIds = new Set(jobs.map((j) => j.id));
        const prevIds = prevActiveJobIdsRef.current;
        const finishedSomething =
          prevIds.size > 0 && [...prevIds].some((id) => !nextIds.has(id));
        prevActiveJobIdsRef.current = nextIds;
        setActiveJobs(jobs);

        if (finishedSomething) {
          void loadRealDocuments(dateRange);
          toast.success("Descarga SRI finalizada: documentos sincronizados en el listado.");
        }
      } catch {
        /* ignore polling errors */
      }
    };

    pollJobs();
    const interval = setInterval(pollJobs, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, hasSriLinked, dateRange.from, dateRange.to]);

  const cancelScrapingJob = async (jobId: string) => {
    try {
      const token = localStorage.getItem("sri_access_token");
      const res = await apiFetch("/api/sri/scraping", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Trabajo cancelado");
        setActiveJobs((prev) => prev.filter((j) => j.id !== jobId));
      } else {
        toast.error(data.error || "No se pudo cancelar el trabajo");
      }
    } catch {
      toast.error("Error al cancelar el trabajo");
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, viewFilter, dateRange, pageSize]);

  // Filter logic — por fecha de emisión del comprobante
  const docsInRange = filterByDateRange(realDocs, (doc) => doc.fechaEmision, dateRange);

  const filteredDocs = docsInRange.filter((doc) => {
    const prov = doc.emisor?.ruc === activeRuc
      ? (doc.receptorRazonSocial || "")
      : (doc.emisor?.razonSocial || "");
    const num = doc.secuencial || "";
    const rucStr = doc.emisor?.ruc === activeRuc
      ? (doc.receptorIdentificacion || "")
      : (doc.emisor?.ruc || "");
    const matchesSearch =
      prov.toLowerCase().includes(search.toLowerCase()) ||
      num.toLowerCase().includes(search.toLowerCase()) ||
      rucStr.toLowerCase().includes(search.toLowerCase());

    const isEmitido = doc.emisor?.ruc === activeRuc;
    const isRecibido = doc.emisor?.ruc !== activeRuc;
    const isRetencion = doc.tipoComprobante === "07";

    let matchesView = true;
    if (viewFilter === "emitidos") matchesView = isEmitido;
    else if (viewFilter === "recibidos") matchesView = isRecibido;
    else if (viewFilter === "retenciones") matchesView = isRetencion;

    return matchesSearch && matchesView;
  });

  const totalFiltered = filteredDocs.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedDocs = filteredDocs.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Stats from real data (filtradas por fecha de emisión)
  const totalDocs = totalEnPeriodo ?? docsInRange.length;
  const listaTruncada = totalEnPeriodo != null && docsInRange.length < totalEnPeriodo;
  const totalCompras = docsInRange.filter(d => d.emisor?.ruc !== activeRuc && d.tipoComprobante === '01').reduce((s, d) => s + (d.importeTotal || 0), 0);
  const totalVentas = docsInRange.filter(d => d.emisor?.ruc === activeRuc).reduce((s, d) => s + (d.importeTotal || 0), 0);
  const totalRetenciones = docsInRange.filter(d => d.tipoComprobante === '07').length;
  const noAutorizados = docsInRange.filter(d => d.estado !== 'AUTORIZADO').length;

  const getTypePill = (tipo: string) => {
    if (tipo === '01') return "bg-indigo-50 text-indigo-700";
    if (tipo === '07') return "bg-amber-50 text-amber-700";
    return "bg-success-pale text-success";
  };

  return (
    <>
      <Topbar title="Documentos" period={formatDateRangeLabel(dateRange)} />

      {certWarning && (
        <div className="px-3 md:px-4 lg:px-5 mt-4 ui-banner-warning flex items-start gap-2.5 shadow-sm animate-fade-in">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <div>{certWarning}</div>
        </div>
      )}

      {activeJobs.length > 0 && (
        <div className="px-3 md:px-4 lg:px-5 mt-4 flex flex-col gap-2">
          {activeJobs.map((job) => (
            <div
              key={job.id}
              className="ui-banner-info flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-bold text-brand-sky">
                  Descarga SRI en curso · {job.status === "PENDING" ? "En cola" : "Procesando"}
                </p>
                <p className="text-brand-sky truncate mt-0.5">
                  {job.fecha_desde && job.fecha_hasta
                    ? `${job.fecha_desde} → ${job.fecha_hasta}`
                    : "Listando y sincronizando comprobantes"}
                  {job.progress_message ? ` · ${job.progress_message}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 h-7 text-[11px]"
                onClick={() => cancelScrapingJob(job.id)}
              >
                Cancelar
              </Button>
            </div>
          ))}
        </div>
      )}

      {authLoading || !isClient ? (
        <div className="ui-page flex-1 text-brand-gray-800 select-none">
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-brand-gray-400">
            <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-sm font-medium">Verificando vínculo SRI…</span>
          </div>
        </div>
      ) : hasSriLinked && !activeRuc ? (
        <div className="ui-page flex-1 text-brand-gray-800 select-none">
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-amber/10 flex items-center justify-center">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-brand-amber">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
              </svg>
            </div>
            <div className="text-center max-w-md">
              <p className="text-sm font-bold text-brand-gray-700">Selecciona una empresa</p>
              <p className="text-xs text-brand-gray-400 mt-1">Usa el selector de empresa en la parte superior derecha para elegir un RUC y ver sus comprobantes.</p>
            </div>
          </div>
        </div>
      ) : (
      <div className="ui-page flex-1 text-brand-gray-800 select-none">
        <DocumentosFilters
          search={search}
          onSearchChange={setSearch}
          viewFilter={viewFilter}
          onViewFilterChange={setViewFilter}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          primaryActions={
            hasSriLinked && isApiConnected ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setShowMassDownloadModal(true)}
                className="min-h-9 gap-1.5"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                Descarga masiva SRI
              </Button>
            ) : (
              <Link
                href="/configuracion?vincular=true"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className:
                    "border-brand-amber/30 bg-brand-amber/10 text-brand-amber hover:bg-brand-amber/20 gap-1.5 min-h-9",
                })}
              >
                <span className="w-2 h-2 bg-brand-amber rounded-full" />
                Vincular SRI
              </Link>
            )
          }
          secondaryActions={
            hasSriLinked && isApiConnected ? (
              <details className="relative group/more">
                <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer inline-flex items-center gap-1 min-h-9 px-3 rounded-lg border border-brand-gray-200 bg-white text-xs font-semibold text-brand-gray-700 hover:bg-brand-gray-50">
                  Más
                  <ChevronDown className="w-3.5 h-3.5 text-brand-gray-400 group-open/more:rotate-180 transition-transform duration-150" />
                </summary>
                <div
                  className="absolute right-0 z-20 mt-1.5 w-56 rounded-xl border border-brand-gray-200 bg-white p-1.5 shadow-lg flex flex-col gap-0.5"
                  onClick={(e) => {
                    const root = (e.currentTarget.parentElement as HTMLDetailsElement | null);
                    if (root) root.open = false;
                  }}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start font-semibold h-9"
                    onClick={handleExportAllCsv}
                  >
                    Exportar Excel (CSV)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start font-semibold h-9"
                    onClick={() => setShowImportModal(true)}
                  >
                    Importar XMLs
                  </Button>
                  {realDocs.some((d) => d.estado === "PENDIENTE") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="justify-start font-semibold h-9"
                      onClick={handleRetryPending}
                      disabled={retrying}
                    >
                      Reintentar pendientes
                    </Button>
                  )}
                  <div className="mx-1.5 my-1 border-t border-brand-gray-100" />
                  <div className="px-2.5 py-1.5 text-[11px] font-bold text-success flex items-center gap-1.5">
                    <span className="size-1.5 bg-success rounded-full animate-pulse" />
                    SRI vinculado
                  </div>
                </div>
              </details>
            ) : null
          }
        />

        {listaTruncada && (
          <div className="ui-banner-info">
            Mostrando {docsInRange.length} de {totalEnPeriodo} documentos del período.
            Reduce el rango de fechas o exporta a CSV para ver el detalle completo.
          </div>
        )}

        {/* STATS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <div className="bg-white border border-brand-gray-200 rounded-xl px-3 py-2.5">
            <div className="text-xl font-extrabold leading-none tabular-nums">{totalDocs}</div>
            <div className="text-[11px] text-brand-gray-400 font-medium mt-1">
              {listaTruncada ? `En período (${docsInRange.length})` : "Documentos"}
            </div>
          </div>
          <div className="bg-white border border-brand-gray-200 rounded-xl px-3 py-2.5">
            <div className="text-xl font-extrabold text-brand-green-light leading-none tabular-nums">
              ${totalCompras.toFixed(2)}
            </div>
            <div className="text-[11px] text-brand-gray-400 font-medium mt-1">Compras</div>
          </div>
          <div className="bg-white border border-brand-gray-200 rounded-xl px-3 py-2.5">
            <div className="text-xl font-extrabold text-brand-green-light leading-none tabular-nums">
              ${totalVentas.toFixed(2)}
            </div>
            <div className="text-[11px] text-brand-gray-400 font-medium mt-1">Ventas</div>
          </div>
          <div className="bg-white border border-brand-gray-200 rounded-xl px-3 py-2.5">
            <div className="text-xl font-extrabold text-brand-amber leading-none tabular-nums">{totalRetenciones}</div>
            <div className="text-[11px] text-brand-gray-400 font-medium mt-1">Retenciones</div>
          </div>
          <div className="bg-white border border-brand-gray-200 rounded-xl px-3 py-2.5 col-span-2 sm:col-span-1">
            <div className="text-xl font-extrabold text-brand-red leading-none tabular-nums">{noAutorizados}</div>
            <div className="text-[11px] text-brand-gray-400 font-medium mt-1">No autorizados</div>
          </div>
        </div>

        {/* DOCUMENTS TABLE */}
        <div className="bg-white border border-brand-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="w-full overflow-x-auto">
            {isLoading || authLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-brand-gray-400">
                <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-sm font-medium">
                  {authLoading ? "Verificando vínculo SRI…" : "Cargando comprobantes..."}
                </span>
              </div>
            ) : !hasSriLinked ? (
              <EmptyState
                icon={<FileText className="w-5 h-5" />}
                title="Vincula tu cuenta del SRI"
                description="Configura tu RUC y contraseña del SRI para ver comprobantes"
                action={
                  <Link href="/configuracion?vincular=true" className={buttonVariants({ variant: "default", className: "px-5" })}>
                    Vincular SRI
                  </Link>
                }
              />
            ) : filteredDocs.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-5 h-5" />}
                title="No se encontraron comprobantes"
                description={
                  search
                    ? "Prueba con otro término de búsqueda"
                    : "No hay documentos sincronizados para este periodo. Si aún no los bajaste del portal, usa Descarga masiva SRI una sola vez."
                }
                compact
                action={
                  !search && hasSriLinked ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setShowMassDownloadModal(true)}
                      className="gap-1.5"
                    >
                      <DownloadCloud className="w-3.5 h-3.5" />
                      Descarga masiva SRI
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <Table className="min-w-[1500px]">
                <TableHeader>
                  <TableRow className="bg-brand-gray-50 border-b border-brand-gray-200">
                    <TableHead className="pl-5">RUC y Razón social emisor</TableHead>
                    <TableHead>Tipo y serie de comprobante</TableHead>
                    <TableHead>Clave de acceso / Nro. Autorización</TableHead>
                    <TableHead>Fecha y hora de autorización</TableHead>
                    <TableHead>Fecha emisión</TableHead>
                    <TableHead className="text-center">Estado SRI</TableHead>
                    <TableHead className="text-right">Valor sin impuestos</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Importe Total</TableHead>
                    <TableHead className="text-center w-[60px]">Documento</TableHead>
                    <TableHead className="text-center w-[60px]">RIDE</TableHead>
                    <TableHead>Documentos relacionados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-100">
                  {paginatedDocs.map((doc, idx) => {
                    const tipo = doc.tipoComprobante || '01';
                    const tipoLabel = TIPO_DESC[tipo] || tipo;
                    const emisorName = doc.emisor?.razonSocial || "—";
                    const emisorRuc = doc.emisor?.ruc || "";

                    return (
                      <TableRow
                        key={doc.claveAcceso || idx}
                        className="cursor-pointer align-middle"
                        onClick={() => setSelectedDoc(doc)}
                      >
                        <TableCell className="pl-5 max-w-[280px]">
                          <div className="font-semibold text-brand-gray-800 truncate" title={emisorName}>
                            {emisorName}
                          </div>
                          <div className="text-[10px] text-brand-gray-400 mt-0.5">
                            RUC: {emisorRuc || "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 inline-block ${getTypePill(tipo)}`}>
                            {tipoLabel}
                          </span>
                          <div className="text-[10px] text-brand-gray-600 mt-1 font-mono">
                            {doc.serie || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-brand-gray-500 break-all select-all leading-normal">
                              {doc.claveAcceso}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(doc.claveAcceso);
                                toast.success("Clave de acceso copiada");
                              }}
                              className="text-brand-gray-400 hover:text-brand-red shrink-0 cursor-pointer"
                              title="Copiar clave de acceso"
                            >
                              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                              </svg>
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="text-brand-gray-600 whitespace-nowrap">
                          {doc.fechaAutorizacion
                            ? new Date(doc.fechaAutorizacion).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-brand-gray-600 whitespace-nowrap">
                          {doc.fechaEmision
                            ? new Date(doc.fechaEmision).toLocaleDateString('es-EC')
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge estado={doc.estado || 'PENDIENTE'} />
                        </TableCell>
                        <TableCell className="text-right font-medium text-brand-gray-700">
                          ${(doc.subtotal || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-brand-gray-700">
                          ${(doc.totalIva || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-brand-gray-900">
                          ${(doc.importeTotal || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            size="icon-xs"
                            disabled={downloadingClave === `xml:${doc.claveAcceso}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadXml(doc);
                            }}
                            className="bg-brand-red/5 text-brand-red hover:bg-brand-red/15 hover:text-brand-red-mid"
                            title="Descargar XML (Documento)"
                            aria-label="Descargar XML (Documento)"
                          >
                            <Download />
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            size="icon-xs"
                            disabled={downloadingClave === `pdf:${doc.claveAcceso}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPdf(doc);
                            }}
                            className="bg-brand-red-subtle text-brand-red hover:bg-red-100 hover:text-brand-red"
                            title="Descargar PDF (RIDE)"
                            aria-label="Descargar PDF (RIDE)"
                          >
                            <Download />
                          </Button>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-brand-gray-500 font-medium" title={doc.documentosRelacionados}>
                          {doc.documentosRelacionados || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {hasSriLinked && !isLoading && filteredDocs.length > 0 && (
            <TablePaginator
              page={safePage}
              pageSize={pageSize}
              totalItems={totalFiltered}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>

      </div>
      )}

      {/* DETAIL PANEL OVERLAY */}
      {selectedDoc && (
        <div
          onClick={() => setSelectedDoc(null)}
          className="fixed inset-0 bg-brand-red/30 backdrop-blur-xs transition-opacity z-50 animate-fade-in"
        />
      )}

      {/* DETAIL PANEL */}
      <aside
        className={`fixed top-0 right-0 h-screen w-full sm:w-[420px] bg-white shadow-2xl z-55 flex flex-col transform transition-transform duration-300 ${
          selectedDoc ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selectedDoc && (
          <>
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-5 border-b border-brand-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold rounded px-2 py-0.5 ${getTypePill(selectedDoc.tipoComprobante || '01')}`}>
                    {TIPO_DESC[selectedDoc.tipoComprobante || '01']}
                  </span>
                  <StatusBadge estado={selectedDoc.estado || 'PENDIENTE'} className="font-semibold" />
                </div>
                <div className="text-sm font-extrabold text-brand-red mt-1">
                  {selectedDoc.emisor?.razonSocial || selectedDoc.receptorRazonSocial || "Comprobante"}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Cerrar detalle"
                onClick={() => setSelectedDoc(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Clave de Acceso", value: selectedDoc.claveAcceso, mono: true },
                  { label: "Serie", value: selectedDoc.serie || "—" },
                  { label: "Secuencial", value: selectedDoc.secuencial || "—" },
                  { label: "Fecha Emisión", value: selectedDoc.fechaEmision ? new Date(selectedDoc.fechaEmision).toLocaleDateString('es-EC') : "—" },
                  { label: "RUC Emisor", value: selectedDoc.emisor?.ruc || "—" },
                  { label: "Receptor", value: selectedDoc.receptorIdentificacion || "—" },
                  { label: "Nº Autorización", value: selectedDoc.numeroAutorizacion || "—", mono: true },
                  { label: "Fecha Autorización", value: selectedDoc.fechaAutorizacion ? new Date(selectedDoc.fechaAutorizacion).toLocaleString('es-EC') : "—" },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="bg-brand-gray-50 rounded-lg p-3">
                    <div className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">{label}</div>
                    <div className={`text-xs font-semibold text-brand-gray-800 mt-1 break-all ${mono ? 'font-mono text-[10px]' : ''}`}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Category selector for purchases */}
              {selectedDoc.emisor?.ruc !== activeRuc && (
                <div className="bg-brand-gray-50 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">Categoría Tributaria</div>
                  <select
                     className="w-full mt-1.5 p-2 bg-white border border-brand-gray-200 rounded-lg text-xs font-semibold text-brand-gray-800 outline-none cursor-pointer"
                    value={(selectedDoc as any).categoria || 'Otros'}
                    onChange={(e) => handleCategorize(selectedDoc.claveAcceso, e.target.value)}
                  >
                    <option value="Alimentación">Alimentación</option>
                    <option value="Salud">Salud</option>
                    <option value="Educación">Educación</option>
                    <option value="Vivienda">Vivienda</option>
                    <option value="Vestimenta">Vestimenta</option>
                    <option value="Negocio/Servicios">Negocio/Servicios</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
              )}

              {/* Related Documents */}
              {selectedDoc.documentosRelacionados && (
                <div className="bg-brand-gray-50 rounded-lg p-3 border border-indigo-100">
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Documentos Relacionados</div>
                  <div className="text-xs font-semibold text-brand-gray-800 mt-1.5 leading-normal">
                    {selectedDoc.documentosRelacionados}
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="bg-brand-red/5 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex justify-between text-xs text-brand-gray-600">
                  <span>Subtotal sin impuesto</span>
                  <span className="font-semibold">${(selectedDoc.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-brand-gray-600">
                  <span>IVA</span>
                  <span className="font-semibold">${(selectedDoc.totalIva || 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-brand-gray-200 pt-2 flex justify-between text-sm font-extrabold text-brand-red">
                  <span>Total</span>
                  <span>${(selectedDoc.importeTotal || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="flex flex-col gap-3.5 p-5 border-t border-brand-gray-100 bg-white">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={downloadingClave === `xml:${selectedDoc.claveAcceso}`}
                  onClick={() => handleDownloadXml(selectedDoc)}
                  className="border-brand-red/20 bg-brand-red/5 text-brand-red hover:bg-brand-red/10"
                >
                  XML Autorizado
                </Button>
                <Button
                  type="button"
                  disabled={downloadingClave === `pdf:${selectedDoc.claveAcceso}`}
                  onClick={() => handleDownloadPdf(selectedDoc)}
                >
                  {downloadingClave === `pdf:${selectedDoc.claveAcceso}` ? "Generando…" : "RIDE PDF"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDownloadPng(selectedDoc)}
                >
                  Imagen PNG
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDownloadCsv(selectedDoc)}
                >
                  Excel (CSV)
                </Button>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => setSelectedDoc(null)}
              >
                Cerrar
              </Button>
            </div>
          </>
        )}
      </aside>

      <SyncProgressDialog
        open={showSyncResult}
        onClose={() => setShowSyncResult(false)}
        result={syncResult}
        loading={false}
      />

      <Dialog
        open={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportMessage(null);
          setImportError(null);
        }}
        title="Importar Comprobantes XML"
        description="Arrastra y suelta tus archivos XML autorizados del SRI aquí, o haz clic para seleccionarlos."
        size="md"
      >
        <XmlImportZone
          loading={importing}
          onImport={async (files) => {
            await handleImportXmls(files);
          }}
        />

        {importMessage && (
          <div className="bg-success-pale border border-success-light/40 rounded-lg p-3 text-xs text-success font-semibold leading-normal mt-3">
            {importMessage}
          </div>
        )}
        {importError && (
          <div className="bg-brand-red-subtle border border-brand-red-pale rounded-lg p-3 text-xs text-brand-red font-semibold max-h-32 overflow-y-auto whitespace-pre-line leading-normal mt-3">
            {importError}
          </div>
        )}
      </Dialog>

      <MassDownloadModal
        open={showMassDownloadModal}
        onClose={() => setShowMassDownloadModal(false)}
        initialDateRange={dateRange}
        initialDirection={massDownloadDirection}
        onJobCompleted={() => {
          void loadRealDocuments(dateRange);
        }}
      />
    </>
  );
}
