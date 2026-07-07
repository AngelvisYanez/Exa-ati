"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Loader2, Building2, Lock, ShieldCheck, KeyRound } from "lucide-react";
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
      size="sm"
      closeOnOverlay={isForced}
      showClose={isForced}
      onClose={handleClose}
    >
      <div className="flex flex-col items-center text-center pb-4 pt-2">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-navy to-brand-navy-light flex items-center justify-center text-white mb-4 shadow-lg shadow-brand-navy/20 relative">
          <Building2 className="w-8 h-8" />
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 rounded-full p-1.5 border-2 border-white shadow-sm">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
        </div>
        <h3 className="text-xl font-black text-brand-gray-800 tracking-tight">
          {hasSriLinked ? "Actualizar SRI" : "Vincular SRI"}
        </h3>
        <p className="text-[12.5px] text-brand-gray-500 mt-2 font-medium max-w-[280px]">
          Conecta tu portal del SRI para sincronizar facturas y retenciones de forma automática y segura.
        </p>
      </div>

      {error && (
        <div className="bg-red-50/80 border border-red-200 rounded-xl p-3 text-[12.5px] text-red-700 font-bold mb-4 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold text-brand-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-brand-gray-400" />
            RUC / Cédula
          </label>
          <div className="relative">
            <Input
              type="text"
              required
              value={ruc}
              onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 13))}
              placeholder="ej. 0704439892001"
              maxLength={13}
              inputMode="numeric"
              disabled={isLoadingState}
              className="font-mono tracking-[0.1em] text-sm h-11 pl-4 rounded-xl border-brand-gray-200 bg-brand-gray-50/50 focus:bg-white transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold text-brand-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-brand-gray-400" />
            Contraseña SRI en línea
          </label>
          <div className="relative">
            <Input
              type="password"
              required
              value={sriPassword}
              onChange={(e) => setSriPassword(e.target.value)}
              placeholder="Contraseña del SRI"
              disabled={isLoadingState}
              className="text-sm h-11 pl-4 rounded-xl border-brand-gray-200 bg-brand-gray-50/50 focus:bg-white transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex gap-2 items-start mt-2">
          <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[10.5px] text-slate-500 font-medium leading-relaxed">
            Tus credenciales están protegidas y cifradas de extremo a extremo con el estándar militar <strong className="text-slate-700">AES-256</strong>. No se almacenan en texto plano.
          </p>
        </div>

        <div className="flex gap-2.5 mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoadingState}
            className="flex-1 h-11 rounded-xl text-xs font-bold border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-50"
          >
            {hasSriLinked ? "Cancelar" : "Configurar después"}
          </Button>
          <Button
            type="submit"
            disabled={isLoadingState}
            className="flex-1 h-11 rounded-xl text-xs font-bold bg-brand-navy hover:bg-brand-navy-light shadow-md shadow-brand-navy/20 transition-all"
          >
            {isLoadingState ? (
              <span className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {syncing ? "Sincronizando..." : "Vinculando..."}
              </span>
            ) : (
              hasSriLinked ? "Actualizar" : "Vincular y Sincronizar"
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
