"use client";

import { useEffect, useRef, useState } from "react";
import { sriClient } from "@/lib/sriClient";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";

interface WaMessage {
  id: string;
  sender: "in" | "out";
  text?: string;
  time: string;
  html?: string;
}

const initialWaMessages: WaMessage[] = [];

const estadoConfig: Record<string, { label: string; color: string; bg: string }> = {
  DESCONECTADO: { label: "Desconectado", color: "text-slate-600", bg: "bg-slate-100" },
  VINCULANDO: { label: "Vinculando…", color: "text-amber-700", bg: "bg-amber-50" },
  CONECTADO: { label: "Conectado", color: "text-emerald-700", bg: "bg-emerald-50" },
};

function getWaTime() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function WhatsAppMobilePanel() {
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [waMessages, setWaMessages] = useState<WaMessage[]>(initialWaMessages);
  const [waInput, setWaInput] = useState("");
  const [waTyping, setWaTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const waBodyRef = useRef<HTMLDivElement>(null);

  const [mobileQr, setMobileQr] = useState<string | null>(null);
  const [mobileUrl, setMobileUrl] = useState<string | null>(null);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [loadingMobile, setLoadingMobile] = useState(true);

  const [waNumero, setWaNumero] = useState("");
  const [waEstado, setWaEstado] = useState("DESCONECTADO");
  const [waQr, setWaQr] = useState<string | null>(null);
  const [notifDocumentos, setNotifDocumentos] = useState(true);
  const [notifGeneracion, setNotifGeneracion] = useState(true);
  const [loadingWa, setLoadingWa] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadMobileQr = async () => {
      try {
        const res = await sriClient.getMobileQr();
        if (res.success) {
          setMobileQr(res.qr);
          setMobileUrl(res.url);
          setLocalIp(res.localIp);
        }
      } catch (err) {
        console.error("Error al obtener QR móvil:", err);
      } finally {
        setLoadingMobile(false);
      }
    };

    const loadWaStatus = async () => {
      try {
        const res = await sriClient.getWhatsappStatus();
        if (res.success) {
          setWaEstado(res.whatsappEstado);
          setWaNumero(res.whatsappNumero || "");
          setNotifDocumentos(res.notifDocumentos);
          setNotifGeneracion(res.notifGeneracion);
        }
      } catch (err) {
        console.error("Error al obtener estado de WhatsApp:", err);
      } finally {
        setLoadingWa(false);
      }
    };

    if (sriClient.isAuthenticated()) {
      loadMobileQr();
      loadWaStatus();
    } else {
      setLoadingMobile(false);
      setLoadingWa(false);
    }
  }, []);

  useEffect(() => {
    if (waBodyRef.current) {
      waBodyRef.current.scrollTop = waBodyRef.current.scrollHeight;
    }
  }, [waMessages, waTyping]);

  const handleGenerateWaQr = async () => {
    if (!waNumero.trim()) {
      setActionMsg("Ingresa un número válido con código de país (ej. +593987654321).");
      return;
    }
    try {
      setLoadingWa(true);
      setActionMsg(null);
      const res = await sriClient.getWhatsappQr(waNumero.trim());
      if (res.success) {
        setWaQr(res.qr);
        setWaEstado("VINCULANDO");
      }
    } catch (err: any) {
      setActionMsg(err.message || "Error al generar QR de WhatsApp.");
    } finally {
      setLoadingWa(false);
    }
  };

  const handleConfirmWaScan = async () => {
    try {
      setLoadingWa(true);
      setActionMsg(null);
      const res = await sriClient.connectWhatsapp(waNumero);
      if (res.success) {
        setWaEstado("CONECTADO");
        setActionMsg("WhatsApp vinculado correctamente.");
      }
    } catch (err: any) {
      setActionMsg(err.message || "Error al confirmar vinculación.");
    } finally {
      setLoadingWa(false);
    }
  };

  const handleDisconnectWa = async () => {
    setShowDisconnectConfirm(true);
  };

  const confirmDisconnectWa = async () => {
    try {
      setLoadingWa(true);
      setActionMsg(null);
      const res = await sriClient.disconnectWhatsapp();
      if (res.success) {
        setWaEstado("DESCONECTADO");
        setWaNumero("");
        setWaQr(null);
        setActionMsg("WhatsApp desvinculado.");
        toast.success("WhatsApp desvinculado correctamente");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al desconectar.";
      setActionMsg(msg);
      toast.error(msg);
    } finally {
      setLoadingWa(false);
      setShowDisconnectConfirm(false);
    }
  };

  const handleUpdatePreferences = async (docVal: boolean, genVal: boolean) => {
    setNotifDocumentos(docVal);
    setNotifGeneracion(genVal);
    try {
      await sriClient.updateWhatsappPreferences(docVal, genVal);
    } catch (err) {
      console.error("Error al actualizar preferencias:", err);
    }
  };

  const handleSendTestNotification = async () => {
    try {
      setActionMsg(null);
      const res = await sriClient.sendWhatsappTest();
      if (res.success) {
        setActionMsg(res.message || "Notificación de prueba enviada.");
        const notifyMsg: WaMessage = {
          id: Math.random().toString(),
          sender: "in",
          time: getWaTime(),
          html: res.content?.replace(/\n/g, "<br/>") || res.message,
        };
        setWaMessages((prev) => [...prev, notifyMsg]);
      }
    } catch (err: any) {
      setActionMsg(err.message || "Error al enviar notificación.");
    }
  };

  const handleWaSend = async (text: string) => {
    if (!text.trim()) return;
    setShowQuickReplies(false);
    const userMsg: WaMessage = {
      id: Math.random().toString(),
      sender: "out",
      text,
      time: getWaTime(),
    };
    setWaMessages((prev) => [...prev, userMsg]);
    setWaInput("");
    setWaTyping(true);

    try {
      const history = waMessages
        .filter((m) => m.text || m.html)
        .slice(-10)
        .map((m) => ({
          role: (m.sender === "out" ? "user" : "assistant") as "user" | "assistant",
          content: m.text || (m.html ? m.html.replace(/<[^>]+>/g, " ") : ""),
        }));
      const res = await sriClient.chat(text, history);
      setWaTyping(false);
      if (res?.html) {
        setWaMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: "in",
            time: res.time || getWaTime(),
            html: res.html,
          },
        ]);
      }
    } catch (err: any) {
      setWaTyping(false);
      setWaMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "in",
          text: `Error al consultar asistente: ${err.message || "sin conexión"}`,
          time: getWaTime(),
        },
      ]);
    }
  };

  const status = estadoConfig[waEstado] || estadoConfig.DESCONECTADO;

  if (!sriClient.isAuthenticated()) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
        Inicia sesión para configurar acceso móvil y WhatsApp.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {actionMsg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-xl px-4 py-3">
          {actionMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <div className="flex flex-col gap-5">
          {/* Acceso móvil */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                  Acceso móvil
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Escanea el QR para iniciar sesión en tu celular sin contraseña.
                </p>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase shrink-0">
                LAN · {localIp || "localhost"}
              </span>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-5 items-center">
              <div className="flex-1 text-sm text-slate-600 space-y-2">
                <p>
                  Ambos dispositivos deben estar en la misma red Wi-Fi. El enlace expira en 30 días.
                </p>
                {mobileUrl && (
                  <p className="text-[11px] font-mono text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 break-all">
                    {mobileUrl}
                  </p>
                )}
              </div>
              <div className="shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-3">
                {loadingMobile ? (
                  <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">
                    Generando QR…
                  </div>
                ) : mobileQr ? (
                  <img src={mobileQr} alt="QR acceso móvil" className="w-40 h-40 block" />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400 text-center px-3">
                    No se pudo generar el QR
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* WhatsApp */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                  WhatsApp
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Recibe alertas tributarias y consulta al asistente IA por mensaje.
                </p>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full shrink-0 ${status.bg} ${status.color}`}>
                {status.label}
              </span>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-[1fr_180px] gap-5">
              <div className="flex flex-col gap-4">
                {waEstado === "DESCONECTADO" && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase">
                      Número (con código de país)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20"
                        placeholder="+593987654321"
                        value={waNumero}
                        onChange={(e) => setWaNumero(e.target.value)}
                      />
                      <button
                        onClick={handleGenerateWaQr}
                        disabled={loadingWa}
                        className="bg-brand-navy hover:bg-brand-navy-light text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        Generar QR
                      </button>
                    </div>
                  </div>
                )}

                {waEstado === "VINCULANDO" && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-amber-700 font-medium">
                      Escanea el código QR con WhatsApp → Dispositivos vinculados.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={handleConfirmWaScan}
                        disabled={loadingWa}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        Confirmar vinculación
                      </button>
                      <button
                        onClick={() => {
                          setWaEstado("DESCONECTADO");
                          setWaQr(null);
                        }}
                        className="border border-slate-200 text-slate-600 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {waEstado === "CONECTADO" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-[10px] text-emerald-600 font-semibold uppercase">Número vinculado</p>
                        <p className="text-sm font-bold text-emerald-800 font-mono mt-0.5">{waNumero}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">Preferencias WhatsApp</p>
                      <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifDocumentos}
                          onChange={(e) => handleUpdatePreferences(e.target.checked, notifGeneracion)}
                          className="accent-brand-navy mt-0.5"
                        />
                        <span>Notificar nuevos documentos recibidos (compras)</span>
                      </label>
                      <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifGeneracion}
                          onChange={(e) => handleUpdatePreferences(notifDocumentos, e.target.checked)}
                          className="accent-brand-navy mt-0.5"
                        />
                        <span>Notificar emisión y declaraciones (ventas)</span>
                      </label>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={handleSendTestNotification}
                        className="flex-1 min-w-[140px] border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        Enviar prueba
                      </button>
                      <button
                        onClick={handleDisconnectWa}
                        disabled={loadingWa}
                        className="border border-red-200 text-red-600 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-50 cursor-pointer disabled:opacity-50"
                      >
                        Desvincular
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-3 shrink-0">
                {loadingWa ? (
                  <div className="w-36 h-36 flex items-center justify-center text-xs text-slate-400">Procesando…</div>
                ) : waEstado === "VINCULANDO" && waQr ? (
                  <img src={waQr} alt="QR WhatsApp" className="w-36 h-36 block" />
                ) : waEstado === "CONECTADO" ? (
                  <div className="w-36 h-36 flex flex-col items-center justify-center text-emerald-600 text-center">
                    <span className="text-3xl mb-1">✓</span>
                    <span className="text-xs font-bold">Activo</span>
                  </div>
                ) : (
                  <div className="w-36 h-36 flex flex-col items-center justify-center text-slate-300 text-center text-xs px-3">
                    <span className="text-2xl mb-1">💬</span>
                    QR de vinculación
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Vista previa chat */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-fit xl:sticky xl:top-6">
          <div className="px-4 py-3 border-b border-slate-100 bg-[#075e54] text-white">
            <p className="text-xs font-bold">Vista previa · Agente IA</p>
            <p className="text-[10px] text-white/70">Chat conectado al asistente IA</p>
          </div>
          <div
            ref={waBodyRef}
            className="flex-1 min-h-[280px] max-h-[360px] overflow-y-auto px-3 py-3 flex flex-col gap-2 bg-[#e5ddd5]"
          >
            {waMessages.length === 0 && !waTyping && (
              <div className="self-center text-center text-[11px] text-slate-500 px-4 py-8">
                Envía un mensaje o una notificación de prueba para iniciar la conversación.
              </div>
            )}
            {waMessages.map((msg) => {
              const isIn = msg.sender === "in";
              return (
                <div
                  key={msg.id}
                  className={`max-w-[90%] px-2.5 py-1.5 rounded-lg text-xs leading-relaxed shadow-sm ${
                    isIn
                      ? "self-start bg-white rounded-tl-none text-slate-800"
                      : "self-end bg-[#dcf8c6] rounded-tr-none text-slate-800"
                  }`}
                >
                  {msg.html ? (
                    <div
                      className="[&>strong]:font-bold"
                      dangerouslySetInnerHTML={{ __html: msg.html }}
                    />
                  ) : (
                    msg.text
                  )}
                  <span className="text-[9px] text-slate-400 float-right ml-2 mt-1">{msg.time}</span>
                </div>
              );
            })}
            {waTyping && (
              <div className="self-start bg-white rounded-lg px-3 py-2 text-xs text-slate-400">
                escribiendo…
              </div>
            )}
            {showQuickReplies && !waTyping && (
              <div className="flex flex-col gap-1.5 mt-1">
                {["¿Cuánto debo pagar de IVA?", "¿Cuáles son mis obligaciones?"].map((q) => (
                  <button
                    key={q}
                    onClick={() => handleWaSend(q)}
                    className="bg-white hover:bg-slate-50 text-[#075e54] text-[11px] font-semibold py-2 rounded-lg border border-slate-200 cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-2 border-t border-slate-100 flex gap-2 bg-white">
            <input
              className="flex-1 border border-slate-200 rounded-full px-3 py-2 text-xs outline-none focus:border-brand-navy"
              placeholder="Escribe al asistente…"
              value={waInput}
              onChange={(e) => setWaInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleWaSend(waInput)}
            />
            <button
              onClick={() => handleWaSend(waInput)}
              className="w-9 h-9 rounded-full bg-[#25d366] text-white flex items-center justify-center cursor-pointer hover:bg-[#1ebd59] shrink-0"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={showDisconnectConfirm}
        title="Desvincular WhatsApp"
        message="¿Desvincular WhatsApp de este emisor?"
        confirmLabel="Desvincular"
        variant="danger"
        loading={loadingWa}
        onConfirm={confirmDisconnectWa}
        onCancel={() => setShowDisconnectConfirm(false)}
      />
    </div>
  );
}
