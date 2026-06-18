"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import DateRangeFilter, {
  DateRange,
  formatDateRangeLabel,
  getDefaultDateRange,
  toDateRangeParams,
} from "@/components/DateRangeFilter";
import { sriClient } from "@/lib/sriClient";

type DeclaracionRow = {
  id: string;
  periodo: string;
  tipo: string;
  tramite: string;
  fecha: string;
  estado: string;
  iva: number;
};

export default function ComprobantesPage() {
  const [comprobantes, setComprobantes] = useState<DeclaracionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);

  useEffect(() => {
    const load = async () => {
      if (!sriClient.isAuthenticated()) {
        setError("Inicia sesión para ver el historial de declaraciones.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await sriClient.getDeclaraciones(toDateRangeParams(dateRange));
        if (res.success) {
          setComprobantes(res.data || []);
        }
      } catch (err: any) {
        setError(err.message || "Error al cargar declaraciones");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dateRange]);

  const totalIva = comprobantes.reduce((s, c) => s + c.iva, 0);
  const aceptadas = comprobantes.filter((c) => c.estado === "REGISTRADA" || c.estado === "ACEPTADA").length;

  return (
    <>
      <title>Comprobantes - OFSERCONT IA</title>
      <meta name="description" content="Historial de declaraciones presentadas al SRI con descarga de comprobantes." />

      <Topbar title="Comprobantes" period={formatDateRangeLabel(dateRange)} />

      <main className="p-3 flex-1 flex flex-col gap-6 w-full">
        <DateRangeFilter value={dateRange} onChange={setDateRange} filterLabel="Período tributario" className="bg-white border border-slate-200 rounded-xl px-4 py-3" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Historial de Declaraciones</h1>
            <p className="text-sm text-slate-500 mt-1">Registro de declaraciones calculadas con tus comprobantes reales.</p>
          </div>
          <Link
            href="/declaraciones/presentar"
            className="flex items-center gap-2 bg-brand-navy text-white text-[13px] font-bold px-4 py-2.5 rounded-lg hover:bg-brand-navy-light transition-colors shrink-0"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Nueva Declaración
          </Link>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Declaraciones registradas", value: loading ? "..." : comprobantes.length, color: "text-slate-900" },
            { label: "IVA total registrado", value: loading ? "..." : `$${totalIva.toFixed(2)}`, color: "text-amber-700" },
            { label: "Registradas correctamente", value: loading ? "..." : comprobantes.length ? `${Math.round((aceptadas / comprobantes.length) * 100)}%` : "0%", color: "text-emerald-700" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-700">Comprobantes de Presentación</span>
            <span className="text-[11px] text-slate-400">Datos desde auditoría del sistema</span>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">Cargando historial...</div>
            ) : comprobantes.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Aún no hay declaraciones registradas. Presenta tu primera declaración desde el asistente.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {["Período", "Tipo", "No. Trámite", "Fecha Presentación", "IVA Pagado", "Estado", "Acciones"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {comprobantes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-900">{c.periodo}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{c.tipo}</span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-slate-600">{c.tramite || "—"}</td>
                      <td className="px-5 py-3.5 text-[12.5px] text-slate-600">{c.fecha}</td>
                      <td className="px-5 py-3.5 text-[13px] font-bold text-amber-700">${c.iva.toFixed(2)}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] font-bold bg-success-pale text-success px-2 py-1 rounded-full">{c.estado}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          href="/declaraciones"
                          className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-navy hover:text-brand-navy-light transition-colors"
                        >
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
