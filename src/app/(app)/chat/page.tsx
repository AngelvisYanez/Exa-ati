"use client";

import { Suspense, useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { sriClient } from "@/lib/sriClient";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { normalizeChatHtml } from "@/lib/chat-html";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  Search,
  Menu,
  X,
  FileText,
  Receipt,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Bot,
  User,
  RefreshCw,
  Download,
  HelpCircle,
  Package,
  Layers,
  ChevronRight,
  Zap,
} from "lucide-react";

interface Message {
  sender: "ai" | "user";
  text?: string;
  time: string;
  html?: string;
  provider?: string | null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function buildWelcome(razonSocial?: string): Message {
  const name = razonSocial ? `, ${razonSocial.split(" ")[0]}` : "";
  return {
    sender: "ai",
    text: `¡Hola${name}! 👋 Soy tu **Asistente Tributario y Contable con Inteligencia Artificial**.

Tengo acceso seguro a los datos de tu empresa y puedo ayudarte a:
- 📊 **Consultar tu información SRI**: IVA, retenciones, facturas recibidas y alertas de auditoría.
- 🧾 **Emitir facturas electrónicas**: Genera y envía facturas en tiempo real al SRI.
- 📦 **Gestionar tu inventario**: Registra productos, precios y consulta existencia.
- 💳 **Cuentas por cobrar y pagar**: Revisa saldos pendientes y registra abonos.

¿En qué puedo ayudarte hoy? Elige una de las sugerencias o escribe tu consulta.`,
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

const CHIP_CATEGORIES = [
  { id: "todos", label: "Todas las sugerencias" },
  { id: "facturacion", label: "🧾 Facturas e Inventario" },
  { id: "cuentas", label: "💳 Cobros y Pagos" },
  { id: "sri", label: "📊 SRI e Impuestos" },
] as const;

interface PromptChip {
  id: string;
  category: "facturacion" | "cuentas" | "sri";
  label: string;
  prompt: string;
  icon: any;
}

const PROMPT_CHIPS: PromptChip[] = [
  {
    id: "iva",
    category: "sri",
    label: "Mis obligaciones e IVA",
    prompt: "¿Cuánto debo pagar de IVA este período?",
    icon: FileText,
  },
  {
    id: "cxc",
    category: "cuentas",
    label: "Cuentas por cobrar",
    prompt: "¿Cuánto me deben mis clientes? (cuentas por cobrar)",
    icon: CreditCard,
  },
  {
    id: "cxp",
    category: "cuentas",
    label: "Cuentas por pagar",
    prompt: "¿Cuánto debo a mis proveedores? (cuentas por pagar)",
    icon: CreditCard,
  },
  {
    id: "producto",
    category: "facturacion",
    label: "Crear producto",
    prompt: "Quiero crear un producto en el inventario",
    icon: Package,
  },
  {
    id: "alertas",
    category: "sri",
    label: "Alertas de riesgo",
    prompt: "Muéstrame las alertas de auditoría y diferencias de IVA",
    icon: AlertTriangle,
  },
  {
    id: "emitir",
    category: "facturacion",
    label: "Emitir factura",
    prompt: "Quiero emitir una factura electrónica a un cliente",
    icon: Receipt,
  },
  {
    id: "rimpe",
    category: "sri",
    label: "¿Qué es el RIMPE?",
    prompt: "¿Qué deberes y ventajas tengo en el régimen RIMPE?",
    icon: HelpCircle,
  },
  {
    id: "proyeccion",
    category: "sri",
    label: "Proyección fiscal",
    prompt: "Proyecta mi estimación de IVA e Impuesto a la Renta de los próximos 3 meses",
    icon: TrendingUp,
  },
];

function ChatIA() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [typing, setTyping] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    tool: string;
    args: Record<string, unknown>;
  } | null>(null);
  const [llmProvider, setLlmProvider] = useState<string | null>(null);
  const [chatAvailable, setChatAvailable] = useState(true);
  const [emisorName, setEmisorName] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState("TU");

  // UI States
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [likedMessages, setLikedMessages] = useState<Record<number, "up" | "down" | null>>({});
  const [activeCategory, setActiveCategory] = useState<string>("todos");
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speechRecognitionRef = useRef<any>(null);
  const pendingUrlQueryRef = useRef<string | null>(null);
  const urlQueryHandledRef = useRef(false);

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

  // Auto-scroll on new messages or typing
  useEffect(() => {
    scrollToBottom();
  }, [messages, typing]);

  // Adjust textarea height automatically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  // Check auth and fetch company info & LLM status
  useEffect(() => {
    if (!sriClient.isAuthenticated()) return;
    sriClient
      .getChatStatus()
      .then((res) => {
        setChatAvailable(!!res.available);
        if (res.provider) setLlmProvider(res.provider);
      })
      .catch(() => setChatAvailable(false));

    sriClient.getEmisor().then((res) => {
      if (res.success && res.emisor) {
        if (res.emisor.razonSocial) {
          setEmisorName(res.emisor.razonSocial);
        }
        const name = res.emisor.razonSocial || res.emisor.ruc || "";
        const parts = name.trim().split(/\s+/).filter(Boolean);
        const initials =
          parts.length >= 2
            ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
            : name.slice(0, 2).toUpperCase() || "TU";
        setUserInitials(initials);
      }
    });
  }, []);

  // Load saved conversations
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
        updatedAt: Date.now(),
      };
      loadedConvs = [firstConv];
      localStorage.setItem("sri_chat_conversations", JSON.stringify(loadedConvs));
      localStorage.setItem("sri_chat_active_conv_id", firstId);
      setConversations(loadedConvs);
      setActiveConversationId(firstId);
    } else {
      setConversations(loadedConvs);
      if (storedActiveId && loadedConvs.some((c) => c.id === storedActiveId)) {
        setActiveConversationId(storedActiveId);
        const act = loadedConvs.find((c) => c.id === storedActiveId);
        if (act?.llmProvider) setLlmProvider(act.llmProvider);
      } else {
        setActiveConversationId(loadedConvs[0].id);
        localStorage.setItem("sri_chat_active_conv_id", loadedConvs[0].id);
        if (loadedConvs[0].llmProvider) setLlmProvider(loadedConvs[0].llmProvider);
      }
    }
  }, [emisorName]);

  // Captura consulta inicial desde el dashboard (/chat?q=...)
  useEffect(() => {
    const q = searchParams.get("q")?.trim();
    if (!q || urlQueryHandledRef.current) return;
    pendingUrlQueryRef.current = q;
    router.replace("/chat", { scroll: false });
  }, [searchParams, router]);

  const updateActiveConvMessages = (newMessages: Message[]) => {
    setConversations((prevConvs) => {
      const updated = prevConvs.map((c) => {
        if (c.id === activeConversationId) {
          let title = c.title;
          if (title === "Nueva conversación" || title === "Consulta tributaria") {
            const firstUserMsg = newMessages.find((m) => m.sender === "user");
            if (firstUserMsg && firstUserMsg.text) {
              title =
                firstUserMsg.text.slice(0, 28) + (firstUserMsg.text.length > 28 ? "..." : "");
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
    setMobileSidebarOpen(false);
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (conversations.length <= 1) {
      handleClearActiveChat();
      return;
    }
    const updated = conversations.filter((c) => c.id !== id);

    let nextActiveId = activeConversationId;
    if (activeConversationId === id) {
      if (updated.length > 0) {
        nextActiveId = updated[0].id;
      }
    }

    setConversations(updated);
    if (nextActiveId) {
      setActiveConversationId(nextActiveId);
      localStorage.setItem("sri_chat_active_conv_id", nextActiveId);
      const act = updated.find((c) => c.id === nextActiveId);
      setLlmProvider(act?.llmProvider || null);
    }
    localStorage.setItem("sri_chat_conversations", JSON.stringify(updated));
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    localStorage.setItem("sri_chat_active_conv_id", id);
    const act = conversations.find((c) => c.id === id);
    setLlmProvider(act?.llmProvider || null);
    setMobileSidebarOpen(false);
  };

  const handleClearActiveChat = () => {
    updateActiveConvMessages([buildWelcome(emisorName || undefined)]);
    updateActiveConvProvider(null);
  };

  const handleRenameSave = (id: string) => {
    if (!editingTitle.trim()) {
      setEditingConvId(null);
      return;
    }
    setConversations((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, title: editingTitle.trim() } : c));
      localStorage.setItem("sri_chat_conversations", JSON.stringify(updated));
      return updated;
    });
    setEditingConvId(null);
  };

  const handleSend = async (textToSend?: string) => {
    const queryText = (textToSend ?? inputText).trim();
    if (!queryText || typing) return;

    if (!sriClient.isAuthenticated()) {
      const updatedMsgs = [
        ...messages,
        { sender: "user" as const, text: queryText, time: nowTime() },
        {
          sender: "ai" as const,
          text: "🔒 Inicia sesión con tu RUC en la plataforma para consultar datos reales de tu cuenta tributaria.",
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
      text: queryText,
      time: nowTime(),
    };

    const updatedWithUser = [...messages, userMsg];
    updateActiveConvMessages(updatedWithUser);
    setInputText("");
    setTyping(true);

    try {
      const isConfirm =
        !!pendingConfirm &&
        /^(confirma\s*:?\s*)?(s[ií]|si|yes|ok|adelante|dale|procede|confirmar|confirmado)\.?$/i.test(
          queryText
        );

      // Si hay una acción pendiente de confirmar y este mensaje NO es la confirmación,
      // descartarla para que un "sí" posterior no ejecute por accidente una acción anterior.
      if (pendingConfirm && !isConfirm) {
        setPendingConfirm(null);
      }

      const res = isConfirm && pendingConfirm
        ? await sriClient.chat(queryText, history, {
            confirmTool: pendingConfirm.tool,
            toolArgs: pendingConfirm.args,
          })
        : await sriClient.chat(queryText, history);

      setTyping(false);

      if (res?.pendingTool) {
        setPendingConfirm({
          tool: res.pendingTool,
          args: res.pendingArgs || {},
        });
      } else if (res?.confirmedTool || isConfirm) {
        setPendingConfirm(null);
      }

      if (res?.provider) {
        updateActiveConvProvider(res.provider);
      }

      if (res?.html || res?.text) {
        const aiReply: Message = {
          sender: "ai",
          time: res.time || nowTime(),
          html: res.html || res.text,
          provider: res.provider || llmProvider,
        };
        updateActiveConvMessages([...updatedWithUser, aiReply]);
      }
    } catch (err: any) {
      setTyping(false);
      const errorReply: Message = {
        sender: "ai",
        time: nowTime(),
        text: `⚠️ ${err.message || "No pudimos conectar con el servidor de IA. Inténtalo de nuevo."}`,
      };
      updateActiveConvMessages([...updatedWithUser, errorReply]);
    }
  };

  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;

  // Envía automáticamente la consulta llegada desde el dashboard
  useEffect(() => {
    const q = pendingUrlQueryRef.current;
    if (!q || !activeConversationId || urlQueryHandledRef.current || typing) return;
    urlQueryHandledRef.current = true;
    pendingUrlQueryRef.current = null;
    void handleSendRef.current(q);
  }, [activeConversationId, typing]);

  // Text to Speech
  const toggleSpeech = (index: number, textContent: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textContent);
    utterance.lang = "es-EC";
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  // Copy message text
  const handleCopyText = (index: number, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Speech Recognition (Voice Input)
  const toggleVoiceInput = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Tu navegador no soporta entrada de voz por micrófono.");
      return;
    }

    if (isListening) {
      speechRecognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-EC";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join("");
      setInputText(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    speechRecognitionRef.current = recognition;
    recognition.start();
  };

  // Filtered prompt chips
  const filteredChips = PROMPT_CHIPS.filter(
    (chip) => activeCategory === "todos" || chip.category === activeCategory
  );

  // Filtered conversation history
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden md:h-dvh">
      <Topbar title="Chat IA Tributario" />

      {/* Warning banner when LLM key is missing */}
      {!chatAvailable && (
        <div className="mx-4 md:mx-6 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Chat IA no configurado. Agrega tu API key en{" "}
              <Link href="/configuracion?tab=ia" className="font-semibold underline hover:text-brand-red">
                Configuración → Inteligencia IA
              </Link>
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex overflow-hidden select-none bg-brand-gray-50 w-full min-w-0">
        {/* MOBILE SIDEBAR OVERLAY */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* CHAT HISTORY SIDEBAR */}
        <aside
          className={`fixed md:relative inset-y-0 left-0 z-50 w-[85vw] max-w-xs md:w-72 lg:w-80 border-r border-brand-gray-200 bg-white flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out h-full shadow-lg md:shadow-none ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          {/* Header & New Chat Button */}
          <div className="p-3.5 sm:p-4 border-b border-brand-gray-100 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-red font-bold text-sm">
                <Sparkles className="w-4 h-4 text-brand-red animate-pulse" />
                <span>Conversaciones</span>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="md:hidden p-1 rounded-lg text-brand-gray-400 hover:text-brand-gray-700 hover:bg-brand-gray-100 transition-colors"
                title="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={handleNewConversation}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-red to-brand-red-bright hover:opacity-95 text-white shadow-xs py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Nueva conversación
            </button>

            {/* Search conversations */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-400" />
              <input
                type="text"
                placeholder="Buscar conversación..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-xs text-brand-gray-700 outline-none focus:border-brand-red focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Conversation List */}
          <nav className="p-2.5 sm:p-3 flex-1 overflow-y-auto flex flex-col gap-1">
            <div className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-widest px-2.5 mb-1 flex items-center justify-between">
              <span>Historial</span>
              <span>{conversations.length}</span>
            </div>

            {filteredConversations.length === 0 ? (
              <EmptyState title="No hay conversaciones" compact />
            ) : (
              filteredConversations.map((c) => {
                const isActive = c.id === activeConversationId;
                const isEditing = editingConvId === c.id;

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all border ${
                      isActive
                        ? "text-brand-red bg-brand-red-subtle/80 border-brand-red/30 shadow-2xs font-semibold"
                        : "text-brand-gray-600 hover:text-brand-gray-900 hover:bg-brand-gray-100/70 border-transparent"
                    }`}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleRenameSave(c.id)}
                        onKeyDown={(e) => e.key === "Enter" && handleRenameSave(c.id)}
                        autoFocus
                        className="bg-white border border-brand-red rounded px-1.5 py-0.5 text-xs text-brand-gray-800 outline-none w-full mr-2"
                      />
                    ) : (
                      <span className="truncate pr-12 select-none" title={c.title}>
                        {c.title}
                      </span>
                    )}

                    {!isEditing && (
                      <div className="absolute right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-lg px-1 shadow-2xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingConvId(c.id);
                            setEditingTitle(c.title);
                          }}
                          className="p-1 text-brand-gray-400 hover:text-brand-gray-700 rounded transition-colors"
                          title="Renombrar"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteConversation(c.id, e)}
                          className="p-1 text-brand-gray-400 hover:text-brand-red rounded transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </nav>

          {/* Footer Actions */}
          <div className="p-3 border-t border-brand-gray-200 bg-brand-gray-50/50">
            <button
              onClick={handleClearActiveChat}
              className="w-full flex items-center justify-center gap-1.5 text-brand-gray-500 hover:text-brand-red hover:bg-brand-red-subtle border border-brand-gray-200 hover:border-brand-red-pale transition-all py-1.5 rounded-lg text-[11px] font-medium cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reiniciar chat actual
            </button>
          </div>
        </aside>

        {/* MAIN CHAT AREA */}
        <div className="flex-1 flex flex-col h-full min-w-0 relative overflow-hidden bg-brand-gray-50/60">
          {/* Top Info Bar */}
          <div className="px-3 sm:px-6 py-2.5 bg-white border-b border-brand-gray-200 flex items-center justify-between text-xs shrink-0 shadow-2xs min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden p-1.5 rounded-lg border border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-100 transition-colors shrink-0"
                title="Ver historial de conversaciones"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-brand-gray-800 truncate max-w-[180px] sm:max-w-[320px] md:max-w-[480px]">
                  {activeConv?.title || "Nueva conversación"}
                </span>
                <span className="text-[10px] bg-green-100 text-green-800 font-semibold px-2 py-0.5 rounded-full hidden sm:flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Datos SRI Conectados
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 text-[11px] text-brand-gray-500">
                <Bot className="w-3.5 h-3.5 text-brand-red" />
                <strong className="text-brand-gray-700">Asistente Tributario</strong>
              </div>
            </div>
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 flex flex-col gap-4 min-w-0">
            <div className="max-w-6xl 2xl:max-w-[1600px] w-full mx-auto flex flex-col gap-4 min-w-0">
              <div className="text-center my-1 relative">
                <span className="bg-brand-gray-50 px-3 py-1 text-[11px] text-brand-gray-400 font-medium relative z-10 rounded-full border border-brand-gray-200">
                  <span suppressHydrationWarning>Hoy · {todayLabel}</span>
                </span>
                <div className="absolute top-1/2 left-0 right-0 h-px bg-brand-gray-200 -z-0"></div>
              </div>

              {messages.map((msg, index) => {
                const isAi = msg.sender === "ai";
                const textContent = msg.text || stripHtml(msg.html || "");

                return (
                  <div
                    key={index}
                    className={`flex gap-2.5 sm:gap-3 min-w-0 ${
                      isAi
                        ? "w-full max-w-3xl self-start"
                        : "self-end max-w-[85%] sm:max-w-[75%] md:max-w-[42rem] flex-row-reverse"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl shrink-0 flex items-center justify-center text-white shadow-xs font-bold text-xs ${
                        isAi
                          ? "bg-gradient-to-br from-brand-red via-brand-red-mid to-brand-red-bright"
                          : "bg-gradient-to-br from-blue-600 to-indigo-700"
                      }`}
                    >
                      {isAi ? <Bot className="w-4 h-4 text-white" /> : userInitials}
                    </div>

                    {/* Message Card */}
                    <div className={`group relative flex flex-col min-w-0 flex-1 ${isAi ? "" : "items-end"}`}>
                      <div
                        className={`p-3.5 sm:p-4 rounded-2xl shadow-xs leading-relaxed text-xs sm:text-sm text-left break-words overflow-wrap-anywhere transition-all w-full min-w-0 ${
                          isAi
                            ? "bg-white border border-brand-gray-200 text-brand-gray-800 rounded-tl-sm hover:shadow-sm"
                            : "bg-brand-red text-white rounded-tr-sm shadow-brand-red/10"
                        }`}
                      >
                        {msg.html ? (
                          <div
                            className={`chat-msg-body leading-relaxed whitespace-normal break-words [overflow-wrap:anywhere]
                              [&_strong]:font-semibold
                              [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-1
                              [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1
                              [&_h3]:text-xs [&_h3]:font-bold [&_h3]:mt-1.5
                              [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
                              [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
                              [&_li]:leading-relaxed
                              [&_p]:my-1.5 [&_p]:leading-relaxed
                              [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_blockquote]:py-1.5 [&_blockquote]:my-2 [&_blockquote]:rounded-r-lg
                              [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px]
                              [&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_table]:text-left
                              [&_th]:p-2 [&_th]:text-left [&_th]:font-bold [&_th]:text-xs [&_th]:border-b
                              [&_td]:p-2 [&_td]:border-b [&_td]:text-xs
                              ${
                                isAi
                                  ? "text-brand-gray-800 [&_strong]:text-brand-red [&_blockquote]:border-brand-red/40 [&_blockquote]:bg-brand-red-subtle/50 [&_code]:bg-brand-gray-100 [&_code]:text-brand-red [&_th]:bg-brand-gray-100 [&_th]:text-brand-gray-700 [&_td]:border-brand-gray-100"
                                  : "text-white [&_strong]:text-white [&_a]:underline"
                              }`}
                            dangerouslySetInnerHTML={{
                              __html: sanitizeHtml(normalizeChatHtml(msg.html)),
                            }}
                          />
                        ) : (
                          <div
                            className={`prose prose-sm max-w-none break-words text-left [overflow-wrap:anywhere] [&>p]:my-1.5 [&>strong]:font-semibold [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 ${
                              isAi ? "prose-neutral [&_strong]:text-brand-red" : "prose-invert"
                            }`}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text || ""}</ReactMarkdown>
                          </div>
                        )}

                        {/* Interactive Contextual Action Links */}
                        {msg.html && (
                          <div className="flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-brand-gray-100 select-none">
                            {msg.html.includes("declaración") && (
                              <Link
                                href="/declaraciones"
                                className="bg-brand-red hover:bg-brand-red-mid text-white text-[11px] font-semibold rounded-lg px-3 py-1.5 transition-all shadow-2xs flex items-center gap-1"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Ir a Declaraciones SRI
                              </Link>
                            )}
                            {(msg.html.includes("factura") || msg.html.includes("facturar")) && (
                              <Link
                                href="/emitir"
                                className="bg-brand-sky hover:bg-brand-sky text-white text-[11px] font-semibold rounded-lg px-3 py-1.5 transition-all shadow-2xs flex items-center gap-1"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                Emitir Factura Electrónica
                              </Link>
                            )}
                            {(msg.html.includes("producto") || msg.html.includes("inventario")) && (
                              <Link
                                href="/inventario"
                                className="bg-success hover:bg-success text-white text-[11px] font-semibold rounded-lg px-3 py-1.5 transition-all shadow-2xs flex items-center gap-1"
                              >
                                <Package className="w-3.5 h-3.5" />
                                Ver Inventario
                              </Link>
                            )}
                            {(msg.html.includes("cobrar") || msg.html.includes("pagar")) && (
                              <Link
                                href="/cuentas-por-cobrar"
                                className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded-lg px-3 py-1.5 transition-all shadow-2xs flex items-center gap-1"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                Gestionar Cuentas
                              </Link>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer & Hover Actions */}
                      <div
                        className={`flex items-center gap-2 mt-1 px-1 text-[10px] text-brand-gray-400 ${
                          isAi ? "justify-between" : "justify-end"
                        }`}
                      >
                        <span suppressHydrationWarning>{msg.time}</span>

                        {isAi && (
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-white border border-brand-gray-200 rounded-lg px-1 py-0.5 shadow-2xs">
                            <button
                              onClick={() => handleCopyText(index, textContent)}
                              className="p-1 hover:text-brand-red rounded transition-colors"
                              title="Copiar respuesta"
                            >
                              {copiedIndex === index ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={() => toggleSpeech(index, textContent)}
                              className="p-1 hover:text-brand-red rounded transition-colors"
                              title="Escuchar audio"
                            >
                              {speakingIndex === index ? (
                                <VolumeX className="w-3 h-3 text-brand-red animate-pulse" />
                              ) : (
                                <Volume2 className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                setLikedMessages((prev) => ({
                                  ...prev,
                                  [index]: prev[index] === "up" ? null : "up",
                                }))
                              }
                              className={`p-1 hover:text-green-600 rounded transition-colors ${
                                likedMessages[index] === "up" ? "text-green-600" : ""
                              }`}
                              title="Útil"
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() =>
                                setLikedMessages((prev) => ({
                                  ...prev,
                                  [index]: prev[index] === "down" ? null : "down",
                                }))
                              }
                              className={`p-1 hover:text-brand-red rounded transition-colors ${
                                likedMessages[index] === "down" ? "text-brand-red" : ""
                              }`}
                              title="Mejorar respuesta"
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing Bubble */}
              {typing && (
                <div className="flex gap-3 max-w-[85%] self-start">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl shrink-0 bg-gradient-to-br from-brand-red to-brand-red-bright flex items-center justify-center text-white shadow-xs">
                    <Sparkles className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-white border border-brand-gray-200 px-4 py-3 rounded-2xl rounded-tl-xs flex items-center gap-2 shadow-2xs">
                    <span className="text-xs text-brand-gray-500 font-medium">
                      Consultando datos tributarios...
                    </span>
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-brand-red rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-brand-red rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-brand-red rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* SUGGESTED CHIPS AREA */}
          <div className="max-w-6xl 2xl:max-w-[1600px] w-full mx-auto px-3 sm:px-6 pb-2 shrink-0 min-w-0">
            {/* Category Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none select-none min-w-0">
              {CHIP_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                    activeCategory === cat.id
                      ? "bg-brand-red text-white shadow-2xs"
                      : "bg-white border border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-100"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Prompt Chips */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 select-none scrollbar-none min-w-0">
              {filteredChips.map((chip) => {
                const IconComponent = chip.icon;
                return (
                  <button
                    key={chip.id}
                    onClick={() => handleSend(chip.prompt)}
                    disabled={typing}
                    className="bg-white hover:bg-brand-red-subtle/60 border border-brand-gray-200 hover:border-brand-red/40 text-brand-gray-700 hover:text-brand-red text-xs font-medium rounded-full px-3 py-1.5 flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs whitespace-nowrap active:scale-[0.98] disabled:opacity-50 shrink-0"
                  >
                    <IconComponent className="w-3.5 h-3.5 text-brand-red shrink-0" />
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* INPUT BAR */}
          <div className="border-t border-brand-gray-200 bg-white p-3 sm:px-6 sm:pb-5 sm:pt-3 shrink-0 shadow-lg min-w-0">
            <div className="max-w-6xl 2xl:max-w-[1600px] mx-auto min-w-0">
              <div className="flex items-end gap-2 bg-brand-gray-50 border border-brand-gray-200 focus-within:border-brand-red focus-within:bg-white rounded-2xl p-2 transition-all shadow-2xs">
                {/* Micro / Speech to text button */}
                <button
                  onClick={toggleVoiceInput}
                  type="button"
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                    isListening
                      ? "bg-brand-red text-white animate-pulse"
                      : "text-brand-gray-400 hover:text-brand-red hover:bg-brand-gray-100"
                  }`}
                  title={isListening ? "Escuchando... Haz clic para detener" : "Dictar por voz"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  className="flex-1 border-none outline-none bg-transparent text-xs sm:text-sm text-brand-gray-800 font-sans resize-none py-2 max-h-32 leading-relaxed placeholder:text-brand-gray-400 min-w-0"
                  rows={1}
                  placeholder="Escribe tu consulta tributaria o pide una acción (ej: emitir factura)..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />

                {/* Send Button */}
                <button
                  onClick={() => handleSend()}
                  disabled={!inputText.trim() || typing}
                  className="w-9.5 h-9.5 rounded-xl bg-gradient-to-r from-brand-red to-brand-red-bright hover:opacity-95 text-white flex items-center justify-center shrink-0 shadow-xs border-none cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Input Footer */}
              <div className="flex justify-between items-center mt-2 px-1 text-[10px] text-brand-gray-400 select-none">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" />
                    Presiona <kbd className="bg-brand-gray-100 px-1 py-0.5 rounded text-[9px]">Enter</kbd> para enviar
                  </span>
                </div>
                <span>Verifica cifras importantes con tus documentos SRI</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-brand-gray-500">
          Cargando chat…
        </div>
      }
    >
      <ChatIA />
    </Suspense>
  );
}
