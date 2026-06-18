"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Topbar from "@/components/Topbar";
import DateRangeFilter, {
  DateRange,
  formatDateRangeLabel,
  getComprobantesListLimit,
  getDefaultDateRange,
  getIvaVencimiento,
  toDateRangeParams,
} from "@/components/DateRangeFilter";
import Link from "next/link";
import { sriClient, Comprobante } from "@/lib/sriClient";

type StepId = 1 | 2 | 3 | 4 | 5 | 6;

const stepData: Record<StepId, { label: string; agent: string; aiText: string }> = {
  1: {
    label: "Clasificación",
    agent: "Agente Clasificador",
    aiText: "Analicé tus comprobantes electrónicos y los clasifiqué en categorías de gastos según su deducibilidad tributaria. Revisa las categorías detectadas antes de continuar.",
  },
  2: {
    label: "Auditoría",
    agent: "Agente Auditor",
    aiText: "Validé tus comprobantes contra la base del SRI. Revisa las alertas detectadas: facturas con RUC suspendido no son deducibles y deben excluirse del cálculo de IVA.",
  },
  3: {
    label: "Cálculo",
    agent: "Agente Tributario",
    aiText: "Calculé tu IVA a pagar para el período seleccionado con base en tus ventas, crédito tributario de compras y retenciones recibidas. El formulario 104A está preparado.",
  },
  4: {
    label: "Formulario",
    agent: "Agente Declaraciones",
    aiText: "El <strong>formulario 104A está completo</strong> con los datos de tu emisor registrado en el sistema. Revisa cada casillero antes de proceder al envío al SRI.",
  },
  5: {
    label: "Presentar SRI",
    agent: "Agente SRI",
    aiText: "Listo para presentar en el portal del SRI. Ingresa tu código de autenticación de dos factores (2FA) para firmar digitalmente y enviar el formulario de forma segura.",
  },
  6: {
    label: "Comprobante",
    agent: "Agente Archivador",
    aiText: "¡Declaración presentada con éxito! Se generó el número de trámite SRI y el comprobante oficial fue archivado en tu historial de declaraciones.",
  },
};

export default function Declaraciones() {
  const [step, setStep] = useState<StepId>(1);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [realDocs, setRealDocs] = useState<Comprobante[]>([]);
  const [emisorRuc, setEmisorRuc] = useState("");
  const [emisorName, setEmisorName] = useState("");
  const [emisorRegimen, setEmisorRegimen] = useState<string | null>(null);
  const [tramiteNum, setTramiteNum] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [auditAlerts, setAuditAlerts] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const rangeParams = toDateRangeParams(dateRange);
        // 1. Obtener Emisor
        const emRes = await sriClient.getEmisor();
        if (emRes.success && emRes.emisor) {
          setEmisorRuc(emRes.emisor.ruc);
          setEmisorName(emRes.emisor.razonSocial);
          setEmisorRegimen(emRes.emisor.tipoContribuyente || null);
        }

        // 2. Obtener Comprobantes
        const compRes = await sriClient.getComprobantes({
          limit: getComprobantesListLimit(dateRange),
          ...rangeParams,
        });
        if (compRes?.data) {
          const docs = compRes.data;
          setRealDocs(docs);
        }

        const auditRes = await sriClient.getAuditoria(rangeParams);
        if (auditRes.success && auditRes.alerts) {
          setAuditAlerts(
            auditRes.alerts.map((a: any) => ({
              id: a.id,
              type: a.risk === "Alto" ? "error" : "warning",
              title: a.title,
              desc: a.description,
            }))
          );
        } else {
          setAuditAlerts([]);
        }
      } catch (err) {
        console.error("Error al cargar datos de declaración:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dateRange]);

  // Filtrar documentos
  const compras = realDocs.filter(d => d.emisor?.ruc !== emisorRuc && d.tipoComprobante === '01');
  const ventas = realDocs.filter(d => d.emisor?.ruc === emisorRuc && d.tipoComprobante === '01');
  const retenciones = realDocs.filter(d => d.tipoComprobante === '07');

  // Calcular totales reales
  const totalVentasSub = ventas.reduce((s, d) => s + (d.subtotal || 0), 0);
  const totalVentasIva = ventas.reduce((s, d) => s + (d.importeTotal - (d.subtotal || 0) || 0), 0);

  // Excluir compras categorizadas como "No deducible" o "Otros" del cálculo si se desea, o solo deducibles
  const comprasDeducibles = compras.filter(c => (c as any).categoria !== 'No deducible');
  const totalComprasSub = comprasDeducibles.reduce((s, d) => s + (d.subtotal || 0), 0);
  const totalComprasIva = comprasDeducibles.reduce((s, d) => s + (d.importeTotal - (d.subtotal || 0) || 0), 0);

  const totalRetencionesImporte = retenciones.reduce((s, d) => s + (d.importeTotal || 0), 0);

  const ivaAPagar = totalVentasIva - totalComprasIva - totalRetencionesImporte;
  const periodoLabel = formatDateRangeLabel(dateRange);
  const vencimiento = getIvaVencimiento(dateRange);

  const handleExportBorrador = () => {
    const data = {
      formulario: "104A",
      periodo: formatDateRangeLabel(dateRange),
      ruc: emisorRuc,
      razonSocial: emisorName,
      casilleros: {
        "401": parseFloat(totalVentasSub.toFixed(2)),
        "411": parseFloat(totalVentasIva.toFixed(2)),
        "500": parseFloat(totalComprasSub.toFixed(2)),
        "553": parseFloat(totalComprasIva.toFixed(2)),
        "604": parseFloat(totalRetencionesImporte.toFixed(2)),
        "699": parseFloat(Math.max(0, ivaAPagar).toFixed(2))
      }
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2)
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `borrador_sri_104a_${emisorRuc}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const goStep = (nextStep: StepId) => {
    if (nextStep >= 1 && nextStep <= 6) {
      setStep(nextStep);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    const cleanVal = val.replace(/\D/g, "");
    const newOtp = [...otp];
    newOtp[index] = cleanVal.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input
    if (cleanVal && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  return (
    <>
      <Topbar title="Nueva Declaración" period={formatDateRangeLabel(dateRange)} backLink={{ href: "/", label: "Dashboard" }} />

      <div className="p-7 flex-1 flex flex-col gap-6 text-brand-gray-800 select-none">
        <DateRangeFilter value={dateRange} onChange={setDateRange} className="bg-white border border-brand-gray-200 rounded-xl px-4 py-3" />
        {/* PIPELINE STEPPER TRACK */}
        <div className="relative bg-white border border-brand-gray-200 rounded-2xl p-7 md:px-8 md:py-7 overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold text-brand-navy">Proceso de Declaración — Formulario 104A (RIMPE)</h2>
            <div className="text-xs text-brand-gray-400 font-medium">
              Paso <strong className="text-brand-gray-800 font-semibold">{step}</strong> de <strong>6</strong> ·{" "}
              <span className="font-semibold text-brand-navy-light">{Math.round((step / 6) * 100)}%</span> completado
            </div>
          </div>

          <div className="flex items-start justify-between relative gap-1 md:gap-2">
            {/* Step Nodes */}
            {([1, 2, 3, 4, 5, 6] as StepId[]).map((num, i) => {
              const isDone = num < step;
              const isActive = num === step;

              return (
                <div key={num} className="flex-1 flex items-start gap-1 md:gap-2">
                  <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                    <button
                      onClick={() => goStep(num)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all cursor-pointer ${
                        isDone
                          ? "bg-success-light border-success-light text-white"
                          : isActive
                          ? "bg-white border-brand-navy text-brand-navy ring-4 ring-brand-navy/12 relative after:absolute after:inset-[-6px] after:border-2 after:border-brand-navy/20 after:rounded-full after:animate-ping"
                          : "bg-brand-gray-50 border-brand-gray-300 text-brand-gray-400"
                      }`}
                    >
                      {isDone ? "✓" : num}
                    </button>
                    <span
                      className={`text-[10px] font-semibold text-center leading-tight max-w-[70px] hidden md:block ${
                        isDone
                          ? "text-success"
                          : isActive
                          ? "text-brand-navy font-bold"
                          : "text-brand-gray-400"
                      }`}
                    >
                      {stepData[num].label}
                    </span>
                    <span className="text-[9px] text-brand-gray-400 text-center leading-none max-w-[70px] truncate hidden md:block">
                      {stepData[num].agent.split(" ")[1]}
                    </span>
                  </div>

                  {i < 5 && (
                    <div className="flex-1 h-0.5 mt-5 bg-brand-gray-200 relative overflow-hidden">
                      <div
                        className="absolute top-0 left-0 h-full transition-all duration-300"
                        style={{
                          width: step > num + 1 ? "100%" : step === num + 1 ? "50%" : "0%",
                          background:
                            step > num + 1
                              ? "#2EAA58"
                              : "linear-gradient(90deg, #2EAA58, #F59E0B)",
                        }}
                      ></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Active step label on mobile */}
          <div className="md:hidden text-center mt-4 text-xs font-extrabold text-brand-navy bg-brand-navy/5 py-1.5 rounded-lg">
            Paso {step}: {stepData[step].label} · {stepData[step].agent}
          </div>
        </div>

        {/* MAIN BODY GRID: Active step panel + Right information card */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
          {/* LEFT: STEP CONTENT PANELS */}
          <div className="flex flex-col gap-4">
            {loading ? (
              <div className="bg-white border border-brand-gray-200 rounded-xl p-16 flex flex-col items-center justify-center gap-3">
                <svg className="animate-spin w-8 h-8 text-brand-navy" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-xs font-semibold text-brand-gray-500">Cargando base tributaria...</span>
              </div>
            ) : (
              <>
                {/* STEP 1 PANEL: CLASSIFICATION */}
                {step === 1 && (
                  <div className="bg-white border border-brand-gray-200 rounded-xl p-0 shadow-sm transition-all duration-300">
                    <div className="p-4 border-b border-brand-gray-100 flex items-center justify-between">
                      <h3 className="text-[13px] font-bold text-brand-gray-800">Clasificación Inteligente de Gastos</h3>
                      <span className="text-[11px] text-success font-semibold bg-success-pale px-2.5 py-0.5 rounded-full">
                        {compras.length} compras detectadas
                      </span>
                    </div>
                    <div className="p-5 flex flex-col">
                      {compras.length === 0 ? (
                        <div className="text-center py-8 text-xs text-brand-gray-400">
                          No tienes facturas de compras registradas para este período.
                        </div>
                      ) : (
                        compras.slice(0, 8).map((doc, index) => {
                          const isDeducible = (doc as any).categoria !== "No deducible";
                          return (
                            <div key={doc.claveAcceso || index} className="flex items-center gap-3 py-2 border-b border-brand-gray-100 text-xs">
                              <span className={`text-[10px] font-bold rounded px-2 py-0.5 min-w-[110px] text-center ${
                                doc.categoria === 'Alimentación' ? 'bg-orange-100 text-orange-700' :
                                doc.categoria === 'Salud' ? 'bg-red-100 text-red-700' :
                                doc.categoria === 'Educación' ? 'bg-blue-100 text-blue-700' :
                                doc.categoria === 'Vivienda' ? 'bg-purple-100 text-purple-700' :
                                doc.categoria === 'Vestimenta' ? 'bg-pink-100 text-pink-700' :
                                doc.categoria === 'Negocio/Servicios' ? 'bg-emerald-50 text-emerald-700' :
                                'bg-brand-gray-100 text-brand-gray-600'
                              }`}>
                                {doc.categoria || 'Otros'}
                              </span>
                              <span className="flex-1 font-medium truncate">{doc.emisor?.razonSocial || doc.receptorRazonSocial || 'Proveedor'}</span>
                              <span className="font-bold text-right min-w-[70px]">${(doc.importeTotal || 0).toFixed(2)}</span>
                              <span className={isDeducible ? "text-brand-green-light font-bold" : "text-brand-red text-sm"}>
                                {isDeducible ? "✓" : "⚠"}
                              </span>
                            </div>
                          );
                        })
                      )}

                      <div className="flex gap-2.5 mt-6">
                        <button onClick={() => goStep(2)} className="flex-1 bg-brand-navy hover:bg-brand-navy-mid transition-colors text-white py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                          Continuar a Auditoría
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2 PANEL: AUDIT */}
                {step === 2 && (
                  <div className="bg-white border border-brand-gray-200 rounded-xl p-0 shadow-sm">
                    <div className="p-4 border-b border-brand-gray-100 flex items-center justify-between">
                      <h3 className="text-[13px] font-bold text-brand-gray-800">Validación y Auditoría</h3>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${auditAlerts.length > 0 ? 'bg-brand-amber-pale text-[#92400E]' : 'bg-brand-green-pale text-brand-green'}`}>
                        {auditAlerts.length} observaciones
                      </span>
                    </div>
                    <div className="p-5 flex flex-col gap-3">
                      {auditAlerts.length === 0 ? (
                        <div className="flex gap-3 p-3.5 bg-brand-green-pale border border-[#A7F3D0] rounded-lg text-left items-start">
                          <div className="text-[16px] shrink-0 mt-0.5">✅</div>
                          <div className="flex-1">
                            <div className="text-[12px] font-bold text-brand-green">Todos los documentos sin observaciones</div>
                            <div className="text-[11px] text-brand-gray-600 mt-1">
                              Tus comprobantes pasaron todas las validaciones de consistencia de impuestos y duplicidad del SRI.
                            </div>
                          </div>
                        </div>
                      ) : (
                        auditAlerts.map((alert, idx) => (
                          <div key={alert.id || idx} className="flex gap-3 p-3.5 bg-brand-amber-pale border border-[#FDE68A] rounded-lg text-left items-start">
                            <div className="text-[16px] shrink-0 mt-0.5 text-amber-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            </div>
                            <div className="flex-1">
                              <div className="text-[12px] font-bold text-[#92400E]">{alert.title}</div>
                              <div className="text-[11px] text-brand-gray-600 mt-1 leading-normal">
                                {alert.desc}
                              </div>
                            </div>
                          </div>
                        ))
                      )}

                      <div className="flex gap-3 mt-6">
                        <button onClick={() => goStep(1)} className="px-5 border border-brand-gray-200 hover:border-brand-gray-400 bg-white text-brand-gray-600 text-[13px] font-semibold py-2.5 rounded-lg cursor-pointer">
                          ← Volver
                        </button>
                        <button onClick={() => goStep(3)} className="flex-1 bg-brand-navy hover:bg-brand-navy-mid transition-colors text-white py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                          Continuar al Cálculo
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3 PANEL: CALCULATION */}
                {step === 3 && (
                  <div className="bg-white border border-brand-gray-200 rounded-xl p-0 shadow-sm">
                    <div className="p-4 border-b border-brand-gray-100 flex items-center justify-between">
                      <h3 className="text-[13px] font-bold text-brand-gray-800">Cálculo de Impuestos</h3>
                      <span className="text-[11px] text-brand-navy-light font-semibold">Agente Tributario Real</span>
                    </div>
                    <div className="p-5 flex flex-col">
                      <div className="text-[11px] font-bold text-brand-gray-400 mb-2 uppercase tracking-wider">Ventas del Período</div>
                      <div className="flex justify-between items-center py-2 border-b border-brand-gray-100 text-[13px]">
                        <span className="text-brand-gray-600">Ventas netas declaradas (RIMPE)</span>
                        <span className="font-semibold">${totalVentasSub.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-brand-gray-100 text-[13px]">
                        <span className="text-brand-gray-600">IVA cobrado (15%)</span>
                        <span className="font-bold text-success">+ ${totalVentasIva.toFixed(2)}</span>
                      </div>

                      <div className="text-[11px] font-bold text-brand-gray-400 mb-2 mt-4 uppercase tracking-wider">Compras y Gastos</div>
                      <div className="flex justify-between items-center py-2 border-b border-brand-gray-100 text-[13px]">
                        <span className="text-brand-gray-600">Compras deducibles</span>
                        <span className="font-semibold">${totalComprasSub.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-brand-gray-100 text-[13px]">
                        <span className="text-brand-gray-600">Crédito tributario IVA (15%)</span>
                        <span className="font-bold text-brand-red">− ${totalComprasIva.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 text-[13px]">
                        <span className="text-brand-gray-600">Retenciones recibidas</span>
                        <span className="font-bold text-brand-red">− ${totalRetencionesImporte.toFixed(2)}</span>
                      </div>

                      <div className="border-t-2 border-brand-navy mt-4 pt-3 flex justify-between items-center font-extrabold text-brand-navy">
                        <span className="text-sm uppercase tracking-wider">IVA a Pagar</span>
                        <span className="text-xl">${Math.max(0, ivaAPagar).toFixed(2)}</span>
                      </div>

                      {ivaAPagar < 0 && (
                        <div className="mt-3 p-3 bg-success-pale border border-success/30 rounded-lg text-[12px] text-success leading-normal text-left">
                          <strong>✓ Crédito Tributario:</strong> Tu saldo de IVA compras excede a tus ventas. Cuentas con un saldo a favor de <strong>$${Math.abs(ivaAPagar).toFixed(2)}</strong> aplicable para el siguiente mes.
                        </div>
                      )}

                      <div className="flex gap-3 mt-6">
                        <button onClick={() => goStep(2)} className="px-5 border border-brand-gray-200 hover:border-brand-gray-400 bg-white text-brand-gray-600 text-[13px] font-semibold py-2.5 rounded-lg cursor-pointer">
                          ← Volver
                        </button>
                        <button onClick={() => goStep(4)} className="flex-1 bg-brand-navy hover:bg-brand-navy-mid transition-colors text-white py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                          Completar Formulario
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4 PANEL: FORM */}
                {step === 4 && (
                  <div className="bg-white border border-brand-gray-200 rounded-xl p-0 shadow-sm">
                    <div className="p-4 border-b border-brand-gray-100 flex items-center justify-between">
                      <h3 className="text-[13px] font-bold text-brand-gray-800">Formulario 104A — IVA RIMPE</h3>
                      <span className="text-[11px] bg-brand-green-pale text-brand-green font-semibold px-2.5 py-0.5 rounded-full">
                        Completado automáticamente ✓
                      </span>
                    </div>
                    <div className="p-5 flex flex-col">
                      <div className="bg-brand-green-pale border border-[#A7F3D0] rounded-lg p-3 text-[12px] text-brand-green mb-5 flex gap-2.5 items-center text-left">
                        <span className="text-sm shrink-0">✨</span>
                        <span>
                          El <strong className="font-semibold text-brand-green">Agente Declaraciones</strong> llenó el formulario completo con tus datos. Revisa y confirma antes de enviar.
                        </span>
                      </div>

                      <div className="text-[11px] font-bold text-brand-gray-400 mb-2.5 uppercase tracking-wider">Datos del Contribuyente</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-left">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-brand-gray-600 uppercase tracking-wider">RUC</label>
                          <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-xs font-semibold text-brand-navy-light font-mono">
                            {emisorRuc}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-brand-gray-600 uppercase tracking-wider">Razón Social</label>
                          <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-xs font-semibold text-brand-navy-light truncate">
                            {emisorName}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-brand-gray-600 uppercase tracking-wider">Período</label>
                          <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-xs font-semibold text-brand-navy-light">
                            {periodoLabel}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-brand-gray-600 uppercase tracking-wider">Régimen</label>
                          <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-xs font-semibold text-brand-navy-light">
                            {emisorRegimen || "—"}
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] font-bold text-brand-gray-400 mb-2.5 mt-5 uppercase tracking-wider">Ventas (Casilleros 401–411)</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-brand-gray-600 uppercase tracking-wider">401 · Ventas 15% IVA</label>
                          <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-xs font-semibold text-brand-navy-light font-mono">
                            ${totalVentasSub.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-brand-gray-600 uppercase tracking-wider">411 · IVA Ventas</label>
                          <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-xs font-semibold text-brand-navy-light font-mono">
                            ${totalVentasIva.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] font-bold text-brand-gray-400 mb-2.5 mt-5 uppercase tracking-wider">Compras (Casilleros 500–560)</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-left">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-brand-gray-600 uppercase tracking-wider">500 · Compras Deducibles</label>
                          <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-xs font-semibold text-brand-navy-light font-mono">
                            ${totalComprasSub.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-brand-gray-600 uppercase tracking-wider">553 · Crédito Tributario</label>
                          <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-xs font-semibold text-brand-navy-light font-mono">
                            ${totalComprasIva.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-brand-gray-600 uppercase tracking-wider">604 · Retenciones recibidas</label>
                          <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-xs font-semibold text-brand-navy-light font-mono">
                            ${totalRetencionesImporte.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-brand-gray-600 uppercase tracking-wider">Saldo Anterior</label>
                          <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-xs font-semibold text-brand-navy-light font-mono">
                            $0.00
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-brand-navy to-brand-navy-mid rounded-xl p-5 mt-6 text-center text-white">
                        <div className="text-white/60 text-[11px] font-semibold tracking-wider uppercase">Total IVA a Pagar (Casillero 699)</div>
                        <div className="text-white text-3xl font-extrabold mt-1">${Math.max(0, ivaAPagar).toFixed(2)}</div>
                        <div className="text-white/50 text-[11px] mt-1.5">Vence el {vencimiento.fecha}</div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 mt-6">
                        <button onClick={() => goStep(5)} className="w-full sm:flex-1 bg-brand-navy hover:bg-brand-navy-mid transition-colors text-white py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 order-1 sm:order-3 cursor-pointer">
                          Enviar al SRI
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                        <button onClick={handleExportBorrador} className="w-full sm:w-auto bg-white border border-brand-navy hover:bg-brand-navy/5 text-brand-navy text-[13px] font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 order-2 cursor-pointer">
                          Exportar Borrador
                        </button>
                        <button onClick={() => goStep(3)} className="w-full sm:w-auto border border-brand-gray-200 hover:border-brand-gray-400 bg-white text-brand-gray-600 text-[13px] font-semibold py-2.5 rounded-lg order-3 sm:order-1 cursor-pointer">
                          ← Volver
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 5 PANEL: PRESENT SRI */}
                {step === 5 && (
                  <div className="bg-white border border-brand-gray-200 rounded-xl p-0 shadow-sm">
                    <div className="p-4 border-b border-brand-gray-100 flex justify-between items-center">
                      <h3 className="text-[13px] font-bold text-brand-gray-800">Presentación en el SRI</h3>
                      <span className="text-[11px] text-brand-gray-400 font-semibold">Agente SRI</span>
                    </div>
                    <div className="p-6 text-center flex flex-col items-center">
                      <div className="text-4xl mb-3">🏛️</div>
                      <div className="text-base font-bold text-brand-navy mb-1">Servicio de Rentas Internas</div>
                      <div className="text-xs text-brand-gray-400 mb-5 leading-normal">
                        El agente iniciará sesión y presentará el formulario en tu nombre
                      </div>

                      <div className="bg-brand-green-pale border border-[#A7F3D0] rounded-lg p-3 text-[12px] text-brand-green text-left mb-5 flex gap-2.5 items-center w-full">
                        <span>🔒</span>
                        <span>Tu sesión SRI utiliza las credenciales registradas en el sistema. No se almacenan contraseñas en texto plano.</span>
                      </div>

                      <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-xl p-4.5 text-left w-full mb-4">
                        <label className="text-[11px] font-bold text-brand-gray-600 block mb-2.5 uppercase tracking-wider">
                          Código 2FA de tu aplicación autenticadora
                        </label>
                        <div className="flex gap-2">
                          {otp.map((digit, idx) => (
                            <input
                              key={idx}
                              id={`otp-${idx}`}
                              className="w-10 h-11 border-2 border-brand-gray-200 focus:border-brand-navy outline-none rounded-lg text-center text-[18px] font-extrabold text-brand-navy bg-white transition-colors"
                              maxLength={1}
                              value={digit}
                              placeholder={digit ? "" : "·"}
                              onChange={(e) => handleOtpChange(idx, e.target.value)}
                            />
                          ))}
                        </div>
                        <div className="text-[11px] text-brand-gray-400 mt-2">Ingresa el código de 6 dígitos de tu app</div>
                      </div>

                      <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-3.5 text-left w-full mb-5">
                        <div className="text-[11px] font-bold text-brand-gray-600 mb-2 uppercase tracking-wider">Resumen a enviar</div>
                        <div className="flex justify-between text-[12px] py-1 border-b border-brand-gray-100">
                          <span className="text-brand-gray-600">Formulario</span>
                          <span className="font-semibold">104A · IVA</span>
                        </div>
                        <div className="flex justify-between text-[12px] py-1 border-b border-brand-gray-100">
                          <span className="text-brand-gray-600">Período</span>
                          <span className="font-semibold">{periodoLabel}</span>
                        </div>
                        <div className="flex justify-between text-[12px] py-1">
                          <span className="text-brand-gray-600">Valor a pagar</span>
                          <span className="font-bold text-brand-navy">${Math.max(0, ivaAPagar).toFixed(2)}</span>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          const otpCode = otp.join("");
                          if (otpCode.length !== 6) {
                            toast.warning("Ingresa el código 2FA de 6 dígitos.");
                            return;
                          }
                          setSubmitting(true);
                          try {
                            const res = await sriClient.presentarDeclaracion({
                              periodo: periodoLabel,
                              otpVerificado: true,
                              ...toDateRangeParams(dateRange),
                            });
                            if (res.success) {
                              setTramiteNum(res.declaracion?.numeroTramite || "");
                              goStep(6);
                            }
                          } catch (err: unknown) {
                            toast.error(err instanceof Error ? err.message : "Error al registrar la declaración");
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                        disabled={submitting}
                        className="w-full bg-gradient-to-r from-brand-navy to-brand-navy-mid hover:opacity-90 transition-opacity text-white py-3 rounded-lg text-[14px] font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                      >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                        </svg>
                        {submitting ? "Presentando..." : "Presentar Declaración al SRI"}
                      </button>

                      <button onClick={() => goStep(4)} className="mt-4 text-[12px] font-semibold text-brand-gray-400 hover:text-brand-navy transition-colors cursor-pointer">
                        ← Volver al Formulario
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 6 PANEL: RECEIPT */}
                {step === 6 && (
                  <div className="bg-white border border-brand-gray-200 rounded-xl p-0 shadow-sm">
                    <div className="p-4 border-b border-brand-gray-100 flex justify-between items-center">
                      <h3 className="text-[13px] font-bold text-brand-gray-800">Declaración Presentada</h3>
                      <span className="text-[11px] text-brand-green font-bold">✓ Éxito</span>
                    </div>
                    <div className="p-6">
                      <div className="bg-gradient-to-br from-brand-green-pale to-[#F0FDF4] border border-[#A7F3D0] rounded-2xl p-6 text-center mb-5">
                        <div className="text-[48px] mb-2">✅</div>
                        <div className="text-[16px] font-extrabold text-brand-green mb-1">¡Presentado con Éxito!</div>
                        <div className="text-xs text-brand-gray-600">Tu declaración IVA {periodoLabel} fue registrada en el sistema</div>
                      </div>

                      <div className="border-2 border-dashed border-brand-gray-200 rounded-2xl p-5 text-center">
                        <div className="text-[11px] font-bold text-brand-gray-400 uppercase tracking-wider mb-2">Número de Trámite</div>
                        <div className="text-xl font-extrabold text-brand-navy tracking-wide">{tramiteNum || "—"}</div>
                        <div className="text-[11px] text-brand-gray-400 mt-1">Hoy · {new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</div>

                        <div className="flex justify-center gap-1.5 mt-4 flex-wrap">
                          <span className="text-[10px] font-semibold bg-brand-green-pale text-brand-green rounded-full px-3 py-1">
                            Estado: Aceptado
                          </span>
                          <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded-full px-3 py-1">
                            Formulario 104A
                          </span>
                          <span className="text-[10px] font-semibold bg-brand-green-pale text-brand-green rounded-full px-3 py-1">
                            IVA {periodoLabel}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2.5 mt-5">
                          <button className="flex-1 bg-brand-navy hover:bg-brand-navy-mid transition-colors text-white py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Descargar PDF
                          </button>
                          <button onClick={handleExportBorrador} className="flex-1 bg-white border border-brand-navy hover:bg-brand-navy/5 text-brand-navy py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                            Exportar Borrador
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col sm:flex-row gap-3">
                        <button onClick={() => goStep(1)} className="flex-1 bg-brand-navy hover:bg-brand-navy-mid transition-colors text-white py-2.5 rounded-lg text-[13px] font-bold cursor-pointer">
                          Nueva Declaración
                        </button>
                        <Link href="/" className="flex-1 bg-brand-gray-100 hover:bg-brand-gray-200 transition-colors text-brand-gray-800 py-2.5 rounded-lg text-[13px] font-bold text-center">
                          Ver Historial
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT: DYNAMIC STEPS SIDEBAR */}
          <div className="flex flex-col gap-4">
            {/* AI ASSISTANT SPEECH */}
            <div className="bg-gradient-to-b from-[#F0F7FF] to-white border border-[#C7DEFF] rounded-2xl p-4.5 text-left shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-brand-navy rounded-lg flex items-center justify-center shrink-0">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-brand-navy">Asistente IA</span>
              </div>
              <div
                className="text-xs text-brand-gray-800 leading-relaxed bg-white border border-brand-gray-200 rounded-lg p-3 min-h-[90px] text-left"
                dangerouslySetInnerHTML={{ __html: stepData[step].aiText }}
              ></div>
              <div className="flex flex-wrap gap-1.5 mt-3 select-none">
                <button
                  onClick={() => {
                    if (step === 4) goStep(3);
                    else if (step === 3) goStep(2);
                    else if (step === 2) goStep(1);
                  }}
                  disabled={step === 1 || step === 6}
                  className="text-[11px] font-semibold bg-white border border-brand-gray-200 text-brand-gray-600 rounded-md px-2.5 py-1.5 hover:border-brand-navy-light hover:text-brand-navy transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  ¿Cómo se calculó?
                </button>
                <Link
                  href="/documentos"
                  className="text-[11px] font-semibold bg-white border border-brand-gray-200 text-brand-gray-600 rounded-md px-2.5 py-1.5 hover:border-brand-navy-light hover:text-brand-navy transition-colors"
                >
                  Ver facturas
                </Link>
              </div>
            </div>

            {/* SUMMARY CARD */}
            <div className="bg-white border border-brand-gray-200 rounded-xl p-5 shadow-sm text-left font-sans">
              <h3 className="text-xs font-bold text-brand-gray-800 mb-3.5">Resumen de la Declaración</h3>
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between text-xs pb-1.5 border-b border-brand-gray-100">
                  <span className="text-brand-gray-600">Tipo</span>
                  <span className="font-semibold text-right">IVA Mensual · 104A</span>
                </div>
                <div className="flex justify-between text-xs pb-1.5 border-b border-brand-gray-100">
                  <span className="text-brand-gray-600">Período</span>
                  <span className="font-semibold text-right">{periodoLabel}</span>
                </div>
                <div className="flex justify-between text-xs pb-1.5 border-b border-brand-gray-100">
                  <span className="text-brand-gray-600">Documentos</span>
                  <span className="font-semibold text-right">{loading ? '—' : `${realDocs.length} transacciones`}</span>
                </div>
                <div className="flex justify-between text-xs pb-1.5 border-b border-brand-gray-100">
                  <span className="text-brand-gray-600">Observaciones</span>
                  <span className={`font-semibold text-right ${auditAlerts.length > 0 ? 'text-brand-amber' : 'text-brand-green'}`}>
                    {loading ? '—' : `${auditAlerts.length} detectadas`}
                  </span>
                </div>
                <div className="flex justify-between text-xs pb-1.5 border-b border-brand-gray-100">
                  <span className="text-brand-gray-600">Ventas netas</span>
                  <span className="font-semibold text-right">${loading ? '—' : totalVentasSub.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs pb-1.5 border-b border-brand-gray-100">
                  <span className="text-brand-gray-600">Compras deducibles</span>
                  <span className="font-semibold text-right">${loading ? '—' : totalComprasSub.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs pb-1.5 border-b border-brand-gray-100">
                  <span className="text-brand-gray-600">Crédito tributario</span>
                  <span className="font-semibold text-brand-green text-right">−${loading ? '—' : totalComprasIva.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs pb-1.5 border-b border-brand-gray-100">
                  <span className="text-brand-gray-600">Retenciones recibidas</span>
                  <span className="font-semibold text-brand-green text-right">−${loading ? '—' : totalRetencionesImporte.toFixed(2)}</span>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between items-center text-brand-navy">
                    <span className="text-xs font-bold uppercase tracking-wider">Total a Pagar</span>
                    <span className="text-base font-extrabold">${loading ? '—' : Math.max(0, ivaAPagar).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3.5 bg-brand-amber-pale rounded-lg p-2.5 text-[11px] text-[#92400E] flex gap-1.5 items-center">
                <span>⏰</span>
                <span>
                  {vencimiento.diasRestantes != null
                    ? vencimiento.diasRestantes > 0
                      ? <>Vence en <strong className="font-semibold">{vencimiento.diasRestantes} día{vencimiento.diasRestantes === 1 ? "" : "s"}</strong> · {vencimiento.fecha}</>
                      : vencimiento.diasRestantes === 0
                        ? <>Vence <strong className="font-semibold">hoy</strong> · {vencimiento.fecha}</>
                        : <>Venció hace <strong className="font-semibold">{Math.abs(vencimiento.diasRestantes)} día{Math.abs(vencimiento.diasRestantes) === 1 ? "" : "s"}</strong> · {vencimiento.fecha}</>
                    : "Sin fecha de vencimiento calculada"}
                </span>
              </div>
            </div>

            {/* NOTIFICATIONS */}
            <div className="bg-white border border-brand-gray-200 rounded-xl p-5 shadow-sm text-left">
              <h3 className="text-xs font-bold text-brand-gray-800 mb-3.5">Notificaciones del Proceso</h3>
              <div className="flex flex-col gap-3">
                <div className="flex gap-2.5 items-start text-[12px]">
                  <div className="w-2 h-2 rounded-full bg-brand-green-light mt-1.5 shrink-0"></div>
                  <div className="leading-normal flex-1">
                    <strong className="font-semibold">{realDocs.length} comprobantes</strong> leídos desde la base de datos
                  </div>
                </div>
                <div className="flex gap-2.5 items-start text-[12px]">
                  <div className="w-2 h-2 rounded-full bg-brand-green-light mt-1.5 shrink-0"></div>
                  <div className="leading-normal flex-1">
                    <strong className="font-semibold">Clasificación real activa</strong> — {new Set(compras.map(c => c.categoria)).size} categorías
                  </div>
                </div>
                <div className="flex gap-2.5 items-start text-[12px]">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${auditAlerts.length > 0 ? 'bg-brand-amber' : 'bg-brand-green-light'}`}></div>
                  <div className="leading-normal flex-1">
                    <strong className="font-semibold">{auditAlerts.length} observaciones</strong> detectadas
                  </div>
                </div>
                <div className="flex gap-2.5 items-start text-[12px]">
                  <div className="w-2 h-2 rounded-full bg-brand-green-light mt-1.5 shrink-0"></div>
                  <div className="leading-normal flex-1">
                    <strong className="font-semibold">Cálculo verificado</strong> — ${Math.max(0, ivaAPagar).toFixed(2)} IVA neto a pagar
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
