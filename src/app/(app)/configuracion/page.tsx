"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/Topbar";
import WhatsAppMobilePanel from "@/components/WhatsAppMobilePanel";
import IaConfigPanel from "@/components/IaConfigPanel";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ProxyConfigPanel from "@/components/ProxyConfigPanel";
import { sriClient, setAuthToken } from "@/lib/sriClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { User, Users, Bell, MessageSquare, Bot, Building2, Plus, Edit, Trash2, Smartphone, Mail, Code } from "lucide-react";

type ConfigTab = "general" | "clientes" | "notificaciones" | "integraciones" | "ia" | "desarrollo";

const tabs: { id: ConfigTab; label: string; icon: React.ReactNode; roles?: string[] }[] = [
  {
    id: "general",
    label: "General",
    icon: <User className="w-4 h-4 shrink-0" />
  },
  {
    id: "clientes",
    label: "Clientes / Usuarios",
    roles: ["ADMIN", "SUPERADMIN"],
    icon: <Users className="w-4 h-4 shrink-0" />
  },
  {
    id: "notificaciones",
    label: "Notificaciones",
    icon: <Bell className="w-4 h-4 shrink-0" />
  },
  {
    id: "integraciones",
    label: "Móvil & WhatsApp",
    icon: <MessageSquare className="w-4 h-4 shrink-0" />
  },
  {
    id: "ia",
    label: "Inteligencia IA",
    icon: <Bot className="w-4 h-4 shrink-0" />
  },
  {
    id: "desarrollo",
    label: "Desarrollo",
    roles: ["SUPERADMIN", "ADMIN"],
    icon: <Code className="w-4 h-4 shrink-0" />
  },
];

function ConfiguracionContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as ConfigTab | null;
  const { user, activeRuc, refreshSriStatus, setActiveRuc } = useAuth();
  
  const allowedTabs = tabs.filter((t) => {
    if (!t.roles) return true;
    return user && t.roles.includes(user.rol);
  });

  const [activeTab, setActiveTab] = useState<ConfigTab>(
    tabParam && allowedTabs.some((t) => t.id === tabParam) ? tabParam : "general"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [emisores, setEmisores] = useState<any[]>([]);
  const [whatsappInfo, setWhatsappInfo] = useState<{ numero: string | null; estado: string } | null>(null);
  const [emailNotif, setEmailNotif] = useState(true);
  const [whatsappNotif, setWhatsappNotif] = useState(true);
  const [appNotif, setAppNotif] = useState(true);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [loginBanner, setLoginBanner] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  // Estados para subida de certificado
  const [showCertUpload, setShowCertUpload] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const [certRuc, setCertRuc] = useState('');
  const [uploadingCert, setUploadingCert] = useState(false);
  const [certResult, setCertResult] = useState<any>(null);

  // Estados para Clientes
  const [clientes, setClientes] = useState<any[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [clientNombre, setClientNombre] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [clientRuc, setClientRuc] = useState("");
  const [clientRol, setClientRol] = useState("USER");
  const [submittingClient, setSubmittingClient] = useState(false);

  // Estados para Edición de Usuarios
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editClientId, setEditClientId] = useState("");
  const [editNombre, setEditNombre] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRuc, setEditRuc] = useState("");
  const [editRol, setEditRol] = useState("USER");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Estados para diálogos de confirmación estilizados
  const [showRucDisconnectConfirm, setShowRucDisconnectConfirm] = useState(false);
  const [rucToDisconnect, setRucToDisconnect] = useState<string | null>(null);
  const [showDeleteClientConfirm, setShowDeleteClientConfirm] = useState(false);
  const [clientToDeleteId, setClientToDeleteId] = useState<string | null>(null);
  const [clientToDeleteName, setClientToDeleteName] = useState<string | null>(null);

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
    if (tabParam && allowedTabs.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam, user]);

  const loadConfig = async () => {
    if (!sriClient.isAuthenticated()) {
      setError("Inicia sesión para ver la configuración de tu emisor.");
      setLoading(false);
      return;
    }
    try {
      const res = await sriClient.getConfiguracion();
      if (res.success) {
        setPerfil(res.perfil);
        setEmisores(res.emisores || []);
        setWhatsappInfo(res.whatsapp);
        setAppNotif(res.notificaciones?.app ?? true);
        setEmailNotif(res.notificaciones?.email ?? true);
        setWhatsappNotif(res.notificaciones?.whatsapp ?? true);
      }
    } catch (err: any) {
      if (err.message?.includes("404") || err.message?.includes("not encontrado") || err.message?.includes("no encontrado")) {
        setPerfil(null);
      } else {
        setError(err.message || "Error al cargar configuración");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [activeRuc]);

  const loadClientes = async () => {
    if (user?.rol !== 'ADMIN' && user?.rol !== 'SUPERADMIN') return;
    setLoadingClientes(true);
    try {
      const res = await sriClient.getClientes();
      if (res.success && res.clientes) {
        setClientes(res.clientes);
      }
    } catch (err: any) {
      console.error("Error al cargar clientes:", err);
    } finally {
      setLoadingClientes(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'clientes') {
      loadClientes();
    }
  }, [activeTab]);

  const handleDisconnectRuc = (ruc: string) => {
    setRucToDisconnect(ruc);
    setShowRucDisconnectConfirm(true);
  };

  const confirmDisconnectRuc = async () => {
    if (!rucToDisconnect) return;
    try {
      const res = await sriClient.desvincularSri(rucToDisconnect);
      if (res.success) {
        toast.success("RUC desvinculado correctamente");
        await refreshSriStatus();
        await loadConfig();
      } else {
        toast.error(res.message || "Error al desvincular RUC");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al desvincular");
    } finally {
      setShowRucDisconnectConfirm(false);
      setRucToDisconnect(null);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingClient(true);
    try {
      const res = await sriClient.createCliente({
        email: clientEmail,
        password: clientPassword,
        nombre: clientNombre,
        ruc: clientRuc || undefined,
        rol: clientRol,
      });
      if (res.success) {
        toast.success("Usuario creado correctamente");
        setIsCreateModalOpen(false);
        setClientEmail("");
        setClientPassword("");
        setClientNombre("");
        setClientRuc("");
        setClientRol("USER");
        await loadClientes();
      } else {
        toast.error(res.message || "Error al registrar usuario");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al crear");
    } finally {
      setSubmittingClient(false);
    }
  };

  const handleOpenEditModal = (c: any) => {
    setEditClientId(c.id);
    setEditNombre(c.nombre || "");
    setEditEmail(c.email || "");
    setEditPassword("");
    setEditRuc(c.ruc || "");
    setEditRol(c.rol || "USER");
    setIsEditModalOpen(true);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEdit(true);
    try {
      const res = await sriClient.updateCliente(editClientId, {
        nombre: editNombre,
        email: editEmail,
        password: editPassword || undefined,
        ruc: editRuc || undefined,
        rol: editRol,
      });
      if (res.success) {
        toast.success("Usuario actualizado correctamente");
        setIsEditModalOpen(false);
        await loadClientes();
      } else {
        toast.error(res.message || "Error al actualizar usuario");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleUpdateClientRuc = async (clientId: string, ruc: string) => {
    try {
      const res = await sriClient.updateCliente(clientId, { ruc });
      if (res.success) {
        toast.success("Empresa/RUC asociada al cliente correctamente");
        await loadClientes();
      } else {
        toast.error(res.message || "Error al asociar RUC");
      }
    } catch (err: any) {
      toast.error(err.message || "Error de red");
    }
  };

  const handleToggleClientStatus = async (clientId: string, currentStatus: boolean) => {
    try {
      const res = await sriClient.updateCliente(clientId, { activo: !currentStatus });
      if (res.success) {
        toast.success("Estado del usuario modificado correctamente");
        await loadClientes();
      } else {
        toast.error(res.message || "Error al modificar estado");
      }
    } catch (err: any) {
      toast.error(err.message || "Error de red");
    }
  };

  const handleDeleteClient = (clientId: string, nombre: string) => {
    setClientToDeleteId(clientId);
    setClientToDeleteName(nombre);
    setShowDeleteClientConfirm(true);
  };

  const confirmDeleteClient = async () => {
    if (!clientToDeleteId) return;
    try {
      const res = await sriClient.deleteCliente(clientToDeleteId);
      if (res.success) {
        toast.success("Usuario cliente eliminado correctamente");
        await loadClientes();
      } else {
        toast.error(res.message || "Error al eliminar cliente");
      }
    } catch (err: any) {
      toast.error(err.message || "Error de red");
    } finally {
      setShowDeleteClientConfirm(false);
      setClientToDeleteId(null);
      setClientToDeleteName(null);
    }
  };

  const savePrefs = async (app: boolean, whatsapp: boolean) => {
    try {
      const res = await sriClient.updateConfiguracion({
        notifDocumentos: app,
        notifGeneracion: whatsapp,
      });
      if (!res.success) toast.error(res.message || "Error al guardar preferencias");
    } catch (err) {
      toast.error("Error al guardar preferencias");
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

      <main className="p-3 flex-1 flex flex-col gap-6 w-full">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-gray-800">Configuración</h1>
          <p className="text-sm text-brand-gray-600 mt-1">
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
        <div className="flex gap-1 bg-brand-gray-100 p-1 rounded-xl overflow-x-auto">
          {allowedTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-white text-brand-navy shadow-sm"
                  : "text-brand-gray-500 hover:text-brand-gray-700"
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
          <div className="bg-white border border-brand-gray-200 rounded-xl p-10 text-center text-sm text-brand-gray-500">
            Cargando configuración…
          </div>
        ) : (
          <>
            {activeTab === "general" && perfil && (
              <div className="flex flex-col gap-5">
                <section className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-brand-gray-100">
                    <h2 className="text-[13px] font-bold text-brand-gray-700 uppercase tracking-wide">
                      Perfil del contribuyente
                    </h2>
                  </div>
                  <div className="p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-brand-navy to-brand-navy-light rounded-xl flex items-center justify-center text-white font-extrabold text-xl shadow-sm">
                        {initials}
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-brand-gray-800">{perfil.razonSocial}</p>
                        <p className="text-[12px] text-brand-gray-500">{perfil.regimen} · Ambiente {perfil.ambiente}</p>
                        <p className="text-[11px] font-mono text-brand-gray-400 mt-0.5">RUC: {perfil.ruc}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Régimen tributario", value: perfil.regimen },
                        { label: "Estado en SRI", value: perfil.estadoSri, highlight: "emerald" },
                        { label: "Última sincronización", value: formatSync(perfil.ultimaSincronizacion) },
                        {
                          label: "Firma digital",
                          value: perfil.firmaDigital,
                          highlight: perfil.firmaDigital.includes("Expirada") ? undefined : ("emerald" as const),
                        },
                        { label: "WhatsApp", value: waEstadoLabel, highlight: whatsappInfo?.estado === "CONECTADO" ? ("emerald" as const) : undefined },
                        { label: "Número WhatsApp", value: whatsappInfo?.numero || "No configurado" },
                        { label: "Polling SRI (PPR)", value: "C/15 min · 24h máx.", highlight: "emerald" as const },
                        { label: "Delay entre fases", value: "2 segundos (configurable)" },
                      ].map((f) => (
                        <div key={f.label} className="flex flex-col gap-0.5">
                          <p className="text-[10px] text-brand-gray-400 font-medium uppercase tracking-wide">{f.label}</p>
                          <p className={`text-[12.5px] font-semibold ${f.highlight === "emerald" ? "text-emerald-700" : "text-brand-gray-800"}`}>
                            {f.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* === FIRMA DIGITAL / CERTIFICADO .P12 === */}
                <section className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-brand-gray-100">
                    <h2 className="text-[13px] font-bold text-brand-gray-700 uppercase tracking-wide">Firma electrónica</h2>
                    <p className="text-[11px] text-brand-gray-500 mt-0.5">Certificado digital .p12 para firmar comprobantes electrónicos.</p>
                  </div>
                  <div className="p-5">
                    {certResult?.success ? (
                      <div className="flex flex-col gap-3">
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-xs font-semibold">
                          Certificado válido · Expira: {new Date(certResult.data.validation.expiryDate).toLocaleDateString('es-EC')} ({certResult.data.validation.daysUntilExpiry} días)
                        </div>
                        <button onClick={() => { setShowCertUpload(false); setCertFile(null); setCertPassword(''); setCertResult(null); }}
                          className="text-xs text-brand-navy font-semibold hover:underline self-start cursor-pointer">
                          Subir otro certificado
                        </button>
                      </div>
                    ) : perfil?.firmaDigital && !perfil.firmaDigital.includes('No registrada') ? (
                      <div className="flex flex-col gap-3">
                        <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-3 text-xs font-semibold text-brand-gray-700">
                          {perfil.firmaDigital}
                        </div>
                        <button onClick={() => setShowCertUpload(true)}
                          className="text-xs bg-brand-navy text-white font-bold px-4 py-2 rounded-lg hover:bg-brand-navy-light transition-colors self-start cursor-pointer">
                          Reemplazar certificado
                        </button>
                      </div>
                    ) : !showCertUpload ? (
                      <button onClick={() => setShowCertUpload(true)}
                        className="text-xs bg-brand-navy text-white font-bold px-4 py-2 rounded-lg hover:bg-brand-navy-light transition-colors cursor-pointer">
                        Subir certificado .p12
                      </button>
                    ) : null}

                    {showCertUpload && (
                      <div className="flex flex-col gap-4 mt-3 p-4 bg-brand-gray-50 rounded-xl border border-brand-gray-200">
                        <select value={certRuc || activeRuc || perfil?.ruc || ''} onChange={e => setCertRuc(e.target.value)}
                          className="bg-white border border-brand-gray-200 rounded-lg p-2 text-xs text-brand-gray-800 focus:border-brand-navy outline-none cursor-pointer">
                          <option value="" disabled>Seleccionar RUC...</option>
                          {emisores.map(em => (
                            <option key={em.ruc} value={em.ruc}>{em.ruc} — {em.razonSocial}</option>
                          ))}
                        </select>
                        <input type="file" accept=".p12" onChange={e => setCertFile(e.target.files?.[0] || null)}
                          className="text-xs text-brand-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-navy file:text-white hover:file:bg-brand-navy-light cursor-pointer" />
                        <input type="password" placeholder="Contraseña del certificado" value={certPassword}
                          onChange={e => setCertPassword(e.target.value)}
                          className="bg-white border border-brand-gray-200 rounded-lg p-2 text-xs text-brand-gray-800 focus:border-brand-navy outline-none" />
                        <div className="flex gap-2">
                          <button onClick={async () => {
                            const rucFinal = certRuc || activeRuc || perfil?.ruc || '';
                            if (!certFile || !certPassword) { toast.error('Selecciona un archivo .p12 y escribe la contraseña'); return; }
                            if (!rucFinal) { toast.error('Selecciona el RUC al que vincular el certificado'); return; }
                            setUploadingCert(true); setCertResult(null);
                            try {
                              const fd = new FormData();
                              fd.append('cert', certFile);
                              fd.append('password', certPassword);
                              fd.append('ruc', rucFinal);
                              const res = await sriClient.uploadCertificado(fd);
                              setCertResult(res);
                              if (res.success) { toast.success('Certificado validado y vinculado al RUC ' + rucFinal); setShowCertUpload(false); await loadConfig(); }
                              else toast.error(res.message || 'Error al subir certificado');
                            } catch (err: any) { toast.error(err.message || 'Error al subir certificado'); }
                            finally { setUploadingCert(false); }
                          }} disabled={uploadingCert}
                            className="bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 cursor-pointer">
                            {uploadingCert ? 'Subiendo...' : 'Subir y validar'}
                          </button>
                          <button onClick={() => { setShowCertUpload(false); setCertFile(null); setCertPassword(''); setCertRuc(''); setCertResult(null); }}
                            className="border border-brand-gray-200 text-brand-gray-600 text-xs font-bold px-4 py-2 rounded-lg hover:bg-white transition-colors cursor-pointer">
                            Cancelar
                          </button>
                        </div>
                        {certResult && !certResult.success && (
                          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs font-semibold">
                            {certResult.message || 'Error al procesar el certificado'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {user?.rol !== "USER" && (
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={handleTestSriConnection}
                      disabled={testingConnection}
                      className="flex-1 min-w-[180px] text-center bg-brand-gray-100 hover:bg-brand-gray-200 text-brand-gray-700 text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {testingConnection ? "Probando conexión..." : "Probar conexión SRI"}
                    </button>
                    <Link
                      href="/configuracion?vincular=true"
                      className="flex-1 min-w-[180px] text-center bg-brand-gray-100 hover:bg-brand-gray-200 text-brand-gray-700 text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center"
                    >
                      Actualizar contraseña SRI
                    </Link>
                    <Link
                      href="/documentos"
                      className="flex-1 min-w-[180px] text-center bg-brand-navy text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-brand-navy-light transition-colors flex items-center justify-center"
                    >
                      Sincronizar comprobantes
                    </Link>
                    <button
                      onClick={() => setActiveTab("integraciones")}
                      className="flex-1 min-w-[180px] text-center border border-brand-gray-200 text-brand-gray-600 text-sm font-semibold py-2.5 rounded-lg hover:bg-brand-gray-50 transition-colors cursor-pointer"
                    >
                      Configurar WhatsApp
                    </button>
                  </div>
                )}

                {(user?.rol === "ADMIN" || user?.rol === "SUPERADMIN") && (
                  <section className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden mt-2">
                    <div className="px-5 py-4 border-b border-brand-gray-100 flex justify-between items-center flex-wrap gap-2">
                      <div>
                        <h2 className="text-[13px] font-bold text-brand-gray-700 uppercase tracking-wide">
                          Empresas / RUCs Vinculados
                        </h2>
                        <p className="text-[11px] text-brand-gray-500 mt-0.5">
                          Administra y conecta las diferentes cuentas del portal SRI.
                        </p>
                      </div>
                      <Link
                        href="/configuracion?vincular=true"
                        className="bg-brand-navy text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-brand-navy-light transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                      >
                        Conectar Empresa SRI
                      </Link>
                    </div>
                    <div className="p-5 flex flex-col gap-3">
                      {emisores.length === 0 ? (
                        <p className="text-sm text-brand-gray-500 text-center py-4">No hay empresas vinculadas.</p>
                      ) : (
                        <div className="grid gap-3">
                          {emisores.map((e) => (
                            <div key={e.ruc} className={`flex items-center justify-between p-3.5 border rounded-xl transition-all ${e.ruc === activeRuc ? 'border-brand-navy bg-brand-gray-50' : 'border-brand-gray-200 bg-white'}`}>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-brand-gray-100 rounded-lg flex items-center justify-center text-brand-gray-500 shadow-xs">
                                  <Building2 className="w-4.5 h-4.5 shrink-0" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-brand-gray-800 flex items-center gap-1.5 flex-wrap">
                                    <span className="truncate max-w-[200px]">{e.razonSocial}</span>
                                    {e.ruc === activeRuc && (
                                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-full px-1.5 py-0.5 shrink-0">
                                        Activo
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[11px] text-brand-gray-400 font-mono mt-0.5">RUC: {e.ruc} · Ambiente: {e.ambiente}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {e.ruc !== activeRuc && (
                                  <button
                                    onClick={() => setActiveRuc(e.ruc)}
                                    className="text-xs bg-brand-gray-100 hover:bg-brand-gray-200 text-brand-gray-700 font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Seleccionar
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDisconnectRuc(e.ruc)}
                                  className="text-xs border border-red-200 hover:bg-red-50 text-red-600 font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                >
                                  Desconectar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}

            {activeTab === "general" && !perfil && (
              <div className="bg-white border border-brand-gray-200 rounded-xl p-8 text-center flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-amber/10 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-brand-amber">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-gray-800">No tienes una cuenta del SRI vinculada</h3>
                  <p className="text-xs text-brand-gray-500 mt-1 font-medium">Vincula tu RUC y contraseña del SRI para comenzar a sincronizar tus comprobantes electrónicos automáticamente.</p>
                </div>
                <Link
                  href="/configuracion?vincular=true"
                  className="bg-brand-navy text-white px-6 py-2.5 rounded-lg text-xs font-bold hover:bg-brand-navy-light transition-all active:scale-[0.98]"
                >
                  Vincular cuenta del SRI
                </Link>
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  <button
                    onClick={() => setActiveTab("ia")}
                    className="border border-brand-gray-200 text-brand-gray-600 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-brand-gray-50 transition-colors cursor-pointer"
                  >
                    Configurar Inteligencia IA
                  </button>
                  <button
                    onClick={() => setActiveTab("integraciones")}
                    className="border border-brand-gray-200 text-brand-gray-600 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-brand-gray-50 transition-colors cursor-pointer"
                  >
                    WhatsApp & Móvil
                  </button>
                  <button
                    onClick={() => setActiveTab("notificaciones")}
                    className="border border-brand-gray-200 text-brand-gray-600 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-brand-gray-50 transition-colors cursor-pointer"
                  >
                    Notificaciones
                  </button>
                </div>
              </div>
            )}

            {activeTab === "clientes" && (
              <div className="flex flex-col gap-5">
                <section className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-brand-gray-100 flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h2 className="text-[13px] font-bold text-brand-gray-700 uppercase tracking-wide">
                        Gestión de Usuarios Clientes
                      </h2>
                      <p className="text-[11px] text-brand-gray-500 mt-0.5 font-medium">
                        Crea cuentas de acceso restringidas para tus clientes y asócialas a sus respectivos RUCs.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setClientNombre("");
                        setClientEmail("");
                        setClientPassword("");
                        setClientRuc(emisores[0]?.ruc || "");
                        setClientRol("USER");
                        setIsCreateModalOpen(true);
                      }}
                      className="bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      Agregar Usuario
                    </button>
                  </div>
                  <div className="p-5 overflow-x-auto">
                    {loadingClientes ? (
                      <p className="text-sm text-brand-gray-500 text-center py-6">Cargando usuarios...</p>
                    ) : clientes.length === 0 ? (
                      <p className="text-sm text-brand-gray-500 text-center py-6">No hay usuarios registrados en tu oficina contable.</p>
                    ) : (
                      <table className="w-full text-left border-collapse text-[12.5px]">
                        <thead>
                          <tr className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">
                            <th className="pb-3 font-semibold">Usuario</th>
                            <th className="pb-3 font-semibold">Correo</th>
                            <th className="pb-3 font-semibold">Rol</th>
                            <th className="pb-3 font-semibold">Empresa / RUC Asociado</th>
                            <th className="pb-3 font-semibold">Estado</th>
                            <th className="pb-3 font-semibold text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-gray-50">
                          {clientes.map((c) => (
                            <tr key={c.id} className="hover:bg-brand-gray-50/40 transition-colors">
                              <td className="py-3.5 font-bold text-brand-gray-800 flex items-center gap-2">
                                <div className="w-8 h-8 bg-brand-gray-100 rounded-full flex items-center justify-center text-brand-gray-500 shadow-xs">
                                  <User className="w-4 h-4 shrink-0" />
                                </div>
                                {c.nombre}
                              </td>
                              <td className="py-3.5 text-brand-gray-600 font-medium">{c.email}</td>
                              <td className="py-3.5">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                  c.rol === 'ADMIN' 
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                    : 'bg-brand-gray-100 text-brand-gray-700 border border-brand-gray-200'
                                }`}>
                                  {c.rol === 'ADMIN' ? 'Administrador' : 'Cliente'}
                                </span>
                              </td>
                              <td className="py-3.5">
                                {c.rol === 'ADMIN' ? (
                                  <span className="text-brand-gray-400 italic">Acceso Global</span>
                                ) : (
                                  <select
                                    value={c.ruc || ""}
                                    onChange={(e) => handleUpdateClientRuc(c.id, e.target.value)}
                                    className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-brand-gray-800 focus:border-brand-navy outline-none cursor-pointer"
                                  >
                                    <option value="">Desasociado (Ninguno)</option>
                                    {emisores.map((e) => (
                                      <option key={e.ruc} value={e.ruc}>
                                        {e.razonSocial}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td className="py-3.5">
                                <button
                                  onClick={() => handleToggleClientStatus(c.id, c.activo)}
                                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer ${c.activo ? "bg-emerald-500" : "bg-brand-gray-200"}`}
                                >
                                  <div
                                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                                      c.activo ? "left-[18px]" : "left-0.5"
                                    }`}
                                  />
                                </button>
                              </td>
                              <td className="py-3.5 text-right whitespace-nowrap">
                                <button
                                  onClick={() => handleOpenEditModal(c)}
                                  className="text-brand-navy hover:text-brand-navy-light font-bold text-xs border border-brand-gray-200 hover:bg-brand-gray-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer mr-2 inline-flex items-center gap-1"
                                  title="Editar usuario"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteClient(c.id, c.nombre)}
                                  className="text-red-500 hover:text-red-700 font-bold text-xs border border-red-100 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title="Eliminar usuario"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Eliminar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </section>
              </div>
            )}

            {activeTab === "notificaciones" && (
              <section className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-brand-gray-100">
                  <h2 className="text-[13px] font-bold text-brand-gray-700 uppercase tracking-wide">Canales de notificación</h2>
                  <p className="text-[11px] text-brand-gray-500 mt-1 font-medium">Elige cómo quieres recibir alertas tributarias.</p>
                </div>
                <div className="p-5 flex flex-col divide-y divide-brand-gray-50">
                  {[
                    {
                      label: "Notificaciones en App",
                      desc: "Alertas dentro del sistema",
                      icon: <Smartphone className="w-5 h-5 text-brand-gray-500 shrink-0" />,
                      state: appNotif,
                      toggle: (v: boolean) => {
                        setAppNotif(v);
                        savePrefs(v, whatsappNotif);
                      },
                    },
                    {
                      label: "Notificaciones por Email",
                      desc: "Copias de declaraciones y alertas (próximamente)",
                      icon: <Mail className="w-5 h-5 text-brand-gray-500 shrink-0" />,
                      state: emailNotif,
                      toggle: setEmailNotif,
                      disabled: true,
                    },
                    {
                      label: "Notificaciones por WhatsApp",
                      desc: "Mensajes del Agente Notificador",
                      icon: <MessageSquare className="w-5 h-5 text-brand-gray-500 shrink-0" />,
                      state: whatsappNotif,
                      toggle: (v: boolean) => {
                        setWhatsappNotif(v);
                        savePrefs(appNotif, v);
                      },
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-3 gap-4">
                      <div className="flex items-center gap-3">
                        <span className="shrink-0">{item.icon}</span>
                        <div>
                          <p className="text-[13px] font-semibold text-brand-gray-800">{item.label}</p>
                          <p className="text-[11px] text-brand-gray-500 font-medium">{item.desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => !item.disabled && item.toggle(!item.state)}
                        disabled={item.disabled}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                          item.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                        } ${item.state ? "bg-emerald-500" : "bg-brand-gray-200"}`}
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
              <section className="bg-white border border-brand-gray-200 rounded-xl p-5">
                <IaConfigPanel />
              </section>
            )}

            {activeTab === "desarrollo" && (
              <section className="bg-white border border-brand-gray-200 rounded-xl p-5">
                <ProxyConfigPanel />
              </section>
            )}
          </>
        )}

        {activeTab === "general" && user?.rol !== "USER" && emisores.length > 0 && (
          <section className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-brand-gray-100">
              <h2 className="text-[13px] font-bold text-brand-gray-700 uppercase tracking-wide">Privacidad y control de datos</h2>
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
                    Esta acción requiere soporte administrative. Contacta al administrador del tenant.
                  </p>
                  <button
                    onClick={() => setShowRevokeConfirm(false)}
                    className="border border-brand-gray-200 text-brand-gray-700 text-[12px] font-semibold py-2 rounded-lg hover:bg-white transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Modal de Creación de Cliente */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-brand-gray-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-brand-gray-100 flex justify-between items-center">
              <h3 className="text-sm font-bold text-brand-gray-800">Agregar Usuario Cliente</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-brand-gray-400 hover:text-brand-gray-600 transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateClient} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={clientNombre}
                  onChange={(e) => setClientNombre(e.target.value)}
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-sm text-brand-gray-800 focus:border-brand-navy outline-none"
                  placeholder="ej. Juan Pérez"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-sm text-brand-gray-800 focus:border-brand-navy outline-none"
                  placeholder="cliente@correo.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Contraseña de Acceso
                </label>
                <input
                  type="password"
                  required
                  value={clientPassword}
                  onChange={(e) => setClientPassword(e.target.value)}
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-sm text-brand-gray-800 focus:border-brand-navy outline-none"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Empresa / RUC Asignado
                </label>
                <select
                  value={clientRuc}
                  onChange={(e) => setClientRuc(e.target.value)}
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-sm text-brand-gray-800 focus:border-brand-navy outline-none cursor-pointer"
                >
                  <option value="">Ninguno (sin acceso a SRI)</option>
                  {emisores.map((e) => (
                    <option key={e.ruc} value={e.ruc}>
                      {e.razonSocial} ({e.ruc})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Rol de Usuario
                </label>
                <select
                  value={clientRol}
                  onChange={(e) => setClientRol(e.target.value)}
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-sm text-brand-gray-800 focus:border-brand-navy outline-none cursor-pointer"
                >
                  <option value="USER">Cliente (Restringido)</option>
                  <option value="ADMIN">Administrador (Contador)</option>
                </select>
              </div>

              <div className="flex gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 bg-brand-gray-100 hover:bg-brand-gray-200 text-brand-gray-700 text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingClient}
                  className="flex-1 bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingClient ? "Guardando..." : "Crear Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edición de Usuario */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-brand-gray-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-brand-gray-100 flex justify-between items-center">
              <h3 className="text-sm font-bold text-brand-gray-800">Editar Usuario</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-brand-gray-400 hover:text-brand-gray-600 transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateClient} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-sm text-brand-gray-800 focus:border-brand-navy outline-none"
                  placeholder="ej. Juan Pérez"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-sm text-brand-gray-800 focus:border-brand-navy outline-none"
                  placeholder="cliente@correo.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Nueva Contraseña (opcional)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-sm text-brand-gray-800 focus:border-brand-navy outline-none"
                  placeholder="Dejar en blanco para conservar contraseña"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Empresa / RUC Asignado
                </label>
                <select
                  disabled={editRol === 'ADMIN'}
                  value={editRol === 'ADMIN' ? '' : editRuc}
                  onChange={(e) => setEditRuc(e.target.value)}
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-sm text-brand-gray-800 focus:border-brand-navy outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Ninguno (sin acceso a SRI)</option>
                  {emisores.map((e) => (
                    <option key={e.ruc} value={e.ruc}>
                      {e.razonSocial} ({e.ruc})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Rol del Usuario
                </label>
                <select
                  value={editRol}
                  onChange={(e) => setEditRol(e.target.value)}
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-sm text-brand-gray-800 focus:border-brand-navy outline-none cursor-pointer"
                >
                  <option value="USER">Cliente (Restringido)</option>
                  <option value="ADMIN">Administrador (Contador)</option>
                </select>
              </div>

              <div className="flex gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 bg-brand-gray-100 hover:bg-brand-gray-200 text-brand-gray-700 text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="flex-1 bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingEdit ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showRucDisconnectConfirm}
        title="Desvincular RUC"
        message={`¿Estás seguro de que deseas desvincular el RUC ${rucToDisconnect || ""}? Esto desactivará la sincronización.`}
        confirmLabel="Desvincular"
        variant="danger"
        onConfirm={confirmDisconnectRuc}
        onCancel={() => {
          setShowRucDisconnectConfirm(false);
          setRucToDisconnect(null);
        }}
      />

      <ConfirmDialog
        open={showDeleteClientConfirm}
        title="Eliminar Usuario"
        message={`¿Estás seguro de que deseas eliminar al usuario cliente "${clientToDeleteName || ""}"?`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={confirmDeleteClient}
        onCancel={() => {
          setShowDeleteClientConfirm(false);
          setClientToDeleteId(null);
          setClientToDeleteName(null);
        }}
      />
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
