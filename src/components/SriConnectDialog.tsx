"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { sriClient } from "@/lib/sriClient";

export default function SriConnectDialog() {
  const { isAuthenticated, hasSriLinked, isLoading, refreshSriStatus } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [ruc, setRuc] = useState("");
  const [sriPassword, setSriPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [forcedOpen, setForcedOpen] = useState(false);
  const [error, setError] = useState("");

  const isUrlForced = searchParams?.get("vincular") === "true";
  const isForced = isUrlForced || forcedOpen;
  const show = isAuthenticated && !isLoading && (isForced || (!hasSriLinked && !dismissed));

  const isLoadingState = submitting || syncing;

  const handleNoEmisor = useCallback(() => {
    setDismissed(false);
    setForcedOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener('sri:no-emisor', handleNoEmisor);
    return () => window.removeEventListener('sri:no-emisor', handleNoEmisor);
  }, [handleNoEmisor]);

  useEffect(() => {
    if (show && hasSriLinked && !ruc) {
      sriClient.getEmisor()
        .then((res) => {
          if (res.success && res.emisor?.ruc) {
            setRuc(res.emisor.ruc);
          }
        })
        .catch(() => {});
    }
  }, [show, hasSriLinked, ruc]);

  const handleClose = () => {
    setDismissed(true);
    setForcedOpen(false);
    if (searchParams?.get("vincular") === "true") {
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.delete("vincular");
      const qs = params.toString() ? `?${params.toString()}` : "";
      router.replace(`${pathname}${qs}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await sriClient.vincularSri(ruc, sriPassword);
      setSyncing(true);
      toast.success(res.message || "RUC vinculado correctamente");
      if (res.sync?.warning) {
        toast.info(res.sync.warning);
      } else if (res.sync?.procesados === 0) {
        toast.info(
          "Vinculado. Emite facturas o importa XML de compras para sincronizar documentos."
        );
      } else if (res.sync) {
        toast.info(
          `Sincronización: ${res.sync.autorizados ?? 0} autorizados de ${res.sync.procesados ?? 0} procesados`
        );
      }
      if (res.sync?.error) {
        toast.error(`Sync: ${res.sync.error}`);
      }
      await refreshSriStatus();
      setRuc("");
      setSriPassword("");
      if (isUrlForced || forcedOpen) {
        setForcedOpen(false);
        const params = new URLSearchParams(searchParams?.toString() || "");
        params.delete("vincular");
        const qs = params.toString() ? `?${params.toString()}` : "";
        router.replace(`${pathname}${qs}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al vincular con el SRI";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setSyncing(false);
    }
  };

  return (
    <Dialog
      open={show}
      title={hasSriLinked ? "Actualizar credenciales SRI" : "Vincular cuenta del SRI"}
      description="Ingresa tu RUC y contraseña del SRI en línea. Los emitidos se sincronizan vía SOAP; las compras se importan con archivos XML."
      size="sm"
      closeOnOverlay={isForced}
      showClose={isForced}
      onClose={handleClose}
    >
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 font-semibold mb-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
            RUC / Cédula del Contribuyente
          </label>
          <Input
            type="text"
            required
            value={ruc}
            onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 13))}
            placeholder="ej. 0704439892001"
            maxLength={13}
            inputMode="numeric"
            disabled={isLoadingState}
            className="font-mono tracking-widest"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
            Contraseña del SRI en línea
          </label>
          <Input
            type="password"
            required
            value={sriPassword}
            onChange={(e) => setSriPassword(e.target.value)}
            placeholder="Contraseña del portal SRI"
            disabled={isLoadingState}
          />
        </div>

        <p className="text-[10px] text-slate-400 leading-relaxed">
          Las credenciales se almacenan cifradas con AES-256. Nunca se guardan en texto plano.
        </p>

        <div className="flex gap-2 mt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoadingState}
            className="flex-1"
          >
            {hasSriLinked ? "Cancelar" : "Configurar después"}
          </Button>
          <Button
            type="submit"
            disabled={isLoadingState}
            className="flex-1"
          >
            {isLoadingState && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {syncing ? "Sincronizando..." : submitting ? "Vinculando..." : hasSriLinked ? "Actualizar y sincronizar" : "Vincular y sincronizar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
