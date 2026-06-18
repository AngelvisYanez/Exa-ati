"use client";

import { useState, useEffect, useMemo } from "react";
import { sriClient, Comprobante } from "@/lib/sriClient";
import { calculateTaxSummary } from "@/lib/sri-api/tax-calculator";
import {
  DateRange,
  filterByDateRange,
  getComprobantesListLimit,
  toDateRangeParams,
} from "@/components/DateRangeFilter";
import type { MonthlyPoint } from "@/components/charts/MonthlyTrendChart";

function toTaxRows(docs: Comprobante[], rucEmisor: string) {
  return docs.map((d) => ({
    tipo: d.tipoComprobante,
    emisor_ruc: d.emisor?.ruc,
    receptor_identificacion: d.receptorIdentificacion,
    importe_total: d.importeTotal,
    subtotal_sin_impuesto: d.subtotal,
    categoria: d.categoria,
    estado: d.estado,
    fecha_emision: d.fechaEmision,
  }));
}

function groupByMonth(docs: Comprobante[], rucEmisor: string): MonthlyPoint[] {
  const map = new Map<string, { ventas: number; compras: number }>();

  for (const doc of docs) {
    if (doc.tipoComprobante !== "01") continue;
    const date = new Date(doc.fechaEmision);
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toLocaleDateString("es-EC", { month: "short", year: "2-digit" });
    const entry = map.get(key) || { ventas: 0, compras: 0 };
    const amount = doc.importeTotal || 0;
    if (doc.emisor?.ruc === rucEmisor) {
      entry.ventas += amount;
    } else {
      entry.compras += amount;
    }
    map.set(key, entry);
  }

  return Array.from(map.entries()).map(([mes, vals]) => ({
    mes,
    ventas: vals.ventas,
    compras: vals.compras,
  }));
}

export type SyncStatus = {
  lastSyncAt: string | null;
  lastSync: {
    procesados?: number;
    actualizados?: number;
    modo?: string;
    message?: string;
  } | null;
  counts: {
    total: number;
    emitidos: number;
    recibidos: number;
    pendientes: number;
  };
};

export function useDashboardData(dateRange: DateRange) {
  const [docs, setDocs] = useState<Comprobante[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rucEmisor, setRucEmisor] = useState("");
  const [certWarning, setCertWarning] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [enProcesoCount, setEnProcesoCount] = useState(0);
  const [pprCount, setPprCount] = useState(0);

  useEffect(() => {
    if (!sriClient.isAuthenticated()) {
      setLoading(false);
      return;
    }

    const rangeParams = toDateRangeParams(dateRange);
    setLoading(true);

    Promise.all([
      sriClient.getComprobantes({ limit: getComprobantesListLimit(dateRange), ...rangeParams }),
      sriClient.getComprobantes({ estado: 'EN_PROCESO', limit: 1 }).catch(() => ({ meta: { total: 0 } })),
      sriClient.getComprobantes({ estado: 'PPR', limit: 1 }).catch(() => ({ meta: { total: 0 } })),
      sriClient.getEmisor().catch(() => null),
      sriClient.getSyncStatus().catch(() => null),
    ])
      .then(([compRes, enProcesoRes, pprRes, emisorRes, syncRes]) => {
        if (compRes?.data) {
          setDocs(compRes.data);
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }

        setEnProcesoCount((enProcesoRes as any)?.meta?.total || 0);
        setPprCount((pprRes as any)?.meta?.total || 0);

        if (emisorRes?.success && emisorRes.emisor) {
          setRucEmisor(emisorRes.emisor.ruc);
          if (emisorRes.emisor.certificadoExpiracion) {
            const expDate = new Date(emisorRes.emisor.certificadoExpiracion);
            const diffDays = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) {
              setCertWarning(`Firma electrónica expirada hace ${Math.abs(diffDays)} días (fecha: ${expDate.toLocaleDateString()}).`);
            } else if (diffDays <= 30) {
              setCertWarning(`Firma electrónica vencerá en ${diffDays} días (fecha: ${expDate.toLocaleDateString()}).`);
            } else {
              setCertWarning(null);
            }
          }
        }

        if (syncRes?.success) {
          setSyncStatus({
            lastSyncAt: syncRes.lastSyncAt,
            lastSync: syncRes.lastSync,
            counts: syncRes.counts,
          });
        }
      })
      .catch(() => setIsConnected(false))
      .finally(() => setLoading(false));
  }, [dateRange]);

  const docsInRange = filterByDateRange(docs, (d) => d.fechaEmision, dateRange);
  const taxSummary = useMemo(
    () => calculateTaxSummary(toTaxRows(docsInRange, rucEmisor), rucEmisor),
    [docsInRange, rucEmisor]
  );

  const getCategoryTotal = (catName: string) =>
    taxSummary.comprasDeducibles
      .filter((d) => (d as { categoria?: string }).categoria === catName)
      .reduce((s, d) => s + (parseFloat(String((d as { importe_total?: number }).importe_total ?? 0)) || 0), 0);

  const categories = [
    { name: "Alimentación", amount: getCategoryTotal("Alimentación") },
    { name: "Salud", amount: getCategoryTotal("Salud") },
    { name: "Educación", amount: getCategoryTotal("Educación") },
    { name: "Vivienda", amount: getCategoryTotal("Vivienda") },
    { name: "Vestimenta", amount: getCategoryTotal("Vestimenta") },
    { name: "Negocio/Servicios", amount: getCategoryTotal("Negocio/Servicios") },
    {
      name: "Otros",
      amount: taxSummary.comprasDeducibles
        .filter((d) => !(d as { categoria?: string }).categoria || (d as { categoria?: string }).categoria === "Otros")
        .reduce((s, d) => s + (parseFloat(String((d as { importe_total?: number }).importe_total ?? 0)) || 0), 0),
    },
  ];

  const monthlyTrend = useMemo(() => groupByMonth(docsInRange, rucEmisor), [docsInRange, rucEmisor]);

  return {
    loading,
    isConnected,
    rucEmisor,
    certWarning,
    docsInRange,
    taxSummary,
    categories,
    monthlyTrend,
    totalVentas: taxSummary.totalVentasImporte,
    totalCompras: taxSummary.totalComprasImporte,
    ivaAPagar: taxSummary.ivaAPagarNeto,
    ventasCount: taxSummary.ventas.length,
    comprasCount: taxSummary.compras.length,
    retencionesCount: taxSummary.retenciones.length,
    noAuthCount: docsInRange.filter((d) => d.estado !== "AUTORIZADO").length,
    notasCreditoCount: docsInRange.filter((d) => d.tipoComprobante === "04").length,
    recentDocs: docsInRange.slice(0, 6),
    syncStatus,
    enProcesoCount,
    pprCount,
  };
}
