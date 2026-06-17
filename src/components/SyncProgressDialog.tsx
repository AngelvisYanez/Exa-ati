"use client";

import Dialog from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/badge";

export type SyncResultSummary = {
  procesados?: number;
  actualizados?: number;
  importados?: number;
  xmlsGuardados?: number;
  errores?: number;
  modo?: string;
  warning?: string;
  message?: string;
  detalle?: Array<{
    claveAcceso: string;
    estadoAnterior: string;
    estadoSri: string;
    accion: string;
  }>;
};

type SyncProgressDialogProps = {
  open: boolean;
  onClose: () => void;
  result: SyncResultSummary | null;
  loading?: boolean;
};

export default function SyncProgressDialog({
  open,
  onClose,
  result,
  loading,
}: SyncProgressDialogProps) {
  const errores = result?.detalle?.filter((d) => d.accion.includes('Error') || d.estadoSri === 'ERROR') || [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Sincronización con el SRI"
      description={
        loading
          ? "Consultando estados en el SRI vía SOAP. Si la red con el SRI falla, cada documento puede tardar hasta ~1 min."
          : result?.message || "Resultado de la sincronización"
      }
      size="md"
    >
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="w-8 h-8 border-2 border-brand-navy border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Esto puede tardar según la cantidad de documentos.</p>
        </div>
      ) : result ? (
        <div className="space-y-4">
          {result.warning === 'SRI_UNAVAILABLE' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
              Los servidores del SRI no responden desde tu red. Comprueba internet, VPN o firewall.
              Los comprobantes de prueba en BD no se pueden consultar sin acceso a{" "}
              <strong>celcer.sri.gob.ec</strong> / <strong>cel.sri.gob.ec</strong>.
            </div>
          )}

          {result.warning === 'NO_LOCAL_DOCUMENTS' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              No hay comprobantes locales. <strong>Emite facturas</strong> o <strong>importa XML</strong> de compras primero.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Consultados", value: result.procesados ?? 0 },
              { label: "Actualizados", value: result.actualizados ?? 0 },
              { label: "Importados", value: result.importados ?? 0 },
              { label: "XML guardados", value: result.xmlsGuardados ?? 0 },
            ].map((item) => (
              <div key={item.label} className="bg-muted rounded-lg p-3 text-center">
                <p className="text-lg font-bold">{item.value}</p>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {result.modo && <Badge variant="outline">Modo: {result.modo}</Badge>}
            {(result.errores ?? 0) > 0 && (
              <Badge variant="destructive">{result.errores} errores</Badge>
            )}
          </div>

          {errores.length > 0 && (
            <div className="max-h-32 overflow-y-auto text-xs space-y-1 bg-red-50 border border-red-100 rounded-lg p-2">
              <p className="text-red-800 font-semibold mb-1">
                Fallos de conexión con el SRI. Verifica internet o reintenta más tarde.
              </p>
              {errores.slice(0, 8).map((d) => (
                <p key={d.claveAcceso} className="text-red-700 font-mono">
                  …{d.claveAcceso.slice(-8)}: {d.accion}
                </p>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-brand-navy text-white py-2 rounded-lg text-xs font-bold hover:bg-brand-navy-light transition-colors"
          >
            Cerrar
          </button>
        </div>
      ) : null}
    </Dialog>
  );
}
