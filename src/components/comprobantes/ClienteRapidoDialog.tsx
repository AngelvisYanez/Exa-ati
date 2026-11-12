"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Dialog from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";
import Campo from "./Campo";
import {
  TIPOS_SIN_CONSUMIDOR_FINAL,
  esNumerica,
  inferirCamposContacto,
  longitudMaxima,
  validarIdentificacion,
} from "./identificacion";
import { advertenciaCampo, boton, chip, control } from "./tokens";
import type { ContactoResumen, FuenteContactos } from "./types";

interface ClienteRapidoDialogProps {
  open: boolean;
  consultaInicial: string;
  fuente: FuenteContactos;
  onCerrar: () => void;
  onCreado: (contacto: ContactoResumen) => void;
}

async function leerError(res: Response, porDefecto: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { message?: string } | null;
  return data?.message || porDefecto;
}

function contactoDesdeApi(data: {
  id: string;
  tipoIdentificacion: string;
  identificacion: string;
  razonSocial: string;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
}): ContactoResumen {
  return {
    id: data.id,
    tipoIdentificacion: data.tipoIdentificacion,
    identificacion: data.identificacion,
    razonSocial: data.razonSocial,
    email: data.email ?? null,
    telefono: data.telefono ?? null,
    direccion: data.direccion ?? null,
  };
}

export default function ClienteRapidoDialog({
  open, consultaInicial, fuente, onCerrar, onCreado,
}: ClienteRapidoDialogProps) {
  const baseId = useId();
  const identificacionRef = useRef<HTMLInputElement>(null);
  const razonRef = useRef<HTMLInputElement>(null);
  const inferido = inferirCamposContacto(consultaInicial);
  const focoInicial = inferido.identificacion ? razonRef : identificacionRef;
  const [tipoId, setTipoId] = useState(inferido.tipoId);
  const [identificacion, setIdentificacion] = useState(inferido.identificacion);
  const [razonSocial, setRazonSocial] = useState(inferido.razonSocial);
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const campos = inferirCamposContacto(consultaInicial);
    setTipoId(campos.tipoId);
    setIdentificacion(campos.identificacion);
    setRazonSocial(campos.razonSocial);
    setEmail("");
    setDireccion("");
    setError(null);
    setGuardando(false);
  }, [open, consultaInicial]);

  const idEstado = validarIdentificacion(tipoId, identificacion);
  const listo = idEstado.valido && Boolean(razonSocial.trim());
  const titulo = fuente === "proveedor" ? "Registrar proveedor" : "Registrar cliente";
  const etiquetaGuardar = fuente === "proveedor" ? "Registrar y usar proveedor" : "Registrar y usar cliente";

  async function guardar(event: FormEvent) {
    event.preventDefault();
    if (!listo || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await apiFetch("/api/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoIdentificacion: tipoId,
          identificacion: identificacion.trim(),
          razonSocial: razonSocial.trim(),
          email: email.trim() || undefined,
          direccion: direccion.trim() || undefined,
          esCliente: fuente === "cliente",
          esProveedor: fuente === "proveedor",
        }),
      });
      if (!res.ok) {
        setError(await leerError(res, "No se pudo registrar el contacto"));
        return;
      }
      const data = (await res.json()) as { data: Parameters<typeof contactoDesdeApi>[0] };
      onCreado(contactoDesdeApi(data.data));
    } catch {
      setError("No se pudo registrar. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onCerrar}
      title={titulo}
      description="Completa lo mínimo para usarlo en esta factura. Quedará guardado para la próxima."
      size="sm"
      initialFocusRef={focoInicial}
      panelClassName="gap-3"
    >
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <div>
          <p id={`${baseId}-tipo`} className="text-[13px] text-brand-gray-700">Tipo de identificación</p>
          <div role="radiogroup" aria-labelledby={`${baseId}-tipo`} className="mt-1 flex flex-wrap gap-2">
            {TIPOS_SIN_CONSUMIDOR_FINAL.map((opcion) => {
              const activo = tipoId === opcion.value;
              return (
                <button
                  key={opcion.value}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => setTipoId(opcion.value)}
                  className={cn(chip.base, activo ? chip.activo : chip.inactivo)}
                >
                  {opcion.label}
                </button>
              );
            })}
          </div>
        </div>
        <Campo
          id={`${baseId}-id`}
          label="Identificación"
          requerido
          hint={idEstado.advertencia ?? idEstado.ayuda}
          hintClass={identificacion ? (idEstado.advertencia ? advertenciaCampo.texto : idEstado.valido ? "text-success" : "text-brand-red") : undefined}
        >
          <Input
            ref={identificacionRef}
            id={`${baseId}-id`}
            value={identificacion}
            onChange={(event) => setIdentificacion(event.target.value)}
            inputMode={esNumerica(tipoId) ? "numeric" : "text"}
            maxLength={longitudMaxima(tipoId)}
            className={cn(
              control,
              "font-mono tabular-nums",
              identificacion && idEstado.valido && (idEstado.advertencia ? advertenciaCampo.borde : "border-success focus-visible:border-success"),
              identificacion && !idEstado.valido && "border-brand-red",
            )}
          />
        </Campo>
        <Campo id={`${baseId}-razon`} label="Razón social / Nombres" requerido>
          <Input
            ref={razonRef}
            id={`${baseId}-razon`}
            value={razonSocial}
            onChange={(event) => setRazonSocial(event.target.value)}
            placeholder="Ej. Comercial Machala S.A."
            className={control}
          />
        </Campo>
        <Campo id={`${baseId}-email`} label="Correo" hint="Le llegará el RIDE y el XML autorizado.">
          <Input
            id={`${baseId}-email`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="correo@empresa.com"
            className={control}
          />
        </Campo>
        <Campo id={`${baseId}-direccion`} label="Dirección">
          <Input
            id={`${baseId}-direccion`}
            value={direccion}
            onChange={(event) => setDireccion(event.target.value)}
            placeholder="Calle, número y ciudad"
            className={control}
          />
        </Campo>
        {error ? <p role="alert" className="text-[13px] text-brand-red">{error}</p> : null}
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCerrar} className={boton.secundario}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!listo || guardando} className="h-9 rounded-lg bg-brand-red px-3 text-white hover:brightness-90">
            {guardando ? "Registrando…" : etiquetaGuardar}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
