"use client";

import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { sriClient } from "@/lib/sriClient";

export default function SriConnectDialog() {
  const { isAuthenticated, hasSriLinked, isLoading, refreshSriStatus } = useAuth();
  const toast = useToast();
  const [ruc, setRuc] = useState("");
  const [sriPassword, setSriPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState("");

  const show = isAuthenticated && !hasSriLinked && !isLoading && !dismissed;

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
      title="Vincular cuenta del SRI"
      description="Ingresa tu RUC y contraseña del SRI en línea. Los emitidos se sincronizan vía SOAP; las compras se importan con archivos XML."
      size="sm"
      closeOnOverlay={false}
      showClose={false}
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
          <input
            type="text"
            required
            value={ruc}
            onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 13))}
            className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-xs text-brand-gray-800 focus:border-brand-navy outline-none font-mono tracking-widest"
            placeholder="ej. 0704439892001"
            maxLength={13}
            inputMode="numeric"
            disabled={submitting || syncing}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
            Contraseña del SRI en línea
          </label>
          <input
            type="password"
            required
            value={sriPassword}
            onChange={(e) => setSriPassword(e.target.value)}
            className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-xs text-brand-gray-800 focus:border-brand-navy outline-none"
            placeholder="Contraseña del portal SRI"
            disabled={submitting || syncing}
          />
        </div>

        <p className="text-[10px] text-slate-400 leading-relaxed">
          Las credenciales se almacenan cifradas con AES-256. Nunca se guardan en texto plano.
        </p>

        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            disabled={submitting || syncing}
            className="flex-1 bg-brand-gray-100 hover:bg-brand-gray-200 text-brand-gray-700 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
          >
            Configurar después
          </button>
          <button
            type="submit"
            disabled={submitting || syncing}
            className="flex-1 bg-brand-navy hover:bg-brand-navy-light text-white py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
          >
            {syncing ? "Sincronizando..." : submitting ? "Vinculando..." : "Vincular y sincronizar"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
