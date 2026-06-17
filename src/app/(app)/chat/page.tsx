"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { sriClient } from "@/lib/sriClient";

interface Message {
  sender: "ai" | "user";
  text?: string;
  time: string;
  html?: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function buildWelcome(razonSocial?: string): Message {
  const name = razonSocial ? `, ${razonSocial.split(" ")[0]}` : "";
  return {
    sender: "ai",
    text: `¡Hola${name}! Soy tu asistente tributario con acceso a los datos reales de tu cuenta. Puedo ayudarte con IVA, compras, ventas, alertas de auditoría y obligaciones del SRI. ¿En qué te ayudo hoy?`,
    time: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function ChatIA() {
  const [messages, setMessages] = useState<Message[]>([buildWelcome()]);
  const [inputText, setInputText] = useState("");
  const [typing, setTyping] = useState(false);
  const [llmProvider, setLlmProvider] = useState<string | null>(null);
  const [chatAvailable, setChatAvailable] = useState(true);
  const [emisorName, setEmisorName] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState("TU");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const todayLabel = new Date().toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
  });

  const nowTime = () => {
    const d = new Date();
    return (
      d.getHours().toString().padStart(2, "0") +
      ":" +
      d.getMinutes().toString().padStart(2, "0")
    );
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing]);

  useEffect(() => {
    if (!sriClient.isAuthenticated()) return;
    sriClient.getChatStatus().then((res) => {
      setChatAvailable(!!res.available);
      if (res.provider) setLlmProvider(res.provider);
    }).catch(() => setChatAvailable(false));
    sriClient.getEmisor().then((res) => {
      if (res.success && res.emisor) {
        if (res.emisor.razonSocial) {
          setEmisorName(res.emisor.razonSocial);
          setMessages([buildWelcome(res.emisor.razonSocial)]);
        }
        const name = res.emisor.razonSocial || res.emisor.ruc || "";
        const parts = name.trim().split(/\s+/).filter(Boolean);
        const initials = parts.length >= 2
          ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
          : name.slice(0, 2).toUpperCase() || "TU";
        setUserInitials(initials);
      }
    });
  }, []);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    if (!sriClient.isAuthenticated()) {
      setMessages((prev) => [
        ...prev,
        { sender: "user", text, time: nowTime() },
        {
          sender: "ai",
          text: "Inicia sesión con tu RUC para consultar datos reales de tu cuenta tributaria.",
          time: nowTime(),
        },
      ]);
      setInputText("");
      return;
    }

    const history = messages.map((m) => ({
      role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
      content: m.text || stripHtml(m.html || ""),
    }));

    const userMsg: Message = {
      sender: "user",
      text,
      time: nowTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setTyping(true);

    try {
      const res = await sriClient.chat(text, history);
      setTyping(false);
      if (res?.provider) setLlmProvider(res.provider);
      if (res?.html || res?.text) {
        const aiReply: Message = {
          sender: "ai",
          time: res.time || nowTime(),
          html: res.html || res.text,
        };
        setMessages((prev) => [...prev, aiReply]);
      }
    } catch (err: any) {
      setTyping(false);
      const errorReply: Message = {
        sender: "ai",
        time: nowTime(),
        text: err.message || "Error de red al consultar el asistente.",
      };
      setMessages((prev) => [...prev, errorReply]);
    }
  };

  return (
    <>
      <Topbar title="Chat IA" />

      {!chatAvailable && (
        <div className="mx-4 md:mx-6 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Chat IA no configurado. Ve a{" "}
          <Link href="/configuracion?tab=ia" className="font-semibold underline">
            Configuración → Inteligencia IA
          </Link>{" "}
          para agregar tu API key de Gemini o Claude.
        </div>
      )}

      {/* INNER CHAT LAYOUT WITH CHAT HISTORY SIDEBAR */}
      <div className="flex-1 flex overflow-hidden select-none bg-brand-gray-50">
        {/* Chat History Sidebar */}
        <aside className="w-56 border-r border-brand-gray-200 bg-white hidden md:flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-brand-gray-100">
            <button
              onClick={() => {
                setMessages([buildWelcome(emisorName || undefined)]);
                setLlmProvider(null);
              }}
              className="w-full flex items-center justify-center gap-1.5 border border-brand-gray-200 hover:border-brand-navy-light hover:text-brand-navy bg-white hover:bg-brand-gray-50 transition-colors py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nueva conversación
            </button>
          </div>

          <nav className="p-3 flex-1 overflow-y-auto flex flex-col gap-1.5">
            <div className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-widest px-2.5 mb-1.5">
              Conversación actual
            </div>
            <div className="px-2.5 py-2 rounded-lg text-xs font-semibold text-brand-navy bg-[#F0F7FF] border border-[#C7DEFF] cursor-default truncate">
              {messages.length > 1
                ? (messages[messages.length - 1].text || "Consulta tributaria").slice(0, 40)
                : "Nueva conversación"}
            </div>
            <p className="px-2.5 text-[10px] text-brand-gray-400 leading-snug">
              El historial de conversaciones anteriores se gestionará cuando esté disponible en la API.
            </p>
          </nav>
        </aside>

        {/* MAIN CHAT AREA */}
        <div className="flex-1 flex flex-col h-[calc(100vh-60px)] relative overflow-hidden bg-brand-gray-50">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
            <div className="max-w-[760px] w-full mx-auto flex flex-col gap-4.5">
              <div className="text-center my-3 relative">
                <span className="bg-brand-gray-50 px-3 py-1 text-[11px] text-brand-gray-400 font-semibold relative z-10">
                  Hoy · {todayLabel}
                </span>
                <div className="absolute top-1/2 left-0 right-0 h-px bg-brand-gray-200 -z-0"></div>
              </div>

              {messages.map((msg, index) => {
                const isAi = msg.sender === "ai";
                return (
                  <div key={index} className={`flex gap-3 max-w-[80%] ${isAi ? "self-start" : "self-end flex-row-reverse text-right"}`}>
                    <div
                      className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white ${
                        isAi ? "bg-gradient-to-br from-brand-navy to-brand-navy-light" : "bg-gradient-to-br from-[#2256A8] to-brand-sky"
                      }`}
                    >
                      {isAi ? (
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1-12h4M19-12h4" />
                        </svg>
                      ) : (
                        userInitials
                      )}
                    </div>
                    <div>
                      <div
                        className={`p-3.5 rounded-2xl shadow-xs leading-relaxed text-xs md:text-sm text-left ${
                          isAi
                            ? "bg-white border border-brand-gray-200 text-brand-gray-800 rounded-tl-sm"
                            : "bg-brand-navy text-white rounded-tr-sm"
                        }`}
                      >
                        {msg.html ? (
                          <div
                            className="flex flex-col gap-1.5 [&>strong]:text-brand-navy [&>strong]:font-bold"
                            dangerouslySetInnerHTML={{ __html: msg.html }}
                          ></div>
                        ) : (
                          msg.text
                        )}
                        {/* Inline links rendering */}
                        {msg.html && msg.html.includes("declaración") && (
                          <div className="flex gap-2.5 mt-3 select-none">
                            <Link href="/declaraciones" className="bg-brand-navy hover:bg-brand-navy-mid text-white text-[11px] font-semibold rounded-md px-3 py-1.5 transition-colors">
                              Ir al asistente de declaraciones
                            </Link>
                          </div>
                        )}
                      </div>
                      <div className={`text-[10px] text-brand-gray-400 mt-1 px-1.5 ${isAi ? "text-left" : "text-right"}`}>
                        {msg.time}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing bubble */}
              {typing && (
                <div className="flex gap-3 max-w-[80%] self-start">
                  <div className="w-8 h-8 rounded-lg shrink-0 bg-gradient-to-br from-brand-navy to-brand-navy-light flex items-center justify-center text-white">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                  <div className="bg-white border border-brand-gray-200 p-4.5 rounded-2xl rounded-tl-sm flex gap-1 items-center shadow-xs">
                    <div className="w-1.5 h-1.5 bg-brand-gray-400 rounded-full animate-[typing_1.4s_infinite]"></div>
                    <div className="w-1.5 h-1.5 bg-brand-gray-400 rounded-full animate-[typing_1.4s_infinite_0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-brand-gray-400 rounded-full animate-[typing_1.4s_infinite_0.4s]"></div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef}></div>
            </div>
          </div>

          {/* SUGGESTED COMMAND CHIPS */}
          <div className="max-w-[760px] w-full mx-auto px-6 pb-2.5 flex flex-wrap gap-2 justify-start select-none">
            <button
              onClick={() => handleSend("¿Cuánto debo pagar de IVA este período?")}
              className="bg-white hover:bg-blue-50/50 border border-brand-gray-200 hover:border-brand-navy-light text-brand-navy text-[11px] md:text-xs font-semibold rounded-full px-3.5 py-2 flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
            >
              Mis obligaciones e IVA
            </button>
            <button
              onClick={() => handleSend("Muéstrame las alertas de auditoría")}
              className="bg-white hover:bg-blue-50/50 border border-brand-gray-200 hover:border-brand-navy-light text-brand-navy text-[11px] md:text-xs font-semibold rounded-full px-3.5 py-2 flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
            >
              Ver alertas de riesgo
            </button>
            <button
              onClick={() => handleSend("¿Qué es el régimen RIMPE?")}
              className="bg-white hover:bg-blue-50/50 border border-brand-gray-200 hover:border-brand-navy-light text-brand-navy text-[11px] md:text-xs font-semibold rounded-full px-3.5 py-2 flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
            >
              ¿Qué es el RIMPE?
            </button>
            <button
              onClick={() => handleSend("Proyecta mi IVA de los próximos 3 meses")}
              className="bg-white hover:bg-blue-50/50 border border-brand-gray-200 hover:border-brand-navy-light text-brand-navy text-[11px] md:text-xs font-semibold rounded-full px-3.5 py-2 flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
            >
              Proyección de impuestos
            </button>
          </div>

          {/* CHAT INPUT AREA */}
          <div className="border-t border-brand-gray-200 bg-white p-4.5 md:px-6 md:pb-6 md:pt-4 flex-shrink-0">
            <div className="max-w-[760px] mx-auto">
              <div className="flex items-end gap-2 bg-brand-gray-50 border border-brand-gray-200 focus-within:border-brand-navy-light focus-within:bg-white rounded-2xl p-2.5">
                <div className="flex gap-0.5">
                  <button className="w-9 h-9 rounded-lg hover:bg-brand-gray-100 flex items-center justify-center text-brand-gray-400 hover:text-brand-navy transition-colors shrink-0">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <button className="w-9 h-9 rounded-lg hover:bg-brand-gray-100 flex items-center justify-center text-brand-gray-400 hover:text-brand-navy transition-colors shrink-0">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </button>
                </div>

                <textarea
                  className="flex-1 border-none outline-none bg-transparent text-sm text-brand-gray-800 font-sans resize-none py-2 max-h-24 leading-relaxed"
                  rows={1}
                  placeholder="Escribe tu pregunta tributaria..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(inputText);
                    }
                  }}
                ></textarea>

                <button className="w-9 h-9 rounded-lg hover:bg-brand-gray-100 flex items-center justify-center text-brand-gray-400 hover:text-brand-navy transition-colors shrink-0">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
                  </svg>
                </button>

                <button
                  onClick={() => handleSend(inputText)}
                  className="w-9.5 h-9.5 rounded-xl bg-brand-navy hover:bg-brand-navy-mid hover:scale-105 transition-all text-white flex items-center justify-center shrink-0 shadow-sm border-none cursor-pointer"
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>

              <div className="flex justify-between items-center mt-2.5 px-1 select-none">
                <div className="flex gap-3">
                  <span className="flex items-center gap-1 text-[11px] text-brand-gray-400 hover:text-brand-navy cursor-pointer">
                    Texto
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-brand-gray-400 hover:text-brand-navy cursor-pointer">
                    Voz
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-brand-gray-400 hover:text-brand-navy cursor-pointer">
                    Documentos
                  </span>
                </div>
                <span className="text-[10px] text-brand-gray-300 text-right">
                  {llmProvider
                    ? `IA: ${llmProvider === "gemini" ? "Gemini" : "Claude"} · Verifica datos importantes.`
                    : "Respuestas con datos reales de tu cuenta · Verifica datos importantes."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
