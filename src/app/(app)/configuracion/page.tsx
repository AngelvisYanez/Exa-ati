"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/Topbar";
import WhatsAppMobilePanel from "@/components/WhatsAppMobilePanel";
import IaConfigPanel from "@/components/IaConfigPanel";
import { sriClient, setAuthToken } from "@/lib/sriClient";
import { useToast } from "@/contexts/ToastContext";

type ConfigTab = "general" | "notificaciones" | "integraciones" | "ia";

const tabs: { id: ConfigTab; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "👤" },
  { id: "notificaciones", label: "Notificaciones", icon: "🔔" },
  { id: "integraciones", label: "Móvil & WhatsApp", icon: "💬" },
  { id: "ia", label: "Inteligencia IA", icon: "🤖" },
];

function ConfiguracionContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as ConfigTab | null;
  const [activeTab, setActiveTab] = useState<ConfigTab>(
    tabParam && tabs.some((t) => t.id === tabParam) ? tabParam : "general"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [whatsappInfo, setWhatsappInfo] = useState<{ numero: string | null; estado: string } | null>(null);
  const [emailNotif, setEmailNotif] = useState(true);
  const [whatsappNotif, setWhatsappNotif] = useState(true);
  const [appNotif, setAppNotif] = useState(true);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [loginBanner, setLoginBanner] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  const handleTestSriConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await sriClient.testSriConnection();
      if (res.success) {
        toast.success(`Conexión exitosa con el SRI (Ambiente: ${res.ambiente}). Recepción: ${res.recepcion ? 'OK' : 'FAIL'}, Autorización: ${res.autorizacion ? 'OK' : 'FAIL'}`);
      } else {
        toast.error(`Fallo en la conexión: ${res.error || 'Error de red'}`);
      }
    } catch (err: any) {
      toast.error(`Error al conectar con el SRI: ${err.message || 'Error de red'}`);
    } finally {
      setTestingConnection(false);
    }
  };

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setAuthToken(token);
      setLoginBanner("Sesión móvil vinculada correctamente.");
      toast.success("Sesión móvil vinculada correctamente");
      window.history.replaceState({}, document.title, `/configuracion?tab=integraciones`);
      setActiveTab("integraciones");
    } else if (searchParams.get("logged") === "1") {
      setLoginBanner("Sesión móvil vinculada correctamente.");
      setActiveTab("integraciones");
    }
  }, [searchParams]);

  useEffect(() => {
    if (tabParam && tabs.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    const load = async () => {
      if (!sriClient.isAuthenticated()) {
        setError("Inicia sesión para ver la configuración de tu emisor.");
        setLoading(false);
        return;
      }
      try {
        const res = await sriClient.getConfiguracion();
        if (res.success) {
          setPerfil(res.perfil);
          setWhatsappInfo(res.whatsapp);
          setAppNotif(res.notificaciones?.app ?? true);
          setEmailNotif(res.notificaciones?.email ?? true);
          setWhatsappNotif(res.notificaciones?.whatsapp ?? true);
        }
      } catch (err: any) {
        setError(err.message || "Error al cargar configuración");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const savePrefs = async (app: boolean, whatsapp: boolean) => {
    try {
      await sriClient.updateConfiguracion({
        notifDocumentos: app,
        notifGeneracion: whatsapp,
      });
    } catch (err) {
      console.error("Error al guardar preferencias:", err);
    }
  };

  const initials = perfil?.razonSocial
    ? perfil.razonSocial.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
    : "??";

  const formatSync = (dateStr: string | null) => {
    if (!dateStr) return "Nunca";
    const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Hace ${diffH} h`;
    return new Date(dateStr).toLocaleDateString("es-EC");
  };

  const waEstadoLabel =
    whatsappInfo?.estado === "CONECTADO"
      ? "Conectado"
      : whatsappInfo?.estado === "VINCULANDO"
        ? "Vinculando"
        : "Desconectado";

  return (
    <>
      <title>Configuración - OFSERCONT IA</title>
      <meta name="description" content="Configuración de seguridad, notificaciones e integraciones del sistema OFSERCONT IA." />

      <Topbar title="Configuración" period="Sistema" />

      <main className="p-6 md:p-8 flex-1 flex flex-col gap-6 max-w-5xl mx-auto w-full">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Configuración</h1>
          <p className="text-sm text-slate-500 mt-1">
            Perfil del emisor, canales de notificación e integración móvil/WhatsApp.
          </p>
        </div>

        {loginBanner && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-4 py-3">
            {loginBanner}
          </div>
        )}

        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-white text-brand-navy shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.id === "integraciones" && whatsappInfo?.estado === "CONECTADO" && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="WhatsApp conectado" />
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
            Cargando configuración…
          </div>
        ) : (
          <>
            {activeTab === "general" && perfil && (
              <div className="flex flex-col gap-5">
                <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                      Perfil del contribuyente
                    </h2>
                  </div>
                  <div className="p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-brand-navy to-brand-sky rounded-xl flex items-center justify-center text-white font-extrabold text-xl">
                        {initials}
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-slate-900">{perfil.razonSocial}</p>
                        <p className="text-[12px] text-slate-500">{perfil.regimen} · Ambiente {perfil.ambiente}</p>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">RUC: {perfil.ruc}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Régimen tributario", value: perfil.regimen },
                        { label: "Estado en SRI", value: perfil.estadoSri, highlight: "emerald" as const },
                        { label: "Última sincronización", value: formatSync(perfil.ultimaSincronizacion) },
                        {
                          label: "Firma digital",
                          value: perfil.firmaDigital,
                          highlight: perfil.firmaDigital.includes("Expirada") ? undefined : ("emerald" as const),
                        },
                        { label: "WhatsApp", value: waEstadoLabel, highlight: whatsappInfo?.estado === "CONECTADO" ? ("emerald" as const) : undefined },
                        { label: "Número WhatsApp", value: whatsappInfo?.numero || "No configurado" },
                      ].map((f) => (
                        <div key={f.label} className="flex flex-col gap-0.5">
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{f.label}</p>
                          <p className={`text-[12.5px] font-semibold ${f.highlight === "emerald" ? "text-emerald-700" : "text-slate-900"}`}>
                            {f.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={handleTestSriConnection}
                    disabled={testingConnection}
                    className="flex-1 min-w-[180px] text-center bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {testingConnection ? "Probando conexión..." : "Probar conexión SRI"}
                  </button>
                  <Link
                    href="/documentos"
                    className="flex-1 min-w-[180px] text-center bg-brand-navy text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-brand-navy-light transition-colors"
                  >
                    Sincronizar comprobantes
                  </Link>
                  <button
                    onClick={() => setActiveTab("integraciones")}
                    className="flex-1 min-w-[180px] text-center border border-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Configurar WhatsApp
                  </button>
                </div>
              </div>
            )}

            {activeTab === "notificaciones" && (
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Canales de notificación</h2>
                  <p className="text-[11px] text-slate-500 mt-1">Elige cómo quieres recibir alertas tributarias.</p>
                </div>
                <div className="p-5 flex flex-col divide-y divide-slate-50">
                  {[
                    {
                      label: "Notificaciones en App",
                      desc: "Alertas dentro del sistema",
                      icon: "📱",
                      state: appNotif,
                      toggle: (v: boolean) => {
                        setAppNotif(v);
                        savePrefs(v, whatsappNotif);
                      },
                    },
                    {
                      label: "Notificaciones por Email",
                      desc: "Copias de declaraciones y alertas (próximamente)",
                      icon: "✉️",
                      state: emailNotif,
                      toggle: setEmailNotif,
                      disabled: true,
                    },
                    {
                      label: "Notificaciones por WhatsApp",
                      desc: "Mensajes del Agente Notificador",
                      icon: "💬",
                      state: whatsappNotif,
                      toggle: (v: boolean) => {
                        setWhatsappNotif(v);
                        savePrefs(appNotif, v);
                      },
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-3 gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{item.icon}</span>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{item.label}</p>
                          <p className="text-[11px] text-slate-500">{item.desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => !item.disabled && item.toggle(!item.state)}
                        disabled={item.disabled}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                          item.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                        } ${item.state ? "bg-emerald-500" : "bg-slate-200"}`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                            item.state ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="px-5 pb-5">
                  <button
                    onClick={() => setActiveTab("integraciones")}
                    className="text-sm text-brand-navy font-semibold hover:underline cursor-pointer"
                  >
                    Ir a vincular WhatsApp →
                  </button>
                </div>
              </section>
            )}

            {activeTab === "integraciones" && <WhatsAppMobilePanel />}

            {activeTab === "ia" && (
              <section className="bg-white border border-slate-200 rounded-xl p-5">
                <IaConfigPanel />
              </section>
            )}
          </>
        )}

        {activeTab === "general" && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Privacidad y control de datos</h2>
            </div>
            <div className="p-5">
              {!showRevokeConfirm ? (
                <button
                  onClick={() => setShowRevokeConfirm(true)}
                  className="text-[12.5px] font-semibold text-red-600 hover:text-red-800 border border-red-200 bg-red-50 px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Revocar acceso al SRI
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col gap-3">
                  <p className="text-[12.5px] font-semibold text-red-800">
                    Esta acción requiere soporte administrativo. Contacta al administrador del tenant.
                  </p>
                  <button
                    onClick={() => setShowRevokeConfirm(false)}
                    className="border border-slate-200 text-slate-700 text-[12px] font-semibold py-2 rounded-lg hover:bg-white transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

export default function ConfiguracionPage() {
  return (
    <Suspense fallback={
      <div className="p-8 text-center text-sm text-slate-500">Cargando configuración…</div>
    }>
      <ConfiguracionContent />
    </Suspense>
  );
}
