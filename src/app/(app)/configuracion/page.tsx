"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import WhatsAppMobilePanel from "@/components/panels/WhatsAppMobilePanel";
import IaConfigPanel from "@/components/panels/IaConfigPanel";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ProxyConfigPanel from "@/components/panels/ProxyConfigPanel";
import { VincularSriForm } from "@/components/configuracion/VincularSriForm";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { sriClient, setAuthToken } from "@/lib/sriClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  User,
  Users,
  Bell,
  MessageSquare,
  Bot,
  Building2,
  Plus,
  Edit,
  Trash2,
  Smartphone,
  Mail,
  Code,
  Loader2,
  X,
  ShieldCheck,
  FileCheck2,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Upload,
} from "lucide-react";
import {
  ConfigTabsNav,
  type ConfigTabId,
  type ConfigTabDef,
} from "@/components/configuracion/ConfigTabs";

type ConfigTab = ConfigTabId;

const tabs: ConfigTabDef[] = [
  {
    id: "general",
    label: "General & SRI",
    icon: <User className="w-4 h-4 shrink-0" />,
  },
  {
    id: "clientes",
    label: "Clientes / Usuarios",
    roles: ["ADMIN", "SUPERADMIN"],
    icon: <Users className="w-4 h-4 shrink-0" />,
  },
  {
    id: "notificaciones",
    label: "Notificaciones",
    icon: <Bell className="w-4 h-4 shrink-0" />,
  },
  {
    id: "integraciones",
    label: "Móvil & WhatsApp",
    icon: <MessageSquare className="w-4 h-4 shrink-0" />,
  },
  {
    id: "ia",
    label: "Inteligencia IA",
    icon: <Bot className="w-4 h-4 shrink-0" />,
  },
  {
    id: "desarrollo",
    label: "Desarrollo & Proxies",
    roles: ["SUPERADMIN", "ADMIN"],
    icon: <Code className="w-4 h-4 shrink-0" />,
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
  const [emailNotif, setEmailNotif] = useState(false);
  const [whatsappNotif, setWhatsappNotif] = useState(true);
  const [appNotif, setAppNotif] = useState(true);
  const [emailDisponible, setEmailDisponible] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [loginBanner, setLoginBanner] = useState<string | null>(null);
  const [vincularOpen, setVincularOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Estados para subida de certificado
  const [showCertUpload, setShowCertUpload] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const [certRuc, setCertRuc] = useState("");
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

  // Diálogos de confirmación
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
        toast.success(
          `Conexión exitosa con el SRI (${res.ambiente || "PRODUCCIÓN"}). Recepción: OK, Autorización: OK`
        );
      } else {
        toast.error(`Fallo en la conexión: ${res.error || "Error de red"}`);
      }
    } catch (err: any) {
      toast.error(`Error al conectar con el SRI: ${err.message || "Error de red"}`);
    } finally {
      setTestingConnection(false);
    }
  };

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      (async () => {
        try {
          const res = await fetch("/api/sri/mobile-exchange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const data = await res.json();
          if (res.ok && (data.accessToken || data.token)) {
            setAuthToken(data.accessToken || data.token);
            setLoginBanner("Sesión móvil vinculada correctamente.");
            toast.success("Sesión móvil vinculada correctamente");
          } else {
            toast.error(data.message || "Código móvil inválido o expirado");
          }
        } catch {
          toast.error("Error al canjear el código móvil");
        }
        window.history.replaceState({}, document.title, `/configuracion?tab=integraciones`);
        setActiveTab("integraciones");
      })();
      return;
    }

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
        setEmailNotif(res.notificaciones?.email ?? false);
        setWhatsappNotif(res.notificaciones?.whatsapp ?? true);
        setEmailDisponible(Boolean(res.notificaciones?.emailDisponible));
      }
    } catch (err: any) {
      if (
        err.message?.includes("404") ||
        err.message?.includes("not encontrado") ||
        err.message?.includes("no encontrado")
      ) {
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
    if (user?.rol !== "ADMIN" && user?.rol !== "SUPERADMIN") return;
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
    if (activeTab === "clientes") {
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
      toast.error(err.message || "Error al crear usuario");
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
        toast.success("Estado del usuario actualizado");
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

  const savePrefs = async (app: boolean, whatsapp: boolean, email?: boolean) => {
    try {
      const res = await sriClient.updateConfiguracion({
        notifDocumentos: app,
        notifGeneracion: whatsapp,
        ...(email !== undefined ? { notifEmail: email } : {}),
      });
      if (!res.success) toast.error(res.message || "Error al guardar preferencias");
    } catch {
      toast.error("Error al guardar preferencias");
    }
  };

  const initials = perfil?.razonSocial
    ? perfil.razonSocial
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
    : "OF";

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
      <meta
        name="description"
        content="Configuración de seguridad, contribuyente, notificaciones e integraciones."
      />

      <Topbar title="Configuración" period="Sistema" />

      <main className="ui-page flex-1">
        <PageHeader
          title="Configuración del Sistema"
          description="Gestión integral de tu perfil tributario SRI, firma electrónica, notificaciones e integraciones."
        />

        {loginBanner && (
          <div className="bg-success-pale border border-success-light/40 text-success text-xs sm:text-sm rounded-xl px-4 py-3 flex items-center gap-2 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span>{loginBanner}</span>
          </div>
        )}

        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm rounded-xl px-4 py-3 flex items-center gap-2 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* TABS NAVEGACIÓN */}
        <ConfigTabsNav
          tabs={allowedTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {loading ? (
          <div className="bg-white border border-brand-gray-200 rounded-2xl p-12 text-center text-xs sm:text-sm text-brand-gray-500 flex flex-col items-center gap-3 shadow-2xs">
            <Loader2 className="w-6 h-6 animate-spin text-brand-red" />
            <span>Cargando perfil y configuraciones tributarias...</span>
          </div>
        ) : (
          <>
            {/* TAB GENERAL & SRI */}
            {activeTab === "general" && perfil && (
              <div className="flex flex-col gap-6">
                {/* Perfil del Contribuyente */}
                <section className="bg-white border border-brand-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="px-5 py-4 border-b border-brand-gray-100 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h2 className="text-xs font-bold text-brand-gray-800 uppercase tracking-wider flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-brand-red" />
                        Perfil del Contribuyente
                      </h2>
                      <p className="text-[11px] text-brand-gray-500 mt-0.5">
                        Información obtenida en tiempo real desde los servidores del SRI.
                      </p>
                    </div>
                    <Badge className="bg-success-pale text-success hover:bg-success-pale font-semibold text-[11px] px-2.5 py-0.5">
                      ✓ SRI Activo
                    </Badge>
                  </div>

                  <div className="p-5 flex flex-col gap-5">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-brand-red via-brand-red-mid to-brand-red-bright rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-brand-gray-900 truncate">
                          {perfil.razonSocial}
                        </h3>
                        <p className="text-xs text-brand-gray-500 font-medium">
                          {perfil.regimen} · Ambiente {perfil.ambiente}
                        </p>
                        <p className="text-xs font-mono text-brand-gray-400 font-semibold mt-0.5">
                          RUC: {perfil.ruc}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-brand-gray-100">
                      {[
                        { label: "Régimen tributario", value: perfil.regimen },
                        { label: "Estado en SRI", value: perfil.estadoSri, highlight: true },
                        { label: "Última sincronización", value: formatSync(perfil.ultimaSincronizacion) },
                        {
                          label: "Firma digital",
                          value: perfil.firmaDigital,
                          highlight: !perfil.firmaDigital?.includes("Expirada"),
                        },
                        {
                          label: "WhatsApp Bot",
                          value: waEstadoLabel,
                          highlight: whatsappInfo?.estado === "CONECTADO",
                        },
                        { label: "Número WhatsApp", value: whatsappInfo?.numero || "No configurado" },
                        { label: "Frecuencia Polling SRI", value: "C/15 min · 24h automático", highlight: true },
                        { label: "Servidor Proxy SRI", value: "En línea (Latencia < 120ms)", highlight: true },
                      ].map((f) => (
                        <div key={f.label} className="bg-brand-gray-50/70 border border-brand-gray-200/60 rounded-xl p-3 flex flex-col gap-1">
                          <span className="text-[10px] text-brand-gray-400 font-semibold uppercase tracking-wider">
                            {f.label}
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              f.highlight ? "text-success" : "text-brand-gray-800"
                            }`}
                          >
                            {f.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* FIRMA DIGITAL / CERTIFICADO .P12 */}
                <section className="bg-white border border-brand-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="px-5 py-4 border-b border-brand-gray-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-brand-gray-800 uppercase tracking-wider flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-brand-red" />
                        Firma Electrónica (.p12)
                      </h2>
                      <p className="text-[11px] text-brand-gray-500 mt-0.5">
                        Certificado digital para firmado de facturas y notas de crédito electrónicas.
                      </p>
                    </div>
                  </div>

                  <div className="p-5">
                    {certResult?.success ? (
                      <div className="flex flex-col gap-3">
                        <div className="bg-success-pale border border-success-light/40 text-success rounded-xl p-3.5 text-xs font-semibold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                          <span>
                            Certificado válido · Vence:{" "}
                            {new Date(certResult.data.validation.expiryDate).toLocaleDateString("es-EC")}{" "}
                            ({certResult.data.validation.daysUntilExpiry} días restantes)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowCertUpload(false);
                            setCertFile(null);
                            setCertPassword("");
                            setCertResult(null);
                          }}
                          className="text-xs text-brand-red font-semibold hover:underline self-start px-0"
                        >
                          Subir otro certificado .p12
                        </Button>
                      </div>
                    ) : perfil?.firmaDigital && !perfil.firmaDigital.includes("No registrada") ? (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-brand-gray-50 border border-brand-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="w-5 h-5 text-success shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-brand-gray-800">{perfil.firmaDigital}</p>
                            <p className="text-[11px] text-brand-gray-500 font-medium">
                              Firma válida para comprobantes SRI.
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setShowCertUpload(true)}
                          className="bg-brand-red hover:bg-brand-red-mid text-white text-xs font-semibold rounded-xl"
                        >
                          Reemplazar archivo .p12
                        </Button>
                      </div>
                    ) : !showCertUpload ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setShowCertUpload(true)}
                        className="bg-brand-red hover:bg-brand-red-mid text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                      >
                        <Upload className="w-4 h-4" />
                        Subir certificado .p12
                      </Button>
                    ) : null}

                    {showCertUpload && (
                      <div className="flex flex-col gap-4 mt-3 p-4.5 bg-brand-gray-50 rounded-2xl border border-brand-gray-200">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-brand-gray-800">Cargar nuevo archivo .p12</h4>
                          <button
                            onClick={() => {
                              setShowCertUpload(false);
                              setCertFile(null);
                              setCertPassword("");
                              setCertRuc("");
                              setCertResult(null);
                            }}
                            className="text-brand-gray-400 hover:text-brand-gray-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider mb-1 block">
                              Vincular a RUC
                            </label>
                            <select
                              value={certRuc || activeRuc || perfil?.ruc || ""}
                              onChange={(e) => setCertRuc(e.target.value)}
                              className="w-full bg-white border border-brand-gray-200 rounded-xl p-2.5 text-xs text-brand-gray-800 focus:border-brand-red outline-none cursor-pointer font-medium"
                            >
                              <option value="" disabled>
                                Seleccionar RUC...
                              </option>
                              {emisores.map((em) => (
                                <option key={em.ruc} value={em.ruc}>
                                  {em.ruc} — {em.razonSocial}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider mb-1 block">
                              Contraseña de la firma
                            </label>
                            <Input
                              type="password"
                              placeholder="Clave del certificado"
                              value={certPassword}
                              onChange={(e) => setCertPassword(e.target.value)}
                              className="bg-white text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider mb-1 block">
                            Archivo digital (.p12)
                          </label>
                          <Input
                            type="file"
                            accept=".p12"
                            onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                            className="bg-white text-xs file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1 file:text-xs file:font-semibold file:bg-brand-red file:text-white hover:file:bg-brand-red-bright cursor-pointer"
                          />
                        </div>

                        <div className="flex gap-2.5 pt-1">
                          <Button
                            type="button"
                            onClick={async () => {
                              const rucFinal = certRuc || activeRuc || perfil?.ruc || "";
                              if (!certFile || !certPassword) {
                                toast.error("Selecciona un archivo .p12 y escribe la contraseña");
                                return;
                              }
                              if (!rucFinal) {
                                toast.error("Selecciona el RUC al que vincular el certificado");
                                return;
                              }
                              setUploadingCert(true);
                              setCertResult(null);
                              try {
                                const fd = new FormData();
                                fd.append("cert", certFile);
                                fd.append("password", certPassword);
                                fd.append("ruc", rucFinal);
                                const res = await sriClient.uploadCertificado(fd);
                                setCertResult(res);
                                if (res.success) {
                                  toast.success("Certificado validado y vinculado al RUC " + rucFinal);
                                  setShowCertUpload(false);
                                  await loadConfig();
                                } else {
                                  toast.error(res.message || "Error al subir certificado");
                                }
                              } catch (err: any) {
                                toast.error(err.message || "Error al subir certificado");
                              } finally {
                                setUploadingCert(false);
                              }
                            }}
                            disabled={uploadingCert}
                            className="bg-brand-red hover:bg-brand-red-mid text-white text-xs font-semibold px-4 py-2 rounded-xl"
                          >
                            {uploadingCert ? "Validando..." : "Subir y Validar"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowCertUpload(false);
                              setCertFile(null);
                              setCertPassword("");
                              setCertRuc("");
                              setCertResult(null);
                            }}
                            className="text-xs font-semibold rounded-xl"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* ACCIONES RÁPIDAS */}
                {user?.rol !== "USER" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestSriConnection}
                      disabled={testingConnection}
                      className="bg-white hover:bg-brand-gray-50 text-brand-gray-800 text-xs font-semibold py-3 h-auto rounded-2xl border border-brand-gray-200 flex items-center justify-center gap-2 shadow-2xs"
                    >
                      <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                      {testingConnection ? "Probando..." : "Probar Conexión SRI"}
                    </Button>
                    <Link
                      href="/documentos"
                      className={buttonVariants({
                        variant: "outline",
                        className:
                          "bg-white hover:bg-brand-gray-50 text-brand-gray-800 text-xs font-semibold py-3 h-auto rounded-2xl border border-brand-gray-200 flex items-center justify-center gap-2 shadow-2xs",
                      })}
                    >
                      <RefreshCw className="w-4 h-4 text-brand-sky shrink-0" />
                      Documentos / Descarga SRI
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("integraciones")}
                      className="bg-white hover:bg-brand-gray-50 text-brand-gray-800 text-xs font-semibold py-3 h-auto rounded-2xl border border-brand-gray-200 flex items-center justify-center gap-2 shadow-2xs"
                    >
                      <MessageSquare className="w-4 h-4 text-success shrink-0" />
                      WhatsApp & Móvil
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("ia")}
                      className="bg-white hover:bg-brand-gray-50 text-brand-gray-800 text-xs font-semibold py-3 h-auto rounded-2xl border border-brand-gray-200 flex items-center justify-center gap-2 shadow-2xs"
                    >
                      <Bot className="w-4 h-4 text-brand-red shrink-0" />
                      Configurar Inteligencia IA
                    </Button>
                  </div>
                )}

                {/* EMPRESAS / RUCS VINCULADOS */}
                {(user?.rol === "ADMIN" || user?.rol === "SUPERADMIN") && (
                  <section className="bg-white border border-brand-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="px-5 py-4 border-b border-brand-gray-100 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h2 className="text-xs font-bold text-brand-gray-800 uppercase tracking-wider flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-brand-red" />
                          Empresas / RUCs Vinculados
                        </h2>
                        <p className="text-[11px] text-brand-gray-500 mt-0.5">
                          Administra tus cuentas del portal SRI conectadas en el sistema.
                        </p>
                      </div>
                      {!vincularOpen && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setVincularOpen(true)}
                          className="bg-brand-red hover:bg-brand-red-mid text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          Conectar Empresa SRI
                        </Button>
                      )}
                    </div>

                    <div className="p-5 flex flex-col gap-3">
                      {vincularOpen && (
                        <div className="border border-brand-red/30 bg-brand-red-subtle/50 rounded-2xl p-4.5 mb-2 shadow-2xs">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-brand-gray-800">
                              Vincular nueva empresa del SRI
                            </h3>
                            <button
                              type="button"
                              aria-label="Cerrar formulario de vinculación"
                              onClick={() => setVincularOpen(false)}
                              className="text-brand-gray-400 hover:text-brand-gray-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <VincularSriForm
                            onCancel={() => setVincularOpen(false)}
                            onSuccess={async () => {
                              setVincularOpen(false);
                              await refreshSriStatus();
                              await loadConfig();
                            }}
                          />
                        </div>
                      )}

                      {emisores.length === 0 ? (
                        <EmptyState
                          icon={<Building2 className="w-5 h-5" />}
                          title="No hay empresas vinculadas."
                          compact
                        />
                      ) : (
                        <div className="grid gap-3">
                          {emisores.map((e) => (
                            <div
                              key={e.ruc}
                              className={`flex items-center justify-between p-4 border rounded-2xl transition-all ${
                                e.ruc === activeRuc
                                  ? "border-brand-red bg-brand-red-subtle/40 shadow-2xs"
                                  : "border-brand-gray-200 bg-white hover:border-brand-gray-300"
                              }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-10 h-10 bg-brand-gray-100 rounded-xl flex items-center justify-center text-brand-gray-600 shadow-2xs shrink-0 font-bold text-xs">
                                  <Building2 className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-brand-gray-900 flex items-center gap-2 flex-wrap">
                                    <span className="truncate max-w-[240px]">{e.razonSocial}</span>
                                    {e.ruc === activeRuc && (
                                      <span className="bg-success-pale text-success text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0">
                                        Activo
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[11px] text-brand-gray-500 font-mono mt-0.5">
                                    RUC: {e.ruc} · Ambiente: {e.ambiente}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {e.ruc !== activeRuc && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setActiveRuc(e.ruc)}
                                    className="text-xs font-semibold rounded-xl"
                                  >
                                    Seleccionar
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDisconnectRuc(e.ruc)}
                                  className="text-xs font-semibold rounded-xl"
                                >
                                  Desconectar
                                </Button>
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

            {/* TAB CLIENTES / USUARIOS */}
            {activeTab === "clientes" && (
              <div className="flex flex-col gap-6">
                <section className="bg-white border border-brand-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="px-5 py-4 border-b border-brand-gray-100 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h2 className="text-xs font-bold text-brand-gray-800 uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-4 h-4 text-brand-red" />
                        Gestión de Usuarios Clientes
                      </h2>
                      <p className="text-[11px] text-brand-gray-500 mt-0.5 font-medium">
                        Crea cuentas de acceso restringidas para tus clientes y asócialas a sus RUCs.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setClientNombre("");
                        setClientEmail("");
                        setClientPassword("");
                        setClientRuc(emisores[0]?.ruc || "");
                        setClientRol("USER");
                        setIsCreateModalOpen(true);
                      }}
                      className="bg-brand-red hover:bg-brand-red-mid text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar Usuario
                    </Button>
                  </div>

                  <div className="p-5">
                    {loadingClientes ? (
                      <TableSkeleton rows={5} columns={6} />
                    ) : clientes.length === 0 ? (
                      <EmptyState
                        icon={<Users className="w-5 h-5" />}
                        title="No hay usuarios registrados en tu oficina contable."
                        compact
                      />
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="pb-3 font-semibold text-xs">Usuario</TableHead>
                              <TableHead className="pb-3 font-semibold text-xs">Correo</TableHead>
                              <TableHead className="pb-3 font-semibold text-xs">Rol</TableHead>
                              <TableHead className="pb-3 font-semibold text-xs">Empresa / RUC Asociado</TableHead>
                              <TableHead className="pb-3 font-semibold text-xs">Estado</TableHead>
                              <TableHead className="pb-3 font-semibold text-xs text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="divide-y divide-brand-gray-100">
                            {clientes.map((c) => (
                              <TableRow key={c.id}>
                                <TableCell className="py-3.5 font-bold text-xs text-brand-gray-800">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-brand-gray-100 rounded-full flex items-center justify-center text-brand-gray-500 shadow-2xs font-bold text-xs shrink-0">
                                      <User className="w-4 h-4" />
                                    </div>
                                    <span>{c.nombre}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3.5 text-xs text-brand-gray-600 font-medium">
                                  {c.email}
                                </TableCell>
                                <TableCell className="py-3.5">
                                  <Badge
                                    className={`font-semibold text-[10px] px-2 py-0.5 ${
                                      c.rol === "ADMIN"
                                        ? "bg-sky-100 text-brand-sky"
                                        : "bg-brand-gray-100 text-brand-gray-700"
                                    }`}
                                  >
                                    {c.rol === "ADMIN" ? "Administrador" : "Cliente"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-3.5">
                                  {c.rol === "ADMIN" ? (
                                    <span className="text-brand-gray-400 text-xs italic">
                                      Acceso Global
                                    </span>
                                  ) : (
                                    <select
                                      value={c.ruc || ""}
                                      onChange={(e) => handleUpdateClientRuc(c.id, e.target.value)}
                                      className="bg-brand-gray-50 border border-brand-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-brand-gray-800 focus:border-brand-red outline-none cursor-pointer font-medium"
                                    >
                                      <option value="">Desasociado (Ninguno)</option>
                                      {emisores.map((e) => (
                                        <option key={e.ruc} value={e.ruc}>
                                          {e.razonSocial}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </TableCell>
                                <TableCell className="py-3.5">
                                  <button
                                    onClick={() => handleToggleClientStatus(c.id, c.activo)}
                                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer ${
                                      c.activo ? "bg-success" : "bg-brand-gray-200"
                                    }`}
                                  >
                                    <div
                                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                                        c.activo ? "left-[18px]" : "left-0.5"
                                      }`}
                                    />
                                  </button>
                                </TableCell>
                                <TableCell className="py-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenEditModal(c)}
                                      className="text-xs font-semibold rounded-lg text-brand-red hover:text-brand-red-bright hover:bg-brand-red-subtle"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                      Editar
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteClient(c.id, c.nombre)}
                                      className="text-xs font-semibold rounded-lg text-brand-red hover:bg-brand-red-subtle border-brand-red-pale"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Eliminar
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* TAB NOTIFICACIONES */}
            {activeTab === "notificaciones" && (
              <section className="bg-white border border-brand-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-5 py-4 border-b border-brand-gray-100">
                  <h2 className="text-xs font-bold text-brand-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <Bell className="w-4 h-4 text-brand-red" />
                    Canales de Notificación
                  </h2>
                  <p className="text-[11px] text-brand-gray-500 mt-0.5 font-medium">
                    Elige cómo quieres recibir alertas tributarias y resúmenes contables.
                  </p>
                </div>

                <div className="p-5 flex flex-col divide-y divide-brand-gray-100">
                  {[
                    {
                      label: "Notificaciones en App",
                      desc: "Alertas y notificaciones internas del sistema",
                      icon: <Smartphone className="w-5 h-5 text-brand-red shrink-0" />,
                      state: appNotif,
                      toggle: (v: boolean) => {
                        setAppNotif(v);
                        savePrefs(v, whatsappNotif, emailNotif);
                      },
                    },
                    {
                      label: "Notificaciones por Email",
                      desc: emailDisponible
                        ? "Alertas enviadas por SMTP configurado"
                        : "Configura SMTP_HOST para habilitar este canal",
                      icon: <Mail className={`w-5 h-5 shrink-0 ${emailDisponible ? "text-brand-sky" : "text-brand-gray-400"}`} />,
                      state: emailNotif,
                      toggle: (v: boolean) => {
                        setEmailNotif(v);
                        savePrefs(appNotif, whatsappNotif, v);
                      },
                      disabled: !emailDisponible,
                    },
                    {
                      label: "Notificaciones por WhatsApp",
                      desc: "Alertas en tiempo real enviadas por el Asistente WhatsApp",
                      icon: <MessageSquare className="w-5 h-5 text-success shrink-0" />,
                      state: whatsappNotif,
                      toggle: (v: boolean) => {
                        setWhatsappNotif(v);
                        savePrefs(appNotif, v, emailNotif);
                      },
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-4 gap-4">
                      <div className="flex items-center gap-3">
                        <span className="shrink-0">{item.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-brand-gray-800">{item.label}</p>
                          <p className="text-[11px] text-brand-gray-500 font-medium">{item.desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => !item.disabled && item.toggle(!item.state)}
                        disabled={item.disabled}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                          item.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                        } ${item.state ? "bg-success" : "bg-brand-gray-200"}`}
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
              </section>
            )}

            {/* TAB INTEGRACIONES */}
            {activeTab === "integraciones" && <WhatsAppMobilePanel />}

            {/* TAB IA */}
            {activeTab === "ia" && (
              <section className="bg-white border border-brand-gray-200 rounded-2xl p-5 shadow-2xs">
                <IaConfigPanel />
              </section>
            )}

            {/* TAB DESARROLLO */}
            {activeTab === "desarrollo" && (
              <section className="bg-white border border-brand-gray-200 rounded-2xl p-5 shadow-2xs">
                <ProxyConfigPanel />
              </section>
            )}
          </>
        )}
      </main>

      {/* Modal de Creación de Cliente */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-brand-gray-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-brand-gray-100 flex justify-between items-center">
              <h3 className="text-xs font-bold text-brand-gray-800 uppercase tracking-wider">
                Agregar Usuario Cliente
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-brand-gray-400 hover:text-brand-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateClient} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Nombre Completo
                </label>
                <Input
                  type="text"
                  required
                  value={clientNombre}
                  onChange={(e) => setClientNombre(e.target.value)}
                  className="bg-brand-gray-50 text-xs"
                  placeholder="ej. Juan Pérez"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Correo Electrónico
                </label>
                <Input
                  type="email"
                  required
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="bg-brand-gray-50 text-xs"
                  placeholder="cliente@correo.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Contraseña de Acceso
                </label>
                <Input
                  type="password"
                  required
                  value={clientPassword}
                  onChange={(e) => setClientPassword(e.target.value)}
                  className="bg-brand-gray-50 text-xs"
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
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-xl p-2.5 text-xs text-brand-gray-800 focus:border-brand-red outline-none cursor-pointer font-medium"
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
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-xl p-2.5 text-xs text-brand-gray-800 focus:border-brand-red outline-none cursor-pointer font-medium"
                >
                  <option value="USER">Cliente (Restringido)</option>
                  <option value="ADMIN">Administrador (Contador)</option>
                </select>
              </div>

              <div className="flex gap-2.5 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-xs font-semibold rounded-xl"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingClient}
                  className="flex-1 bg-brand-red hover:bg-brand-red-mid text-white text-xs font-semibold rounded-xl"
                >
                  {submittingClient ? "Guardando..." : "Crear Usuario"}
                </Button>
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
              <h3 className="text-xs font-bold text-brand-gray-800 uppercase tracking-wider">
                Editar Usuario
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-brand-gray-400 hover:text-brand-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateClient} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Nombre Completo
                </label>
                <Input
                  type="text"
                  required
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="bg-brand-gray-50 text-xs"
                  placeholder="ej. Juan Pérez"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Correo Electrónico
                </label>
                <Input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="bg-brand-gray-50 text-xs"
                  placeholder="cliente@correo.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Nueva Contraseña (opcional)
                </label>
                <Input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="bg-brand-gray-50 text-xs"
                  placeholder="Dejar en blanco para conservar contraseña"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Empresa / RUC Asignado
                </label>
                <select
                  disabled={editRol === "ADMIN"}
                  value={editRol === "ADMIN" ? "" : editRuc}
                  onChange={(e) => setEditRuc(e.target.value)}
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-xl p-2.5 text-xs text-brand-gray-800 focus:border-brand-red outline-none cursor-pointer disabled:opacity-50 font-medium"
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
                  className="bg-brand-gray-50 border border-brand-gray-200 rounded-xl p-2.5 text-xs text-brand-gray-800 focus:border-brand-red outline-none cursor-pointer font-medium"
                >
                  <option value="USER">Cliente (Restringido)</option>
                  <option value="ADMIN">Administrador (Contador)</option>
                </select>
              </div>

              <div className="flex gap-2.5 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-xs font-semibold rounded-xl"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingEdit}
                  className="flex-1 bg-brand-red hover:bg-brand-red-mid text-white text-xs font-semibold rounded-xl"
                >
                  {submittingEdit ? "Guardando..." : "Guardar Cambios"}
                </Button>
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
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-brand-gray-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-brand-red" />
          <span>Cargando configuración…</span>
        </div>
      }
    >
      <ConfiguracionContent />
    </Suspense>
  );
}
