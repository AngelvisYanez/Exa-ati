"use client";

import { useState, useEffect, useId, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Search,
  FileText,
  BookOpen,
  Receipt,
  ShieldCheck,
  Library,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  XCircle,
  HelpCircle,
  Sparkles,
  Scale,
  Users,
  Package,
  UserCircle,
  HandCoins,
  Wallet,
  Boxes,
  ChevronDown,
  X,
} from "lucide-react";
import { sriClient } from "@/lib/sriClient";

type Resultado = {
  id: number;
  tipo: string;
  contenido: string;
  referenciaId: number | null;
  score: number;
};

type OllamaStatus = {
  available: boolean;
  enabled: boolean;
  provider: string;
  url: string;
  model: string;
  chatModel?: string;
  version?: string;
  message: string;
};

const SUGGESTIONS = [
  "¿Qué productos tengo y con qué stock?",
  "¿Quiénes son mis clientes y proveedores?",
  "¿Qué asientos contables hay registrados?",
  "¿Qué empleados tengo activos?",
  "Resumen de mis comprobantes recientes",
] as const;

const tipoConfig: Record<
  string,
  { label: string; icon: typeof FileText; color: string }
> = {
  plan_cuenta: {
    label: "Plan de Cuenta",
    icon: BookOpen,
    color: "bg-sky-50 text-brand-sky border-sky-200",
  },
  impuesto: {
    label: "Impuesto",
    icon: Receipt,
    color: "bg-success-pale text-success border-success-light/40",
  },
  posicion_fiscal: {
    label: "Posición Fiscal",
    icon: ShieldCheck,
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  tipo_documento: {
    label: "Tipo Documento",
    icon: FileText,
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  tipo_sustento: {
    label: "Tipo Sustento",
    icon: Library,
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  comprobante: {
    label: "Comprobante",
    icon: FileText,
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },
  asiento: {
    label: "Asiento",
    icon: Scale,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  contacto: {
    label: "Contacto",
    icon: Users,
    color: "bg-sky-50 text-sky-700 border-sky-200",
  },
  producto: {
    label: "Producto",
    icon: Package,
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  empleado: {
    label: "Empleado",
    icon: UserCircle,
    color: "bg-teal-50 text-teal-700 border-teal-200",
  },
  cuenta_cobrar: {
    label: "CxC",
    icon: HandCoins,
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  cuenta_pagar: {
    label: "CxP",
    icon: Wallet,
    color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  },
  inventario_movimiento: {
    label: "Inventario",
    icon: Boxes,
    color: "bg-lime-50 text-lime-700 border-lime-200",
  },
};

function getTipoConfig(tipo: string) {
  return (
    tipoConfig[tipo] || {
      label: tipo,
      icon: FileText,
      color: "bg-gray-50 text-gray-700 border-gray-200",
    }
  );
}

function scoreColor(score: number): string {
  if (score >= 0.8) return "bg-green-100 text-green-800";
  if (score >= 0.65) return "bg-sky-100 text-brand-sky";
  if (score >= 0.5) return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-600";
}

function SourceCard({ result }: { result: Resultado }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getTipoConfig(result.tipo);
  const Icon = cfg.icon;
  const pct = Math.round(result.score * 100);
  const long = result.contenido.length > 220;

  return (
    <div className="rounded-lg border border-brand-gray-200 bg-white p-3.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 shrink-0 rounded-lg border flex items-center justify-center ${cfg.color}`}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden />
          </div>
          <Badge variant="outline" className="text-[11px] font-semibold shrink-0">
            {cfg.label}
          </Badge>
          {result.referenciaId != null && (
            <span className="text-[11px] text-brand-gray-500 font-mono truncate">
              #{result.referenciaId}
            </span>
          )}
        </div>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${scoreColor(result.score)}`}
          title="Relevancia"
        >
          {pct}%
        </span>
      </div>
      <p
        className={`text-sm text-brand-gray-700 leading-relaxed whitespace-pre-wrap ${
          !expanded && long ? "line-clamp-3" : ""
        }`}
      >
        {result.contenido}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs font-semibold text-brand-sky hover:underline"
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      )}
    </div>
  );
}

export default function ConsultaRAGPage() {
  const queryId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Resultado[] | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<string | null>(null);
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const loadStatus = async () => {
    if (!sriClient.isAuthenticated()) {
      setCheckingStatus(false);
      return;
    }
    setCheckingStatus(true);
    try {
      const res = await sriClient.request("/contabilidad/embeddings/status");
      setStatus(res);
    } catch {
      setStatus(null);
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    if (overrideQuery != null) setQuery(overrideQuery);

    setLoading(true);
    setError(null);
    setResults(null);
    setAnswer(null);
    setSourcesOpen(false);

    try {
      const res = await sriClient.request("/contabilidad/embeddings/query", {
        method: "POST",
        body: JSON.stringify({ query: q, threshold: 0.5, topK: 8, generate: true }),
      });
      setResults(res.data || []);
      setAnswer(typeof res.answer === "string" ? res.answer : null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al realizar la consulta";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setReindexResult(null);

    try {
      const res = await sriClient.request("/contabilidad/embeddings/reindex", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const indexed =
        typeof res.indexed === "number"
          ? res.indexed
          : typeof res.types === "object" && res.types
            ? Object.values(res.types as Record<string, number>).reduce(
                (a, b) => a + Number(b || 0),
                0
              )
            : "?";
      setReindexResult(`Listo: ${indexed} registros indexados. Ya puedes consultar.`);
      await loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al reindexar";
      setReindexResult(`Error: ${msg}`);
    } finally {
      setReindexing(false);
    }
  };

  const canQuery = Boolean(status?.available) && !loading && !reindexing;

  return (
    <>
      <title>Consulta RAG - OFSERCONT IA</title>
      <Topbar title="Consulta Inteligente RAG" />
      <main className="ui-page flex-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            title="Consulta RAG"
            description="Pregunta en lenguaje natural sobre contabilidad, documentos, contactos, inventario, nómina y CxC/CxP"
          />
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!checkingStatus && status && (
              <div
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border ${
                  status.available
                    ? "bg-green-50 text-green-800 border-green-200"
                    : status.enabled
                      ? "bg-brand-red-subtle text-brand-red border-brand-red-pale"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {status.available ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                    {status.provider === "ollama" ? "Ollama" : "LM Studio"} conectado
                  </>
                ) : status.enabled ? (
                  <>
                    <XCircle className="w-3.5 h-3.5" aria-hidden />
                    Desconectado
                  </>
                ) : (
                  <>
                    <HelpCircle className="w-3.5 h-3.5" aria-hidden />
                    No configurado
                  </>
                )}
              </div>
            )}
            {checkingStatus && (
              <span className="text-xs text-brand-gray-500 px-2">Comprobando…</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReindex}
              disabled={reindexing || !status?.available}
              className="gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${reindexing ? "animate-spin" : ""}`} aria-hidden />
              {reindexing ? "Reindexando…" : "Reindexar"}
            </Button>
          </div>
        </div>

        {!checkingStatus && status && !status.available && status.enabled && (
          <div
            role="alert"
            className="bg-brand-red-subtle border border-brand-red-pale rounded-lg px-4 py-3 text-sm text-brand-red flex items-start gap-2"
          >
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Servicio de búsqueda no disponible</p>
              <p className="mt-1 text-brand-red/90">
                No hay conexión con <strong>{status.url}</strong>. Inicia Ollama (
                <code className="bg-red-100 px-1 rounded font-mono text-xs">ollama serve</code>
                ) y vuelve a intentar.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5 border-brand-red-pale text-brand-red hover:bg-white"
                onClick={() => void loadStatus()}
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden />
                Reintentar conexión
              </Button>
            </div>
          </div>
        )}

        {!checkingStatus && status && !status.enabled && (
          <div
            role="status"
            className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900 flex items-start gap-2"
          >
            <HelpCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Módulo RAG no configurado</p>
              <p className="mt-1">
                Activa{" "}
                <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">
                  OLLAMA_ENABLED=true
                </code>{" "}
                en <code className="font-mono text-xs">.env</code> y reinicia el servidor.
              </p>
            </div>
          </div>
        )}

        {reindexResult && (
          <div
            role="status"
            className={`rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${
              reindexResult.startsWith("Error")
                ? "bg-brand-red-subtle border border-brand-red-pale text-brand-red"
                : "bg-sky-50 border border-sky-200 text-brand-sky"
            }`}
          >
            {reindexResult.startsWith("Error") ? (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            ) : (
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            )}
            <span className="flex-1">{reindexResult}</span>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setReindexResult(null)}
              className="shrink-0 p-0.5 rounded hover:bg-black/5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <section aria-labelledby={queryId} className="rounded-xl border border-brand-gray-200 bg-white p-4 sm:p-5">
          <h2
            id={queryId}
            className="text-sm font-bold text-brand-gray-800 flex items-center gap-2 mb-3"
          >
            <Search className="w-4 h-4" aria-hidden />
            ¿Qué deseas consultar?
          </h2>

          <label htmlFor={`${queryId}-input`} className="sr-only">
            Pregunta en lenguaje natural
          </label>
          <textarea
            ref={textareaRef}
            id={`${queryId}-input`}
            className="w-full min-h-[96px] border border-brand-gray-200 rounded-lg p-3 text-sm text-brand-gray-800 font-sans resize-y focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red-bright disabled:opacity-60"
            placeholder="Escribe tu pregunta…"
            value={query}
            disabled={!status?.available || loading}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSearch();
              }
            }}
          />

          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Ejemplos de consulta">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!canQuery}
                onClick={() => {
                  setQuery(s);
                  void handleSearch(s);
                }}
                className="text-left text-xs px-2.5 py-1.5 rounded-full border border-brand-gray-200 text-brand-gray-700 hover:border-brand-red-pale hover:bg-brand-red-subtle/40 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => void handleSearch()}
              disabled={!canQuery || !query.trim()}
              className="gap-1.5"
            >
              {loading ? (
                <>
                  <div
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    aria-hidden
                  />
                  Consultando…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" aria-hidden />
                  Consultar
                </>
              )}
            </Button>
            {query && !loading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  textareaRef.current?.focus();
                }}
              >
                Limpiar
              </Button>
            )}
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="bg-brand-red-subtle border border-brand-red-pale rounded-lg px-4 py-3 text-sm text-brand-red flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
            <div className="rounded-xl border border-brand-gray-200 bg-white p-4">
              <div className="h-4 w-28 bg-brand-gray-200 rounded mb-3 animate-pulse" />
              <div className="h-4 w-full bg-brand-gray-200 rounded mb-2 animate-pulse" />
              <div className="h-4 w-5/6 bg-brand-gray-200 rounded mb-2 animate-pulse" />
              <div className="h-4 w-2/3 bg-brand-gray-200 rounded animate-pulse" />
            </div>
          </div>
        )}

        {answer && !loading && (
          <section
            aria-label="Respuesta"
            className="rounded-xl border border-brand-gray-200 bg-white p-4 sm:p-5 animate-in fade-in duration-200"
          >
            <h2 className="text-sm font-bold text-brand-gray-800 flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-brand-red" aria-hidden />
              Respuesta
            </h2>
            <div
              className="prose prose-sm max-w-none text-brand-gray-800 break-words [overflow-wrap:anywhere]
                prose-p:my-2 prose-p:leading-relaxed prose-p:text-brand-gray-800
                prose-headings:text-brand-gray-900 prose-headings:font-semibold prose-headings:tracking-tight prose-headings:mt-4 prose-headings:mb-1.5 first:prose-headings:mt-0
                prose-strong:font-semibold prose-strong:text-brand-gray-950
                prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5
                prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-5
                prose-li:my-1 prose-li:leading-relaxed prose-li:marker:text-brand-gray-400
                prose-code:rounded prose-code:bg-brand-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[11px] prose-code:font-mono prose-code:text-brand-gray-900 prose-code:before:content-none prose-code:after:content-none"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
            </div>
          </section>
        )}

        {results !== null && !loading && (
          <div>
            {results.length === 0 ? (
              <EmptyState
                icon={<Search className="w-5 h-5" />}
                title="Sin fuentes con suficiente relevancia"
                description="Prueba reformular la pregunta o reindexar los datos."
                compact
              />
            ) : (
              <details
                className="rounded-xl border border-brand-gray-200 bg-brand-gray-50/60 open:bg-white"
                open={sourcesOpen}
                onToggle={(e) => setSourcesOpen((e.target as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-2 text-sm select-none">
                  <span className="font-semibold text-brand-gray-800">
                    {results.length} fuente{results.length !== 1 ? "s" : ""} recuperada
                    {results.length !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-brand-gray-500">
                    Relevancia ≥ 50%
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${sourcesOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </span>
                </summary>
                <div className="px-4 pb-4 flex flex-col gap-2.5 border-t border-brand-gray-100 pt-3">
                  {results.map((r) => (
                    <SourceCard key={r.id} result={r} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </main>
    </>
  );
}
