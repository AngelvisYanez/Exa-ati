"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import { apiFetch } from "@/lib/apiFetch";
import { posFont } from "../_lib/pos-font";
import {
  CLIENTE_VACIO,
  camposFaltantes,
  enterEnCampo,
  validarEmail,
  validarIdentificacion,
  type ClienteDatos,
} from "../_lib/pos-calc";

type Busqueda = "idle" | "buscando" | "encontrado" | "nuevo" | "error";

interface ContactoApi {
  identificacion: string;
  razonSocial?: string | null;
  email?: string | null;
  direccion?: string | null;
  telefono?: string | null;
}

export default function ClienteDialog({ open, inicial, onCerrar, onGuardar, onConsumidorFinal }: {
  open: boolean;
  inicial: ClienteDatos | null;
  /** Cierre sin guardar (Esc, ✕): conserva lo escrito aunque esté incompleto. */
  onCerrar: (borrador: ClienteDatos) => void;
  onGuardar: (cliente: ClienteDatos, esNuevo: boolean) => void;
  onConsumidorFinal: () => void;
}) {
  const borradorRef = useRef<ClienteDatos>(CLIENTE_VACIO);
  const idRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open={open}
      onClose={() => onCerrar(borradorRef.current)}
      title="Datos del cliente"
      description="La factura se emite a nombre de este cliente."
      size="lg"
      panelClassName={posFont.className}
      initialFocusRef={idRef}
    >
      {open && (
        <Formulario
          inicial={inicial ?? CLIENTE_VACIO}
          borradorRef={borradorRef}
          idRef={idRef}
          onGuardar={onGuardar}
          onConsumidorFinal={onConsumidorFinal}
        />
      )}
    </Dialog>
  );
}

function Formulario({ inicial, borradorRef, idRef, onGuardar, onConsumidorFinal }: {
  inicial: ClienteDatos;
  /** El Dialog lo lee al cerrar con Esc/✕. */
  borradorRef: React.RefObject<ClienteDatos>;
  idRef: React.RefObject<HTMLInputElement | null>;
  onGuardar: (cliente: ClienteDatos, esNuevo: boolean) => void;
  onConsumidorFinal: () => void;
}) {
  const uid = useId();
  const [c, setC] = useState<ClienteDatos>(inicial);
  const [tocados, setTocados] = useState<Partial<Record<keyof ClienteDatos, boolean>>>({});
  const [busqueda, setBusqueda] = useState<Busqueda>("idle");
  const ultimaBuscada = useRef(inicial.identificacion.trim());

  useEffect(() => {
    borradorRef.current = c;
  }, [c, borradorRef]);

  const identificacion = c.identificacion.trim();
  const idValida = validarIdentificacion(identificacion) === null;

  useEffect(() => {
    if (!idValida || identificacion === ultimaBuscada.current) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      ultimaBuscada.current = identificacion;
      setBusqueda("buscando");
      try {
        const res = await apiFetch(
          `/api/contactos?tipo=cliente&activo=true&search=${encodeURIComponent(identificacion)}`,
          { signal: ctrl.signal },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message);
        const hit = (data.data as ContactoApi[] | undefined)?.find((x) => x.identificacion === identificacion);
        if (hit) {
          setC((prev) => ({
            identificacion: prev.identificacion,
            razonSocial: hit.razonSocial || prev.razonSocial,
            email: hit.email || prev.email,
            direccion: hit.direccion || prev.direccion,
            telefono: hit.telefono || prev.telefono,
          }));
          setBusqueda("encontrado");
        } else {
          setBusqueda("nuevo");
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setBusqueda("error");
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [identificacion, idValida]);

  const errores: Partial<Record<keyof ClienteDatos, string | null>> = {
    identificacion: validarIdentificacion(c.identificacion),
    razonSocial: c.razonSocial.trim() ? null : "Ingresa el nombre o razón social",
    email: validarEmail(c.email),
    direccion: c.direccion.trim() ? null : "Ingresa la dirección",
  };
  const completo = camposFaltantes(c).length === 0;

  function set<K extends keyof ClienteDatos>(k: K, v: ClienteDatos[K]) {
    setC((prev) => ({ ...prev, [k]: v }));
    if (k === "identificacion") setBusqueda("idle");
  }

  function guardar() {
    if (!completo) {
      setTocados({ identificacion: true, razonSocial: true, email: true, direccion: true });
      return;
    }
    onGuardar(c, busqueda === "nuevo");
  }

  const campo = (
    k: keyof ClienteDatos,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> },
    nota?: React.ReactNode,
  ) => {
    const err = errores[k];
    const opcional = !(k in errores);
    const mostrar = tocados[k] || c[k].trim().length > 0;
    const estado = opcional || !mostrar ? "neutro" : err ? "error" : "ok";
    const inputId = `${uid}-${k}`;
    const msgId = `${inputId}-msg`;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-semibold text-pos-ink">
          {label}
          {opcional ? <span className="font-normal text-pos-muted"> (opcional)</span> : <span aria-hidden className="text-pos-brand"> *</span>}
        </label>
        <div className="relative">
          <input
            id={inputId}
            value={c[k]}
            onChange={(e) => set(k, e.target.value)}
            onBlur={() => setTocados((t) => ({ ...t, [k]: true }))}
            aria-invalid={estado === "error"}
            aria-required={!opcional}
            aria-describedby={msgId}
            className={`h-12 w-full rounded-xl border bg-white px-3.5 text-base text-pos-ink outline-none transition-colors focus-visible:ring-3 ${
              estado === "error"
                ? "border-red-500 focus-visible:ring-red-500/15"
                : estado === "ok"
                  ? "border-pos-ok pr-10 focus-visible:ring-pos-ok/15"
                  : "border-pos-line-strong focus-visible:border-pos-brand focus-visible:ring-pos-brand/15"
            }`}
            {...props}
          />
          {estado === "ok" && <Check aria-hidden className="absolute right-3 top-1/2 size-5 -translate-y-1/2 text-pos-ok" />}
        </div>
        <p id={msgId} className={`min-h-4 text-xs ${estado === "error" ? "text-red-600" : "text-pos-muted"}`}>
          {estado === "error" ? err : nota}
        </p>
      </div>
    );
  };

  const notaBusqueda =
    busqueda === "buscando" ? (
      <span className="inline-flex items-center gap-1"><LoaderCircle aria-hidden className="size-3 animate-spin" /> Buscando cliente…</span>
    ) : busqueda === "encontrado" ? (
      <span className="text-pos-ok">Cliente encontrado: datos completados</span>
    ) : busqueda === "nuevo" ? (
      "Cliente nuevo: se guardará en tus contactos"
    ) : busqueda === "error" ? (
      "No se pudo buscar el cliente; ingresa los datos"
    ) : (
      "10 dígitos (cédula) o 13 terminado en 001 (RUC)"
    );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
      onKeyDown={(e) => enterEnCampo(e, guardar)}
      className="flex flex-col gap-4"
    >
      <div aria-live="polite" className="sr-only">
        {busqueda === "encontrado" ? "Cliente encontrado, datos completados" : busqueda === "nuevo" ? "Cliente nuevo" : ""}
      </div>
      <div className="grid max-h-[62dvh] grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto pr-1 sm:grid-cols-2">
        {campo("identificacion", "Cédula/RUC", { ref: idRef, inputMode: "numeric", maxLength: 13, autoComplete: "off" }, notaBusqueda)}
        {campo("razonSocial", "Nombre/Razón social", { autoComplete: "name" })}
        {campo("email", "Email", { type: "email", inputMode: "email", autoComplete: "email" }, "Aquí llega la factura")}
        {campo("telefono", "Teléfono", { type: "tel", inputMode: "tel", autoComplete: "tel" })}
        <div className="sm:col-span-2">
          {campo("direccion", "Dirección", { autoComplete: "street-address" })}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onConsumidorFinal}
          className="h-12 rounded-xl border border-pos-line-strong bg-white px-4 text-sm font-semibold text-pos-ink hover:bg-pos-panel"
        >
          Usar consumidor final
        </button>
        <button
          type="submit"
          disabled={!completo}
          className="h-12 rounded-xl bg-pos-brand px-5 text-sm font-bold text-white hover:bg-pos-brand-hover disabled:cursor-not-allowed disabled:bg-pos-line-strong disabled:text-pos-muted"
        >
          Guardar y volver a la venta
        </button>
      </div>
    </form>
  );
}
