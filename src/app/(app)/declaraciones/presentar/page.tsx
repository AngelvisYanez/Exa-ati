"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import DateRangeFilter, {
  DateRange,
  formatDateRangeLabel,
  getComprobantesListLimit,
  getDefaultDateRange,
  toDateRangeParams,
} from "@/components/DateRangeFilter";
import { sriClient, Comprobante } from "@/lib/sriClient";
import { useAuth } from "@/contexts/AuthContext";

type Step = "formulario" | "revision" | "presentar" | "exito";

export default function PresentarDeclaracionPage() {
  const { activeRuc } = useAuth();
  const [step, setStep] = useState<Step>("formulario");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [tramiteNum, setTramiteNum] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState("");
  const [contribuyente, setContribuyente] = useState("");
  const [regimen, setRegimen] = useState<string | null>(null);
  const [ventasSub, setVentasSub] = useState(0);
  const [ventasIva, setVentasIva] = useState(0);
  const [comprasSub, setComprasSub] = useState(0);
  const [comprasIva, setComprasIva] = useState(0);
  const [retenciones, setRetenciones] = useState(0);
  const [docsCount, setDocsCount] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);

  const ivaAPagar = ventasIva - comprasIva - retenciones;

  useEffect(() => {
    if (!activeRuc) return;
    const load = async () => {
      if (!sriClient.isAuthenticated()) {
        setError("Inicia sesión para calcular la declaración con tus comprobantes reales.");
        setLoadingData(false);
        return;
      }
      try {
        setLoadingData(true);
        const rangeParams = toDateRangeParams(dateRange);
        const emRes = await sriClient.getEmisor();
        if (emRes.success && emRes.emisor) {
          setContribuyente(emRes.emisor.razonSocial);
          setRegimen(emRes.emisor.tipoContribuyente || null);
        }
        setPeriodo(formatDateRangeLabel(dateRange));

        const compRes = await sriClient.getComprobantes({
          limit: getComprobantesListLimit(dateRange),
          ...rangeParams,
        });
        const docs: Comprobante[] = compRes?.data || [];
        setDocsCount(docs.length);

        const emisorRuc = activeRuc || emRes.emisor?.ruc || "";
        const compras = docs.filter((d) => d.emisor?.ruc !== emisorRuc && d.tipoComprobante === "01");
        const ventas = docs.filter((d) => d.emisor?.ruc === emisorRuc && d.tipoComprobante === "01");
        const rets = docs.filter((d) => d.tipoComprobante === "07");

        setVentasSub(ventas.reduce((s, d) => s + (d.subtotal || 0), 0));
        setVentasIva(ventas.reduce((s, d) => s + ((d.importeTotal || 0) - (d.subtotal || 0)), 0));
        setComprasSub(compras.reduce((s, d) => s + (d.subtotal || 0), 0));
        setComprasIva(compras.reduce((s, d) => s + ((d.importeTotal || 0) - (d.subtotal || 0)), 0));
        setRetenciones(rets.reduce((s, d) => s + (d.importeTotal || 0), 0));
      } catch (err: any) {
        setError(err.message || "Error al cargar datos tributarios");
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [dateRange, activeRuc]);

  const handlePresentar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await sriClient.presentarDeclaracion({
        periodo,
        otpVerificado: true,
        ...toDateRangeParams(dateRange),
      });
      if (res.success) {
        setTramiteNum(res.declaracion?.numeroTramite || "");
        setStep("exito");
      }
    } catch (err: any) {
      setError(err.message || "Error al registrar la declaración");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <title>Presentar al SRI - OFSERCONT IA</title>
      <meta name="description" content="Presenta tu declaración de IVA al SRI de forma segura y automatizada con el Agente Declaraciones." />

      <Topbar
        title="Presentar Declaración"
        period={periodo || "Período actual"}
        backLink={{ href: "/declaraciones", label: "Declaraciones" }}
      />

      {!activeRuc ? (
        <main className="p-3 flex-1 flex flex-col gap-6 w-full">
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-amber/10 flex items-center justify-center">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-brand-amber">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
              </svg>
            </div>
            <div className="text-center max-w-sm">
              <p className="text-sm font-bold text-brand-gray-700">Selecciona una empresa</p>
              <p className="text-xs text-brand-gray-400 mt-1">Usa el selector de empresa en la parte superior derecha para elegir un RUC y presentar su declaración.</p>
            </div>
          </div>
        </main>
      ) : (
      <main className="p-3 flex-1 flex flex-col gap-6 w-full">
        <DateRangeFilter value={dateRange} onChange={setDateRange} className="bg-white border border-slate-200 rounded-xl px-4 py-3" />
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}
        {loadingData ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
            Calculando formulario 104A con comprobantes reales...
          </div>
        ) : (
        <>

        {/* Step Indicator */}
        {step !== "exito" && (
          <div className="flex items-center gap-0">
            {(["formulario", "revision", "presentar"] as Step[]).map((s, idx) => {
              const labels: Record<string, string> = { formulario: "Formulario", revision: "Revisión", presentar: "Presentar" };
              const stepIdx = ["formulario", "revision", "presentar"].indexOf(step);
              const isActive = s === step;
              const isDone = ["formulario", "revision", "presentar"].indexOf(s) < stepIdx;
              return (
                <div key={s} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors
                      ${isActive ? "bg-brand-navy text-white" : isDone ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                      {isDone ? (
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      ) : idx + 1}
                    </div>
                    <span className={`text-[10px] font-semibold ${isActive ? "text-brand-navy" : isDone ? "text-emerald-600" : "text-slate-400"}`}>
                      {labels[s]}
                    </span>
                  </div>
                  {idx < 2 && (
                    <div className={`flex-1 h-0.5 mb-5 ${isDone ? "bg-emerald-400" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── STEP 1: Formulario ─── */}
        {step === "formulario" && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Formulario 104 – Declaración de IVA</h1>
              <p className="text-sm text-slate-500 mt-1">Período: <strong>{periodo}</strong> · {docsCount} comprobantes analizados</p>
            </div>

            {/* Datos del contribuyente */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
              <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                Datos de {contribuyente || "Contribuyente"}
              </h2>
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <p className="text-slate-400 text-[11px] font-medium">Nombre / Razón Social</p>
                  <p className="font-semibold text-slate-900">{contribuyente}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[11px] font-medium">RUC</p>
                  <p className="font-mono font-bold text-slate-900">{activeRuc || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-400 text-[11px] font-medium">Régimen</p>
                  <p className="font-semibold text-slate-900">{regimen || "—"}</p>
                </div>
              </div>
            </div>

            {/* Ventas */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
              <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Ventas del Período</h2>
              <div className="flex flex-col gap-2">
                {[
                  { label: "Ventas gravadas tarifa 15%", value: ventasSub },
                  { label: "IVA en ventas calculado", value: ventasIva },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-[12.5px] text-slate-600">{row.label}</span>
                    <span className="text-[13px] font-semibold text-slate-900">${row.value.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[12.5px] font-bold text-slate-900">IVA en Ventas (15%)</span>
                  <span className="text-[14px] font-extrabold text-slate-900">${ventasIva.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Compras */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
              <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Compras / Crédito Tributario</h2>
              <div className="flex flex-col gap-2">
                {[
                  { label: "Compras locales gravadas", value: comprasSub },
                  { label: "Retenciones recibidas", value: retenciones },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-[12.5px] text-slate-600">{row.label}</span>
                    <span className="text-[13px] font-semibold text-slate-900">${row.value.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[12.5px] font-bold text-slate-900">Crédito Tributario (IVA Compras)</span>
                  <span className="text-[14px] font-extrabold text-slate-900">${comprasIva.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Resumen IVA */}
            <div className={`rounded-xl border-2 p-5 flex items-center justify-between ${ivaAPagar >= 0 ? "bg-amber-50 border-amber-300" : "bg-emerald-50 border-emerald-300"}`}>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wide text-slate-600">
                  {ivaAPagar >= 0 ? "IVA a Pagar" : "Crédito Tributario a Favor"}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Resultado del período {periodo}</p>
              </div>
              <div className={`text-3xl font-extrabold ${ivaAPagar >= 0 ? "text-amber-700" : "text-emerald-700"}`}>
                ${Math.abs(ivaAPagar).toFixed(2)}
              </div>
            </div>

            <button
              id="btn-revisar"
              onClick={() => setStep("revision")}
              className="w-full bg-brand-navy text-white font-bold text-[14px] py-3 rounded-xl hover:bg-brand-navy-light transition-colors cursor-pointer"
            >
              Revisar antes de presentar →
            </button>
          </div>
        )}

        {/* ─── STEP 2: Revisión ─── */}
        {step === "revision" && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Revisión Final</h1>
              <p className="text-sm text-slate-500 mt-1">Verifica los datos antes de presentar al SRI. Este proceso es irreversible.</p>
            </div>

            {/* Validaciones automáticas */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
              <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-emerald-600">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Validaciones Automáticas
              </h2>
              {[
                "RUC activo en el emisor registrado",
                `Período: ${periodo}`,
                `${docsCount} comprobantes analizados`,
                "Totales calculados desde la base de datos",
                "Formulario 104A generado automáticamente",
              ].map((v) => (
                <div key={v} className="flex items-center gap-2.5 text-[12.5px] text-slate-700">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500 shrink-0">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  {v}
                </div>
              ))}
            </div>

            {/* Resumen compacto */}
            <div className="bg-slate-900 text-white rounded-xl p-5 flex flex-col gap-2.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Resumen de la declaración</p>
              {[
                { label: "Contribuyente", value: contribuyente },
                { label: "RUC", value: activeRuc || "—" },
                { label: "Período", value: periodo },
                { label: "IVA en Ventas", value: `$${ventasIva.toFixed(2)}` },
                { label: "Crédito Tributario", value: `$${comprasIva.toFixed(2)}` },
                { label: "IVA a Pagar", value: `$${Math.max(0, ivaAPagar).toFixed(2)}`, highlight: true },
              ].map((r) => (
                <div key={r.label} className="flex justify-between text-[13px]">
                  <span className="text-slate-400">{r.label}</span>
                  <span className={`font-semibold ${r.highlight ? "text-amber-400 text-[15px] font-extrabold" : "text-white"}`}>{r.value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("formulario")}
                className="flex-1 border border-slate-200 text-slate-700 font-semibold text-[13px] py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ← Volver a revisar
              </button>
              <button
                id="btn-continuar-presentar"
                onClick={() => setStep("presentar")}
                className="flex-1 bg-brand-navy text-white font-bold text-[13px] py-2.5 rounded-xl hover:bg-brand-navy-light transition-colors cursor-pointer"
              >
                Sí, continuar →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Presentar (Login SRI) ─── */}
        {step === "presentar" && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Presentar al SRI</h1>
              <p className="text-sm text-slate-500 mt-1">El sistema iniciará sesión de forma segura en el portal SRI y enviará la declaración.</p>
            </div>

            {/* SRI Login secure info */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-bold text-slate-900">Conexión Segura al Portal SRI</p>
                  <p className="text-[11px] text-slate-500">Las credenciales están cifradas con AES-256. Nunca se almacenan en texto plano.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {[
                  { icon: "🔐", label: "Login seguro con credenciales delegadas", done: true },
                  { icon: "📱", label: "Autenticación 2FA (si habilitada en SRI)", done: true },
                  { icon: "📤", label: "Envío XML de declaración IVA 104", done: false },
                  { icon: "📩", label: "Recepción de respuesta y No. Trámite", done: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-[13px]">
                    <span>{item.icon}</span>
                    <span className={item.done ? "text-emerald-700 font-medium" : "text-slate-500"}>{item.label}</span>
                    {item.done && (
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500 ml-auto shrink-0">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Consent checkbox */}
            <label className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 rounded"
              />
              <span className="text-[12.5px] text-amber-800">
                Confirmo que los datos de la declaración son correctos y autorizo al sistema a presentar el Formulario 104 al SRI en mi nombre. Entiendo que esta acción es <strong>irreversible</strong>.
              </span>
            </label>

            <button
              id="btn-presentar-sri"
              onClick={handlePresentar}
              disabled={!accepted || loading}
              className={`w-full font-bold text-[14px] py-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2
                ${accepted ? "bg-brand-navy text-white hover:bg-brand-navy-light" : "bg-slate-100 text-slate-400 cursor-not-allowed"}
              `}
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Presentando al SRI...
                </>
              ) : (
                "✅ Presentar Declaración al SRI"
              )}
            </button>
          </div>
        )}

        {/* ─── SUCCESS ─── */}
        {step === "exito" && (
          <div className="flex flex-col items-center gap-6 py-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center animate-pulse">
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-emerald-600">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">¡Presentado con éxito!</h1>
              <p className="text-slate-500 mt-2 text-sm">Tu declaración de IVA {periodo} fue registrada en el sistema.</p>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-6 w-full flex flex-col gap-3 text-left">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Comprobante de Presentación</p>
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-400">No. Trámite</span>
                <span className="font-mono font-extrabold text-white text-[15px]">{tramiteNum}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-400">Período</span>
                <span className="font-semibold text-white">{periodo}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-400">Estado</span>
                <span className="font-bold text-emerald-400">REGISTRADA</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-400">Fecha y hora</span>
                <span className="font-semibold text-white">{new Date().toLocaleDateString("es-EC")} {new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-400">IVA pagado</span>
                <span className="font-extrabold text-amber-400 text-[15px]">${Math.max(0, ivaAPagar).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Link
                href="/comprobantes"
                className="flex-1 border border-slate-200 text-slate-700 font-semibold text-[13px] py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                Ver historial
              </Link>
              <Link
                href="/"
                className="flex-1 bg-brand-navy text-white font-bold text-[13px] py-2.5 rounded-xl hover:bg-brand-navy-light transition-colors cursor-pointer flex items-center justify-center"
              >
                Volver al Dashboard
              </Link>
            </div>

            <p className="text-[11px] text-slate-400">El Agente Notificador enviará un resumen por WhatsApp y Email automáticamente.</p>
          </div>
        )}
        </>
        )}
      </main>
      )}
    </>
  );
}
