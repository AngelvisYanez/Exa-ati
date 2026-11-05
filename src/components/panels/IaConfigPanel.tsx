"use client";

import { useEffect, useState } from "react";
import { sriClient } from "@/lib/sriClient";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, Check, Key, ShieldCheck, Loader2 } from "lucide-react";

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

const CLAUDE_MODELS = [
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
];

export default function IaConfigPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [provider, setProvider] = useState<"gemini" | "claude">("gemini");
  const [model, setModel] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [claudeKey, setClaudeKey] = useState("");
  const [configured, setConfigured] = useState({ gemini: false, claude: false });
  const [maskedKeys, setMaskedKeys] = useState<{ gemini: string | null; claude: string | null }>({
    gemini: null,
    claude: null,
  });

  useEffect(() => {
    sriClient
      .getIaConfig()
      .then((res) => {
        if (res.success) {
          setProvider(res.provider || "gemini");
          setModel(res.model || "");
          setConfigured(res.configured || { gemini: false, claude: false });
          setMaskedKeys(res.maskedKeys || { gemini: null, claude: null });
        }
      })
      .catch(() => toast.error("Error al cargar configuración de IA"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await sriClient.updateIaConfig({
        provider,
        model: model || undefined,
        geminiApiKey: geminiKey || undefined,
        claudeApiKey: claudeKey || undefined,
      });
      toast.success(res.message || "Configuración guardada correctamente");
      setGeminiKey("");
      setClaudeKey("");
      setConfigured(res.configured);
      setMaskedKeys(res.maskedKeys);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await sriClient.testIaConnection({
        provider,
        model: model || undefined,
        apiKey: provider === "gemini" ? geminiKey : claudeKey,
      });
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setTesting(false);
    }
  };

  const isActive =
    (provider === "gemini" && configured.gemini) ||
    (provider === "claude" && configured.claude);

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-brand-gray-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-brand-red" />
        <span>Cargando configuración de Inteligencia IA...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-brand-gray-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-red animate-pulse" />
          <h3 className="text-sm font-bold text-brand-gray-800">Motor de Inteligencia Artificial</h3>
        </div>
        <Badge
          variant={isActive ? "default" : "secondary"}
          className={isActive ? "bg-success-pale text-success hover:bg-success-pale font-semibold" : ""}
        >
          {isActive ? "✓ Asistente Activo" : "Requiere API Key"}
        </Badge>
      </div>

      <Card className="border-brand-gray-200 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-brand-gray-800">
            <Bot className="w-4 h-4 text-brand-red" />
            Proveedor y Modelo IA
          </CardTitle>
          <CardDescription className="text-xs text-brand-gray-500">
            Selecciona el modelo que procesará las consultas tributarias y ejecutará acciones contables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProvider("gemini")}
              className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                provider === "gemini"
                  ? "border-brand-red bg-brand-red-subtle/60 shadow-2xs font-semibold"
                  : "border-brand-gray-200 bg-white hover:bg-brand-gray-50"
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-brand-sky flex items-center justify-center font-bold text-xs shrink-0">
                G
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-brand-gray-800 flex items-center justify-between">
                  <span>Google Gemini</span>
                  {configured.gemini && <Check className="w-3.5 h-3.5 text-success" />}
                </div>
                <p className="text-[11px] text-brand-gray-500 font-normal mt-0.5">
                  Rápido y optimizado para consultas y emisión de facturas.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setProvider("claude")}
              className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                provider === "claude"
                  ? "border-brand-red bg-brand-red-subtle/60 shadow-2xs font-semibold"
                  : "border-brand-gray-200 bg-white hover:bg-brand-gray-50"
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                C
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-brand-gray-800 flex items-center justify-between">
                  <span>Anthropic Claude</span>
                  {configured.claude && <Check className="w-3.5 h-3.5 text-success" />}
                </div>
                <p className="text-[11px] text-brand-gray-500 font-normal mt-0.5">
                  Alta precisión analítica para proyecciones y auditorías.
                </p>
              </div>
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-brand-gray-700">Modelo específico</Label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full border border-brand-gray-200 rounded-xl px-3 py-2 text-xs bg-white text-brand-gray-800 outline-none focus:border-brand-red cursor-pointer"
            >
              <option value="">Predeterminado ({provider === "gemini" ? "gemini-2.5-flash" : "claude-3-7-sonnet"})</option>
              {(provider === "gemini" ? GEMINI_MODELS : CLAUDE_MODELS).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Key inputs */}
          <div className="space-y-3 pt-2 border-t border-brand-gray-100">
            {provider === "gemini" ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-brand-gray-700 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-brand-gray-400" />
                    Gemini API Key
                  </Label>
                  {maskedKeys.gemini && (
                    <span className="text-[11px] text-success font-mono font-medium">
                      Guardada: {maskedKeys.gemini}
                    </span>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder={configured.gemini ? "Ingresa una nueva API Key para reemplazar" : "AIzaSy..."}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="bg-white text-xs"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-brand-gray-700 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-brand-gray-400" />
                    Claude API Key (Anthropic)
                  </Label>
                  {maskedKeys.claude && (
                    <span className="text-[11px] text-success font-mono font-medium">
                      Guardada: {maskedKeys.claude}
                    </span>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder={configured.claude ? "Ingresa una nueva API Key para reemplazar" : "sk-ant-..."}
                  value={claudeKey}
                  onChange={(e) => setClaudeKey(e.target.value)}
                  className="bg-white text-xs"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2.5 pt-3">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-red hover:bg-brand-red-mid text-white text-xs font-semibold px-4 py-2 rounded-xl"
            >
              {saving ? "Guardando..." : "Guardar Configuración"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing}
              className="text-xs font-semibold rounded-xl"
            >
              {testing ? "Probando..." : "Probar Conexión"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="p-3 bg-sky-50/60 border border-sky-200/60 rounded-xl text-xs text-brand-sky flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-brand-sky shrink-0" />
        <span>Tus credenciales de IA se almacenan de forma segura y encriptada en la base de datos de tu oficina tributaria.</span>
      </div>
    </div>
  );
}
