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

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  llmProvider: string | null;
  updatedAt: number;
}

export default function ChatIA() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
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

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConv ? activeConv.messages : [buildWelcome(emisorName || undefined)];

  // Scroll to bottom when messages or typing state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, typing]);

  // Load chat availability and user details
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

  // Load conversations list from localStorage on mount/emisorName change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("sri_chat_conversations");
    let loadedConvs: Conversation[] = [];
    if (stored) {
      try {
        loadedConvs = JSON.parse(stored);
      } catch (e) {
        console.error("Error parsing stored conversations:", e);
      }
    }
    
    const storedActiveId = localStorage.getItem("sri_chat_active_conv_id");
    
    if (loadedConvs.length === 0) {
      const firstId = "conv_" + Date.now();
      const firstConv: Conversation = {
        id: firstId,
        title: "Nueva conversación",
        messages: [buildWelcome(emisorName || undefined)],
        llmProvider: null,
        updatedAt: Date.now()
      };
      loadedConvs = [firstConv];
      localStorage.setItem("sri_chat_conversations", JSON.stringify(loadedConvs));
      localStorage.setItem("sri_chat_active_conv_id", firstId);
      setConversations(loadedConvs);
      setActiveConversationId(firstId);
    } else {
      setConversations(loadedConvs);
      if (storedActiveId && loadedConvs.some(c => c.id === storedActiveId)) {
        setActiveConversationId(storedActiveId);
        const act = loadedConvs.find(c => c.id === storedActiveId);
        if (act?.llmProvider) setLlmProvider(act.llmProvider);
      } else {
        setActiveConversationId(loadedConvs[0].id);
        localStorage.setItem("sri_chat_active_conv_id", loadedConvs[0].id);
        if (loadedConvs[0].llmProvider) setLlmProvider(loadedConvs[0].llmProvider);
      }
    }
  }, [emisorName]);

  const updateActiveConvMessages = (newMessages: Message[]) => {
    setConversations((prevConvs) => {
      const updated = prevConvs.map((c) => {
        if (c.id === activeConversationId) {
          let title = c.title;
          if (title === "Nueva conversación" || title === "Consulta tributaria") {
            const firstUserMsg = newMessages.find((m) => m.sender === "user");
            if (firstUserMsg && firstUserMsg.text) {
              title = firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? "..." : "");
            }
          }
          return {
            ...c,
            messages: newMessages,
            title,
            updatedAt: Date.now(),
          };
        }
        return c;
      });
      localStorage.setItem("sri_chat_conversations", JSON.stringify(updated));
      return updated;
    });
  };

  const updateActiveConvProvider = (provider: string | null) => {
    setLlmProvider(provider);
    setConversations((prevConvs) => {
      const updated = prevConvs.map((c) => {
        if (c.id === activeConversationId) {
          return { ...c, llmProvider: provider };
        }
        return c;
      });
      localStorage.setItem("sri_chat_conversations", JSON.stringify(updated));
      return updated;
    });
  };

  const handleNewConversation = () => {
    const newId = "conv_" + Date.now();
    const newConv: Conversation = {
      id: newId,
      title: "Nueva conversación",
      messages: [buildWelcome(emisorName || undefined)],
      llmProvider: null,
      updatedAt: Date.now(),
    };
    const updated = [newConv, ...conversations];
    setConversations(updated);
    setActiveConversationId(newId);
    localStorage.setItem("sri_chat_conversations", JSON.stringify(updated));
    localStorage.setItem("sri_chat_active_conv_id", newId);
    setLlmProvider(null);
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = conversations.filter((c) => c.id !== id);

    let nextActiveId = activeConversationId;
    if (activeConversationId === id) {
      if (updated.length > 0) {
        nextActiveId = updated[0].id;
      } else {
        const newId = "conv_" + Date.now();
        const newConv: Conversation = {
          id: newId,
          title: "Nueva conversación",
          messages: [buildWelcome(emisorName || undefined)],
          llmProvider: null,
          updatedAt: Date.now(),
        };
        updated.push(newConv);
        nextActiveId = newId;
      }
    }

    setConversations(updated);
    setActiveConversationId(nextActiveId);
    localStorage.setItem("sri_chat_conversations", JSON.stringify(updated));
    if (nextActiveId) {
      localStorage.setItem("sri_chat_active_conv_id", nextActiveId);
      const act = updated.find((c) => c.id === nextActiveId);
      setLlmProvider(act?.llmProvider || null);
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    localStorage.setItem("sri_chat_active_conv_id", id);
    const act = conversations.find((c) => c.id === id);
    setLlmProvider(act?.llmProvider || null);
  };

  const handleClearActiveChat = () => {
    updateActiveConvMessages([buildWelcome(emisorName || undefined)]);
    updateActiveConvProvider(null);
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    if (!sriClient.isAuthenticated()) {
      const updatedMsgs = [
        ...messages,
        { sender: "user" as const, text, time: nowTime() },
        {
          sender: "ai" as const,
          text: "Inicia sesión con tu RUC para consultar datos reales de tu cuenta tributaria.",
          time: nowTime(),
        },
      ];
      updateActiveConvMessages(updatedMsgs);
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
    const updatedWithUser = [...messages, userMsg];
    updateActiveConvMessages(updatedWithUser);
    setInputText("");
    setTyping(true);

    try {
      const res = await sriClient.chat(text, history);
      setTyping(false);
      if (res?.provider) {
        updateActiveConvProvider(res.provider);
      }
      if (res?.html || res?.text) {
        const aiReply: Message = {
          sender: "ai",
          time: res.time || nowTime(),
          html: res.html || res.text,
        };
        updateActiveConvMessages([...updatedWithUser, aiReply]);
      }
    } catch (err: any) {
      setTyping(false);
      const errorReply: Message = {
        sender: "ai",
        time: nowTime(),
        text: err.message || "Error de red al consultar el asistente.",
      };
      updateActiveConvMessages([...updatedWithUser, errorReply]);
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
        <aside className="w-64 border-r border-brand-gray-200 bg-white hidden md:flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-brand-gray-100 flex flex-col gap-2">
            <button
              onClick={handleNewConversation}
              className="w-full flex items-center justify-center gap-1.5 border border-brand-gray-200 hover:border-brand-navy-light hover:text-brand-navy bg-white hover:bg-brand-gray-50 transition-colors py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nueva conversación
            </button>
            <button
              onClick={handleClearActiveChat}
              className="w-full flex items-center justify-center gap-1.5 border border-amber-200 hover:border-amber-300 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Limpiar chat actual
            </button>
          </div>

          <nav className="p-3 flex-1 overflow-y-auto flex flex-col gap-1.5">
            <div className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-widest px-2.5 mb-1.5">
              Tus conversaciones
            </div>
            
            <div className="flex flex-col gap-1">
              {conversations.map((c) => {
                const isActive = c.id === activeConversationId;
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                      isActive
                        ? "text-brand-navy bg-[#F0F7FF] border-[#C7DEFF]"
                        : "text-brand-gray-600 hover:text-brand-navy hover:bg-brand-gray-50 border-transparent"
                    }`}
                  >
                    <span className="truncate pr-6 select-none" title={c.title}>
                      {c.title}
                    </span>
                    <button
                      onClick={(e) => handleDeleteConversation(c.id, e)}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 hover:text-destructive hover:scale-110 transition-all p-1 rounded-md cursor-pointer border-none bg-transparent"
                      title="Eliminar conversación"
                    >
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
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
