"use client";

import { useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "sonner";
import {
  Play,
  Terminal,
  Cpu,
  ShieldCheck,
  FileCode,
  Globe,
  RefreshCw,
  Zap,
  Activity,
  KeyRound,
} from "lucide-react";

interface TestModuleResult {
  status: "PASSED" | "FAILED" | "WARNING";
  latencyMs: number;
  details: Record<string, unknown>;
}

interface PayloadResponse {
  success: boolean;
  executedBy: string;
  totalExecutionTimeMs: number;
  results: Record<string, TestModuleResult>;
}

export default function AdminPruebasPage() {
  const [loading, setLoading] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [claveAcceso, setClaveAcceso] = useState("");
  const [payloadResponse, setPayloadResponse] = useState<PayloadResponse | null>(null);

  const runTestPayload = async (moduleToRun: string = selectedModule) => {
    if (moduleToRun === "SOAP_AUTORIZAR" && !/^\d{49}$/.test(claveAcceso.trim())) {
      toast.error("Para SOAP Autorizar ingresa una clave de acceso de 49 dígitos");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string> = { module: moduleToRun };
      if (moduleToRun === "SOAP_AUTORIZAR" || (moduleToRun === "ALL" && /^\d{49}$/.test(claveAcceso.trim()))) {
        body.claveAcceso = claveAcceso.trim();
      }

      const res = await apiFetch("/api/admin/test-payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al ejecutar prueba");
      }

      setPayloadResponse(data);
      toast.success("Prueba de diagnóstico completada");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error ejecutando el payload de pruebas";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PASSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-success-pale text-success border border-success-light/40">
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
            PASSED
          </span>
        );
      case "WARNING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            WARNING
          </span>
        );
      case "FAILED":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-brand-red-subtle text-brand-red border border-brand-red-pale">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-red shrink-0" />
            FAILED
          </span>
        );
    }
  };

  return (
    <>
      <title>Consola de Pruebas de Diagnóstico (Payload Admin) - OFSERCONT IA</title>
      <Topbar title="Consola de Pruebas de Módulos (Admin Payload)" />

      <main className="ui-page flex-1">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-brand-gray-200 shadow-xs">
          <div>
            <h1 className="text-xl font-extrabold text-brand-gray-900 tracking-tight flex items-center gap-2.5">
              <Terminal className="w-5 h-5 text-brand-red shrink-0" />
              Payload de Pruebas Integrales de Diagnóstico
            </h1>
            <p className="text-xs text-brand-gray-500 mt-1">
              Consola exclusiva para Administradores. Los módulos SOAP usan solo el WS offline del SRI
              (sin Playwright ni descarga masiva del portal).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="text-xs font-medium border border-brand-gray-200 rounded-lg px-3 py-2 bg-white text-brand-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all cursor-pointer"
              disabled={loading}
            >
              <option value="ALL">Todos los módulos (suite)</option>
              <option value="COMPROBANTES">Comprobantes (XML & clave 49)</option>
              <option value="ENCRYPTION">Cifrado AES-256-GCM</option>
              <option value="RECONCILIACION">Conciliación tributaria</option>
              <option value="SOAP_PING">SOAP — ping WSDL</option>
              <option value="SOAP_AUTORIZAR">SOAP — autorizar por clave</option>
              <option value="PROXY_POOL">Proxy pool (estado)</option>
            </select>

            <button
              onClick={() => runTestPayload()}
              disabled={loading}
              className="flex items-center gap-2 bg-brand-red hover:bg-brand-red-bright text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  Ejecutar Payload
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bloque SOAP aparte — no mezcla con descarga masiva */}
        <div className="bg-white border border-violet-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-brand-gray-900">Pruebas SOAP (módulo aparte)</h2>
              <p className="text-[11px] text-brand-gray-500 mt-0.5">
                Consulta recepción/autorización offline por WSDL. Sirve para claves ya conocidas.
                No lista el portal ni reemplaza Documentos → Descarga masiva SRI.
              </p>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={49}
                  value={claveAcceso}
                  onChange={(e) => setClaveAcceso(e.target.value.replace(/\D/g, "").slice(0, 49))}
                  placeholder="Clave de acceso 49 dígitos (opcional para ping; obligatoria para autorizar)"
                  className="flex-1 text-xs font-mono border border-brand-gray-200 rounded-lg px-3 py-2 bg-white text-brand-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-300/40 focus:border-violet-400"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => runTestPayload("SOAP_PING")}
                  disabled={loading}
                  className="text-xs font-bold px-3 py-2 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-50 cursor-pointer"
                >
                  Ping WSDL
                </button>
                <button
                  type="button"
                  onClick={() => runTestPayload("SOAP_AUTORIZAR")}
                  disabled={loading}
                  className="text-xs font-bold px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 cursor-pointer"
                >
                  Autorizar por clave
                </button>
              </div>
              <p className="text-[10px] text-brand-gray-400 mt-1.5 tabular-nums">
                {claveAcceso.length}/49 dígitos
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {[
            { id: "COMPROBANTES", icon: FileCode, bg: "bg-sky-50 text-brand-sky", title: "Comprobantes", desc: "XML, XSD y claves 49" },
            { id: "ENCRYPTION", icon: ShieldCheck, bg: "bg-success-pale text-success", title: "Seguridad AES-GCM", desc: "Cifrado de secretos" },
            { id: "RECONCILIACION", icon: Cpu, bg: "bg-amber-50 text-amber-600", title: "Conciliación", desc: "SRI vs contabilidad" },
            { id: "SOAP_PING", icon: Globe, bg: "bg-violet-50 text-violet-600", title: "SOAP WSDL", desc: "Ping recepción/auth" },
            { id: "SOAP_AUTORIZAR", icon: KeyRound, bg: "bg-indigo-50 text-indigo-600", title: "SOAP Autorizar", desc: "Consulta por clave" },
            { id: "PROXY_POOL", icon: Activity, bg: "bg-teal-50 text-teal-600", title: "Proxy Pool", desc: "Estado del pool" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedModule(item.id);
                  void runTestPayload(item.id);
                }}
                className="p-4 bg-white border border-brand-gray-200 hover:border-brand-red rounded-xl text-left transition-all hover:shadow-sm cursor-pointer group active:scale-[0.98]"
              >
                <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center mb-3 group-hover:bg-brand-red group-hover:text-white transition-colors`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-brand-gray-900">{item.title}</p>
                <p className="text-[10px] text-brand-gray-500 mt-0.5">{item.desc}</p>
              </button>
            );
          })}
        </div>

        {payloadResponse && (
          <div className="bg-white border border-brand-gray-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-gray-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-brand-gray-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Resultado del payload
                </h2>
                <p className="text-xs text-brand-gray-500 mt-0.5">
                  Ejecutado por: <span className="font-semibold text-brand-gray-700">{payloadResponse.executedBy}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 bg-brand-gray-50 border border-brand-gray-200 rounded-lg px-3 py-1 text-xs">
                <span className="text-brand-gray-500">Tiempo total:</span>
                <strong className="text-brand-gray-900 tabular-nums">{payloadResponse.totalExecutionTimeMs} ms</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(payloadResponse.results).map(([key, result]) => (
                <div key={key} className="border border-brand-gray-200 rounded-xl p-4 bg-brand-gray-50/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-brand-gray-900 uppercase tracking-wider">{key}</span>
                      {getStatusBadge(result.status)}
                    </div>
                    <p className="text-[11px] text-brand-gray-500 mb-2.5">
                      Latencia: <strong className="text-brand-gray-800 tabular-nums">{result.latencyMs} ms</strong>
                    </p>
                    <div className="bg-brand-gray-900 p-3 rounded-lg border border-brand-gray-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48 shadow-inner">
                      <pre className="leading-relaxed">{JSON.stringify(result.details, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
