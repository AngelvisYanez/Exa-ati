"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/Topbar";
import DateRangeFilter, {
  DateRange,
  filterByDateRange,
  formatDateRangeLabel,
  getComprobantesListLimit,
  getDefaultDateRange,
  toDateRangeParams,
} from "@/components/DateRangeFilter";
import { sriClient, Comprobante } from "@/lib/sriClient";
import TablePaginator, { DEFAULT_PAGE_SIZE } from "@/components/TablePaginator";
import Dialog from "@/components/ui/Dialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import XmlImportZone from "@/components/XmlImportZone";
import SyncProgressDialog, { type SyncResultSummary } from "@/components/SyncProgressDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MassDownloadModal from "@/components/MassDownloadModal";

const TIPO_DESC: Record<string, string> = {
  '01': 'FAC', '04': 'NC', '05': 'ND', '06': 'GR', '07': 'RET'
};

export default function Documentos() {
  const toast = useToast();
  const { hasSriLinked } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [flowTab, setFlowTab] = useState<"todos" | "emitidos" | "recibidos">("todos");
  const [realDocs, setRealDocs] = useState<Comprobante[]>([]);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [ruc, setRuc] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Comprobante | null>(null);
  const [certWarning, setCertWarning] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [showSyncResult, setShowSyncResult] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResultSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [totalEnPeriodo, setTotalEnPeriodo] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [showMassDownloadModal, setShowMassDownloadModal] = useState(false);


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

  const resolveSyncModo = (): 'completo' | 'emitidos' | 'recibidos' | 'pendientes' => {
    if (flowTab === 'emitidos') return 'emitidos';
    if (flowTab === 'recibidos') return 'recibidos';
    return 'completo';
  };

  const handleSyncSri = async () => {
    const rangeParams = toDateRangeParams(dateRange);
    const periodLabel = formatDateRangeLabel(dateRange);
    const hasPeriod = Boolean(rangeParams.fechaDesde || rangeParams.fechaHasta);

    if (!hasPeriod) {
      setShowSyncConfirm(true);
      return;
    }

    await executeSync(hasPeriod, periodLabel, rangeParams);
  };

  const executeSync = async (
    hasPeriod: boolean,
    periodLabel: string,
    rangeParams: ReturnType<typeof toDateRangeParams>,
    modoOverride?: 'completo' | 'emitidos' | 'recibidos' | 'pendientes'
  ) => {
    setSyncing(true);
    setSyncResult(null);
    setShowSyncResult(true);
    let res: Awaited<ReturnType<typeof sriClient.syncSri>> | null = null;
    try {
      const modo = modoOverride || resolveSyncModo();
      res = await sriClient.syncSri(
        hasPeriod
          ? { ...rangeParams, modo }
          : { limite: 500, modo }
      );
      setSyncResult(res);
      if (res.success) {
        if (res.warning === 'NO_LOCAL_DOCUMENTS') {
          toast.info(res.message || "No hay documentos locales para sincronizar.");
        } else if (res.warning === 'SRI_UNAVAILABLE') {
          toast.error(res.message || "No se pudo conectar con el SRI.");
        } else if ((res.errores ?? 0) > 0) {
          toast.warning(res.message || `Sync con ${res.errores} errores`);
        } else {
          toast.success(res.message || `Sync: ${res.procesados} consultados`);
        }
      }
    } catch (err: unknown) {
      toast.error("Error al sincronizar con el SRI: " + (err instanceof Error ? err.message : "Error desconocido"));
      setShowSyncResult(false);
    } finally {
      setSyncing(false);
      setShowSyncConfirm(false);
    }

    if (res?.success) {
      void loadRealDocuments(dateRange);
    }
  };

  const handleSyncPendientes = () => {
    const rangeParams = toDateRangeParams(dateRange);
    const hasPeriod = Boolean(rangeParams.fechaDesde || rangeParams.fechaHasta);
    executeSync(hasPeriod, formatDateRangeLabel(dateRange), rangeParams, 'pendientes');
  };

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

  const handleDownloadXml = async (doc: Comprobante) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('sri_access_token');
      const response = await fetch(`/api/sri/comprobantes/${doc.claveAcceso}/xml`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("No se pudo obtener el XML");
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
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = async (doc: Comprobante) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('sri_access_token');
      const response = await fetch(`/api/sri/comprobantes/${doc.claveAcceso}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("No se pudo obtener el PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ride_${doc.claveAcceso}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast.error("Error al descargar PDF: " + (err instanceof Error ? err.message : "Error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPng = (doc: Comprobante) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 1000;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Contexto de Canvas no soportado");

      // Fondo
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, 800, 1000);

      // Banner Superior
      ctx.fillStyle = "#0F172A"; // Navy oscuro
      ctx.fillRect(20, 20, 760, 100);

      // Texto de Banner
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("COMPROBANTE ELECTRÓNICO - RIDE", 40, 65);
      
      ctx.fillStyle = "#94A3B8";
      ctx.font = "14px monospace";
      ctx.fillText(`Clave de Acceso: ${doc.claveAcceso}`, 40, 95);

      // Datos Emisor
      ctx.fillStyle = "#1E293B";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("DATOS DEL EMISOR", 40, 160);
      
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, 170);
      ctx.lineTo(760, 170);
      ctx.stroke();

      const emisorNombre = doc.emisor?.razonSocial || "—";
      const emisorRucVal = doc.emisor?.ruc || "—";
      
      ctx.fillStyle = "#334155";
      ctx.font = "14px sans-serif";
      ctx.fillText(`Razón Social: ${emisorNombre}`, 40, 195);
      ctx.fillText(`RUC: ${emisorRucVal}`, 40, 215);
      ctx.fillText(`Establecimiento / Secuencial: ${doc.serie || "001-001"} · ${doc.secuencial}`, 40, 235);

      // Datos Receptor
      ctx.fillStyle = "#1E293B";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("DATOS DEL RECEPTOR", 40, 290);
      
      ctx.beginPath();
      ctx.moveTo(40, 300);
      ctx.lineTo(760, 300);
      ctx.stroke();

      ctx.fillStyle = "#334155";
      ctx.fillText(`Razón Social: ${doc.receptorRazonSocial || "CONSUMIDOR FINAL"}`, 40, 325);
      ctx.fillText(`Identificación: ${doc.receptorIdentificacion || "9999999999999"}`, 40, 345);
      ctx.fillText(`Fecha de Emisión: ${doc.fechaEmision ? new Date(doc.fechaEmision).toLocaleDateString('es-EC') : "—"}`, 40, 365);
      if (doc.receptorEmail) {
        ctx.fillText(`Email: ${doc.receptorEmail}`, 40, 385);
      }

      // Detalle/Tabla
      ctx.fillStyle = "#1E293B";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("DETALLE DEL COMPROBANTE", 40, 440);
      
      ctx.fillStyle = "#F8FAFC";
      ctx.fillRect(40, 455, 720, 35);
      
      ctx.fillStyle = "#475569";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("Descripción", 55, 477);
      ctx.fillText("Total", 680, 477);

      ctx.fillStyle = "#334155";
      ctx.font = "14px sans-serif";
      const desc = doc.tipoComprobante === '07' ? 'Servicios de Retención de Impuestos' : 'Consumo / Servicios profesionales de asesoría';
      ctx.fillText(desc, 55, 520);
      ctx.fillText(`$${(doc.importeTotal || 0).toFixed(2)}`, 680, 520);

      ctx.strokeStyle = "#E2E8F0";
      ctx.beginPath();
      ctx.moveTo(40, 540);
      ctx.lineTo(760, 540);
      ctx.stroke();

      // Totales
      const rightAlignX = 520;
      const valAlignX = 680;
      let totalY = 580;
      
      ctx.fillStyle = "#475569";
      ctx.font = "14px sans-serif";
      ctx.fillText("Subtotal sin Impuestos:", rightAlignX, totalY);
      ctx.fillText(`$${(doc.subtotal || 0).toFixed(2)}`, valAlignX, totalY);

      totalY += 25;
      ctx.fillText("Total Descuento:", rightAlignX, totalY);
      ctx.fillText(`$0.00`, valAlignX, totalY);

      totalY += 25;
      const ivaVal = doc.tipoComprobante === '07' ? 0 : (doc.importeTotal - (doc.subtotal || 0));
      ctx.fillText("IVA 15%:", rightAlignX, totalY);
      ctx.fillText(`$${Math.max(0, ivaVal).toFixed(2)}`, valAlignX, totalY);

      totalY += 35;
      ctx.fillStyle = "#F8FAFC";
      ctx.fillRect(480, totalY - 20, 280, 40);
      ctx.strokeStyle = "#CBD5E1";
      ctx.strokeRect(480, totalY - 20, 280, 40);

      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText("VALOR TOTAL:", rightAlignX, totalY + 5);
      ctx.fillText(`$${(doc.importeTotal || 0).toFixed(2)}`, valAlignX, totalY + 5);

      // Clave de acceso (código de barras real en XML autorizado del SRI)
      ctx.fillStyle = "#000000";
      const barcodeX = 40;
      const barcodeY = 750;
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("CLAVE DE ACCESO", barcodeX, barcodeY - 10);
      ctx.font = "11px monospace";
      ctx.fillText(doc.claveAcceso || "—", barcodeX, barcodeY + 10);

      // Pie
      ctx.fillStyle = "#94A3B8";
      ctx.font = "12px sans-serif";
      ctx.fillText("Generado automáticamente por OFSERCONT IA - Ecuador", 40, 950);

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `comprobante_${doc.claveAcceso}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast.error("Error al generar imagen PNG: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const handleDownloadCsv = (doc: Comprobante) => {
    try {
      const tipoLabel = TIPO_DESC[doc.tipoComprobante] || doc.tipoComprobante;
      const isDocVenta = doc.emisor?.ruc === ruc;
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

  const handleExportAllCsv = () => {
    try {
      if (filteredDocs.length === 0) {
        toast.warning("No hay comprobantes para exportar.");
        return;
      }

      const headers = [
        "Tipo",
        "Razon Social Emisor/Receptor",
        "RUC Emisor/Receptor",
        "Serie",
        "Secuencial",
        "Clave de Acceso",
        "Fecha Emision",
        "Subtotal",
        "Total",
        "Estado",
        "Categoria"
      ];

      const rows = filteredDocs.map(doc => {
        const isDocVenta = doc.emisor?.ruc === ruc;
        const partnerName = isDocVenta ? doc.receptorRazonSocial : (doc.emisor?.razonSocial || "—");
        const partnerIdent = isDocVenta ? doc.receptorIdentificacion : (doc.emisor?.ruc || "—");
        const tipoLabel = TIPO_DESC[doc.tipoComprobante] || doc.tipoComprobante;

        return [
          tipoLabel,
          partnerName,
          `="${partnerIdent}"`,
          doc.serie || "—",
          doc.secuencial || "—",
          `="${doc.claveAcceso}"`,
          doc.fechaEmision ? new Date(doc.fechaEmision).toLocaleDateString('es-EC') : "—",
          (doc.subtotal || 0).toFixed(2),
          (doc.importeTotal || 0).toFixed(2),
          doc.estado,
          (doc as any).categoria || "Otros"
        ];
      });

      const csvContent = "\uFEFF" + [
        headers.join(";"),
        ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(";"))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_comprobantes.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error("Error al exportar reporte: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  useEffect(() => {
    if (hasSriLinked) {
      sriClient.getEmisor().then((res) => {
        if (res.success && res.emisor?.ruc) setRuc(res.emisor.ruc);
      }).catch(() => {});
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedDoc(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasSriLinked]);

  useEffect(() => {
    if (hasSriLinked) loadRealDocuments(dateRange);
  }, [dateRange, hasSriLinked]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, flowTab, dateRange, pageSize]);

  // Filter logic — por fecha de emisión del comprobante
  const docsInRange = filterByDateRange(realDocs, (doc) => doc.fechaEmision, dateRange);

  const filteredDocs = docsInRange.filter((doc) => {
    const prov = doc.emisor?.ruc === ruc
      ? (doc.receptorRazonSocial || "")
      : (doc.emisor?.razonSocial || "");
    const num = doc.secuencial || "";
    const rucStr = doc.emisor?.ruc === ruc
      ? (doc.receptorIdentificacion || "")
      : (doc.emisor?.ruc || "");
    const matchesSearch =
      prov.toLowerCase().includes(search.toLowerCase()) ||
      num.toLowerCase().includes(search.toLowerCase()) ||
      rucStr.toLowerCase().includes(search.toLowerCase());

    let matchesType = true;
    const isVenta = doc.emisor?.ruc === ruc;
    const isCompra = doc.emisor?.ruc !== ruc && doc.tipoComprobante === "01";
    const isRetencion = doc.tipoComprobante === "07";

    if (typeFilter === "Compras") matchesType = isCompra;
    else if (typeFilter === "Ventas") matchesType = isVenta;
    else if (typeFilter === "Retenciones") matchesType = isRetencion;

    let matchesFlow = true;
    if (flowTab === "emitidos") matchesFlow = isVenta;
    else if (flowTab === "recibidos") matchesFlow = isCompra;

    return matchesSearch && matchesType && matchesFlow;
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
  const totalCompras = docsInRange.filter(d => d.emisor?.ruc !== ruc && d.tipoComprobante === '01').reduce((s, d) => s + (d.importeTotal || 0), 0);
  const totalVentas = docsInRange.filter(d => d.emisor?.ruc === ruc).reduce((s, d) => s + (d.importeTotal || 0), 0);
  const totalRetenciones = docsInRange.filter(d => d.tipoComprobante === '07').length;
  const noAutorizados = docsInRange.filter(d => d.estado !== 'AUTORIZADO').length;

  const getTypePill = (tipo: string) => {
    if (tipo === '01') return "bg-indigo-50 text-indigo-700";
    if (tipo === '07') return "bg-amber-50 text-amber-700";
    return "bg-emerald-50 text-emerald-700";
  };

  const getEstadoBadge = (estado: string) => {
    if (estado === 'AUTORIZADO') return "bg-emerald-50 text-emerald-700";
    if (estado === 'RECHAZADO') return "bg-red-50 text-red-700";
    return "bg-amber-50 text-amber-700";
  };

  return (
    <>
      <Topbar title="Documentos" period={formatDateRangeLabel(dateRange)} />

      {certWarning && (
        <div className="mx-7 mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs font-semibold text-amber-800 leading-normal flex items-start gap-2.5 shadow-sm animate-fade-in">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <div>{certWarning}</div>
        </div>
      )}

      <div className="p-7 flex-1 flex flex-col gap-5 text-brand-gray-800 select-none">
        <DateRangeFilter value={dateRange} onChange={setDateRange} className="bg-white border border-brand-gray-200 rounded-xl px-4 py-3" />

        {listaTruncada && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs font-medium text-blue-800">
            Mostrando {docsInRange.length} de {totalEnPeriodo} documentos del período.
            Reduce el rango de fechas o exporta a CSV para ver el detalle completo.
          </div>
        )}

        {/* STATS STRIP */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-white border border-brand-gray-200 rounded-xl p-3.5">
            <div className="text-2xl font-extrabold leading-none">{totalDocs}</div>
            <div className="text-[11px] text-brand-gray-400 font-medium mt-1">
              {listaTruncada ? `Total en período (${docsInRange.length} cargados)` : "Total documentos"}
            </div>
          </div>
          <div className="bg-white border border-brand-gray-200 rounded-xl p-3.5">
            <div className="text-2xl font-extrabold text-brand-green-light leading-none">
              ${totalCompras.toFixed(2)}
            </div>
            <div className="text-[11px] text-brand-gray-400 font-medium mt-1">Total compras</div>
          </div>
          <div className="bg-white border border-brand-gray-200 rounded-xl p-3.5">
            <div className="text-2xl font-extrabold text-brand-green-light leading-none">
              ${totalVentas.toFixed(2)}
            </div>
            <div className="text-[11px] text-brand-gray-400 font-medium mt-1">Total ventas</div>
          </div>
          <div className="bg-white border border-brand-gray-200 rounded-xl p-3.5">
            <div className="text-2xl font-extrabold text-brand-amber leading-none">{totalRetenciones}</div>
            <div className="text-[11px] text-brand-gray-400 font-medium mt-1">Retenciones</div>
          </div>
          <div className="bg-white border border-brand-gray-200 rounded-xl p-3.5">
            <div className="text-2xl font-extrabold text-brand-red leading-none">{noAutorizados}</div>
            <div className="text-[11px] text-brand-gray-400 font-medium mt-1">No autorizados</div>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 bg-white border border-brand-gray-200 rounded-lg px-3 py-2 flex items-center gap-2 max-w-md">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-brand-gray-400">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="border-none outline-none flex-1 text-xs text-brand-gray-800 font-sans"
              placeholder="Buscar por proveedor, RUC o número de comprobante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Tabs value={flowTab} onValueChange={(v) => setFlowTab(v as typeof flowTab)}>
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="emitidos">Emitidos</TabsTrigger>
                <TabsTrigger value="recibidos">Recibidos</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="bg-brand-gray-100 rounded-lg p-1 flex gap-1">
              {["Todos", "Compras", "Ventas", "Retenciones"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTypeFilter(tab)}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    typeFilter === tab
                      ? "bg-white text-brand-navy shadow-sm"
                      : "text-brand-gray-600 bg-transparent hover:text-brand-navy"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {hasSriLinked && isApiConnected ? (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportAllCsv}
                  className="bg-white hover:bg-brand-gray-50 border border-brand-gray-200 text-brand-gray-700 px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors"
                >
                  Exportar Excel (CSV)
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-white hover:bg-brand-gray-50 border border-brand-gray-200 text-brand-gray-700 px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors"
                >
                  Importar XMLs
                </button>
                <button
                  onClick={() => setShowMassDownloadModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors"
                >
                  Descarga Masiva SRI
                </button>
                <button
                  onClick={handleSyncSri}
                  disabled={syncing}
                  className="bg-brand-navy hover:bg-brand-navy-mid text-white px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {syncing
                    ? "Sincronizando..."
                    : dateRange.from && dateRange.to
                      ? `Sincronizar período (${formatDateRangeLabel(dateRange)})`
                      : "Sincronizar todos (SRI)"}
                </button>
                {realDocs.some((d) => ["PENDIENTE", "FIRMADO", "ENVIADO", "DEVUELTA"].includes(d.estado)) && (
                  <button
                    onClick={handleSyncPendientes}
                    disabled={syncing}
                    className="bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {syncing ? "Sincronizando..." : "Sync pendientes"}
                  </button>
                )}
                {realDocs.some(d => d.estado === 'PENDIENTE') && (
                  <button
                    onClick={handleRetryPending}
                    disabled={retrying}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {retrying ? "Reintentando..." : "Reintentar Pendientes"}
                  </button>
                )}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  SRI Vinculado
                </div>
              </div>
            ) : (
              <Link
                href="/configuracion?vincular=true"
                className="bg-brand-amber/10 border border-brand-amber/30 hover:bg-brand-amber/20 rounded-lg px-3 py-2 text-xs font-bold text-brand-amber flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <span className="w-2 h-2 bg-brand-amber rounded-full"></span>
                Vincular cuenta SRI
              </Link>
            )}
          </div>
        </div>

        {/* DOCUMENTS TABLE */}
        <div className="bg-white border border-brand-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="w-full overflow-x-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-brand-gray-400">
                <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-sm font-medium">Cargando comprobantes...</span>
              </div>
            ) : !hasSriLinked ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-amber/10 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-brand-amber">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-brand-gray-700">Vincula tu cuenta del SRI</p>
                  <p className="text-xs text-brand-gray-400 mt-1">Configura tu RUC y contraseña del SRI para ver comprobantes</p>
                </div>
                <Link
                  href="/configuracion?vincular=true"
                  className="bg-brand-navy text-white px-5 py-2 rounded-lg text-xs font-bold cursor-pointer hover:bg-brand-navy-mid transition-colors"
                >
                  Vincular SRI
                </Link>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-brand-gray-400">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-sm font-medium">No se encontraron comprobantes</p>
                {search && <p className="text-xs">Prueba con otro término de búsqueda</p>}
              </div>
            ) : (
              <table className="w-full min-w-[1500px] border-collapse text-left text-xs text-brand-gray-800">
                <thead>
                  <tr className="bg-brand-gray-50 border-b border-brand-gray-200 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">
                    <th className="p-3.5 pl-5">RUC y Razón social emisor</th>
                    <th className="p-3.5">Tipo y serie de comprobante</th>
                    <th className="p-3.5">Clave de acceso / Nro. Autorización</th>
                    <th className="p-3.5">Fecha y hora de autorización</th>
                    <th className="p-3.5">Fecha emisión</th>
                    <th className="p-3.5 text-right">Valor sin impuestos</th>
                    <th className="p-3.5 text-right">IVA</th>
                    <th className="p-3.5 text-right">Importe Total</th>
                    <th className="p-3.5 text-center w-[60px]">Documento</th>
                    <th className="p-3.5 text-center w-[60px]">RIDE</th>
                    <th className="p-3.5">Documentos relacionados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gray-100">
                  {paginatedDocs.map((doc, idx) => {
                    const tipo = doc.tipoComprobante || '01';
                    const tipoLabel = TIPO_DESC[tipo] || tipo;
                    const emisorName = doc.emisor?.razonSocial || "—";
                    const emisorRuc = doc.emisor?.ruc || "";
                    
                    return (
                      <tr
                        key={doc.claveAcceso || idx}
                        className="hover:bg-brand-gray-50/70 transition-colors cursor-pointer align-middle"
                        onClick={() => setSelectedDoc(doc)}
                      >
                        <td className="p-3.5 pl-5 max-w-[280px]">
                          <div className="font-semibold text-brand-gray-800 truncate" title={emisorName}>
                            {emisorName}
                          </div>
                          <div className="text-[10px] text-brand-gray-400 mt-0.5">
                            RUC: {emisorRuc || "—"}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 inline-block ${getTypePill(tipo)}`}>
                            {tipoLabel}
                          </span>
                          <div className="text-[10px] text-brand-gray-600 mt-1 font-mono">
                            {doc.serie || "—"}
                          </div>
                        </td>
                        <td className="p-3.5 max-w-[240px]">
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
                              className="text-brand-gray-400 hover:text-brand-navy shrink-0 cursor-pointer"
                              title="Copiar clave de acceso"
                            >
                              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="p-3.5 text-brand-gray-600 whitespace-nowrap">
                          {doc.fechaAutorizacion
                            ? new Date(doc.fechaAutorizacion).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
                            : "—"}
                        </td>
                        <td className="p-3.5 text-brand-gray-600 whitespace-nowrap">
                          {doc.fechaEmision
                            ? new Date(doc.fechaEmision).toLocaleDateString('es-EC')
                            : "—"}
                        </td>
                        <td className="p-3.5 text-right font-medium text-brand-gray-700">
                          ${(doc.subtotal || 0).toFixed(2)}
                        </td>
                        <td className="p-3.5 text-right font-medium text-brand-gray-700">
                          ${(doc.totalIva || 0).toFixed(2)}
                        </td>
                        <td className="p-3.5 text-right font-bold text-brand-gray-900">
                          ${(doc.importeTotal || 0).toFixed(2)}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadXml(doc);
                            }}
                            className="p-1.5 rounded bg-brand-navy/5 text-brand-navy hover:bg-brand-navy/15 hover:text-brand-navy-mid shrink-0 cursor-pointer inline-flex items-center justify-center transition-colors"
                            title="Descargar XML (Documento)"
                          >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3" />
                            </svg>
                          </button>
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPdf(doc);
                            }}
                            className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 shrink-0 cursor-pointer inline-flex items-center justify-center transition-colors"
                            title="Descargar PDF (RIDE)"
                          >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2h6a2 2 0 002-2V10z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14 14a2 2 0 012-2h4a2 2 0 012 2v6a2 2 0 01-2 2h-4a2 2 0 01-2-2v-6z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3" />
                            </svg>
                          </button>
                        </td>
                        <td className="p-3.5 max-w-[220px] truncate text-brand-gray-500 font-medium" title={doc.documentosRelacionados}>
                          {doc.documentosRelacionados || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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

        {isApiConnected && filteredDocs.length === 0 && !isLoading && (
          <div className="text-center text-xs text-brand-gray-400">
            Sin comprobantes con los filtros actuales
          </div>
        )}
      </div>

      {/* DETAIL PANEL OVERLAY */}
      {selectedDoc && (
        <div
          onClick={() => setSelectedDoc(null)}
          className="fixed inset-0 bg-brand-navy/30 backdrop-blur-xs transition-opacity z-50 animate-fade-in"
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
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${getEstadoBadge(selectedDoc.estado || '')}`}>
                    {selectedDoc.estado || 'PENDIENTE'}
                  </span>
                </div>
                <div className="text-sm font-extrabold text-brand-navy mt-1">
                  {selectedDoc.emisor?.razonSocial || selectedDoc.receptorRazonSocial || "Comprobante"}
                </div>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-brand-gray-100 text-brand-gray-400 cursor-pointer transition-colors"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
              {selectedDoc.emisor?.ruc !== ruc && (
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
              <div className="bg-brand-navy/5 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex justify-between text-xs text-brand-gray-600">
                  <span>Subtotal sin impuesto</span>
                  <span className="font-semibold">${(selectedDoc.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-brand-gray-600">
                  <span>IVA</span>
                  <span className="font-semibold">${(selectedDoc.totalIva || 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-brand-gray-200 pt-2 flex justify-between text-sm font-extrabold text-brand-navy">
                  <span>Total</span>
                  <span>${(selectedDoc.importeTotal || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="flex flex-col gap-3.5 p-5 border-t border-brand-gray-100 bg-white">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleDownloadXml(selectedDoc)}
                  className="bg-brand-navy/5 hover:bg-brand-navy/10 border border-brand-navy/20 text-brand-navy py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
                >
                  XML Autorizado
                </button>
                <button
                  onClick={() => handleDownloadPdf(selectedDoc)}
                  className="bg-brand-navy hover:bg-brand-navy-mid text-white py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
                >
                  RIDE PDF
                </button>
                <button
                  onClick={() => handleDownloadPng(selectedDoc)}
                  className="bg-white hover:bg-brand-gray-50 border border-brand-gray-200 text-brand-gray-700 py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
                >
                  Imagen PNG
                </button>
                <button
                  onClick={() => handleDownloadCsv(selectedDoc)}
                  className="bg-white hover:bg-brand-gray-50 border border-brand-gray-200 text-brand-gray-700 py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
                >
                  Excel (CSV)
                </button>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="w-full bg-brand-gray-100 hover:bg-brand-gray-200 transition-colors text-brand-gray-800 py-2.5 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </>
        )}
      </aside>

      <ConfirmDialog
        open={showSyncConfirm}
        title="Sincronizar sin período"
        message="No hay un período de emisión seleccionado. ¿Deseas sincronizar todos los documentos (máx. 500)?"
        confirmLabel="Sincronizar"
        loading={syncing}
        onConfirm={() => executeSync(false, formatDateRangeLabel(dateRange), toDateRangeParams(dateRange))}
        onCancel={() => setShowSyncConfirm(false)}
      />

      <SyncProgressDialog
        open={showSyncResult}
        onClose={() => setShowSyncResult(false)}
        result={syncResult}
        loading={syncing}
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
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 font-semibold leading-normal mt-3">
            {importMessage}
          </div>
        )}
        {importError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 font-semibold max-h-32 overflow-y-auto whitespace-pre-line leading-normal mt-3">
            {importError}
          </div>
        )}
      </Dialog>

      <MassDownloadModal 
        open={showMassDownloadModal} 
        onClose={() => setShowMassDownloadModal(false)} 
      />
    </>
  );
}
