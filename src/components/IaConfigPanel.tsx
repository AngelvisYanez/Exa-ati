"use client";

import { useEffect, useState } from "react";
import { sriClient } from "@/lib/sriClient";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bot, Sparkles } from "lucide-react";

const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-pro",
  "gemini-3.1-pro",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
];
const CLAUDE_MODELS = [
  "claude-fable-5",
  "claude-opus-4.8",
  "claude-opus-4.7",
  "claude-sonnet-4.6",
  "claude-3-7-sonnet-20250219",
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
      .catch(() => {})
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
      toast.success(res.message || "Configuración guardada");
      setGeminiKey("");
      setClaudeKey("");
      setConfigured(res.configured);
      setMaskedKeys(res.maskedKeys);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
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
    return <p className="text-sm text-muted-foreground">Cargando configuración IA...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-brand-navy" />
        <Badge variant={isActive ? "default" : "secondary"}>
          {isActive ? "Chat activo" : "Falta configurar"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Proveedor de IA
          </CardTitle>
          <CardDescription>
            Configura Gemini o Claude para el asistente tributario. Las keys se guardan cifradas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {(["gemini", "claude"] as const).map((p) => (
              <Button
                key={p}
                type="button"
                variant={provider === p ? "default" : "outline"}
                size="sm"
                onClick={() => setProvider(p)}
              >
                {p === "gemini" ? "Google Gemini" : "Anthropic Claude"}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Modelo</Label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">Predeterminado</option>
              {(provider === "gemini" ? GEMINI_MODELS : CLAUDE_MODELS).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {provider === "gemini" && (
            <div className="space-y-2">
              <Label>API Key de Gemini</Label>
              <Input
                type="password"
                placeholder={maskedKeys.gemini ? `Configurada: ${maskedKeys.gemini}` : "AIza..."}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
            </div>
          )}

          {provider === "claude" && (
            <div className="space-y-2">
              <Label>API Key de Claude</Label>
              <Input
                type="password"
                placeholder={maskedKeys.claude ? `Configurada: ${maskedKeys.claude}` : "sk-ant-..."}
                value={claudeKey}
                onChange={(e) => setClaudeKey(e.target.value)}
              />
            </div>
          )}

          <Alert>
            <AlertDescription className="text-xs">
              También puedes usar variables de entorno globales (GEMINI_API_KEY / ANTHROPIC_API_KEY)
              como respaldo si no configuras keys por tenant.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar configuración"}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? "Probando..." : "Probar conexión"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
