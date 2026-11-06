"use client";

import { useId, useState, type ReactNode } from "react";
import { Search, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Campo from "./Campo";
import ChipGroup from "./ChipGroup";
import SeccionCard from "./SeccionCard";
import { esNumerica, longitudMaxima, type EstadoIdentificacion, type TipoIdentificacion } from "./identificacion";
import { advertenciaCampo, control } from "./tokens";
import type { ContactoResumen } from "./types";

export type FuenteContactos = "cliente" | "proveedor";

const TEXTOS_FUENTE: Record<FuenteContactos, { buscar: string; lista: string; vacio: string }> = {
  cliente: { buscar: "Buscar cliente registrado", lista: "Clientes encontrados", vacio: "Ningún cliente coincide." },
  proveedor: { buscar: "Buscar proveedor registrado", lista: "Proveedores encontrados", vacio: "Ningún proveedor coincide." },
};

interface IdentificacionSectionProps {
  n: number;
  /** "¿A quién le facturas?", "¿A quién le compras?", "¿A quién le retienes?"… */
  titulo: string;
  ayuda: string;
  completa: boolean;
  /** Indica si se buscan clientes o proveedores; los contactos ya vienen filtrados. */
  fuente: FuenteContactos;
  contactos: ContactoResumen[];
  onSeleccionarContacto: (identificacion: string) => void;
  tiposPermitidos: readonly TipoIdentificacion[];
  tipoId: string;
  onTipoId: (value: string) => void;
  validar: (tipo: string, numero: string) => EstadoIdentificacion;
  identificacion: string;
  onIdentificacion: (value: string) => void;
  razonSocial: string;
  onRazonSocial: (value: string) => void;
  email: string;
  onEmail: (value: string) => void;
  /** Sin handler no se muestra el campo dirección. */
  direccion?: string;
  onDireccion?: (value: string) => void;
  /** Casilla para guardar al sujeto en contactos; solo aparece si aún no existe. */
  guardar?: { label: string; checked: boolean; onChange: (value: boolean) => void };
  /** Reemplaza los campos de identificación (p. ej. el aviso de consumidor final). */
  sustituto?: ReactNode;
}

export default function IdentificacionSection({
  n, titulo, ayuda, completa, fuente, contactos, onSeleccionarContacto,
  tiposPermitidos, tipoId, onTipoId, validar, identificacion, onIdentificacion,
  razonSocial, onRazonSocial, email, onEmail, direccion, onDireccion, guardar, sustituto,
}: IdentificacionSectionProps) {
  const baseId = useId();
  const textos = TEXTOS_FUENTE[fuente];
  const [busqueda, setBusqueda] = useState("");
  const consulta = busqueda.trim().toLowerCase();
  const coincidencias = consulta
    ? contactos.filter((item) => `${item.identificacion} ${item.razonSocial}`.toLowerCase().includes(consulta)).slice(0, 8)
    : [];
  const idEstado = validar(tipoId, identificacion);
  const contactoYaExiste = contactos.some((item) => item.identificacion === identificacion.trim());

  return (
    <SeccionCard n={n} titulo={titulo} ayuda={ayuda} completa={completa}>
      <Campo id={`${baseId}-buscar`} label={textos.buscar}>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-gray-400" aria-hidden />
          <Input
            id={`${baseId}-buscar`}
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Nombre, RUC o cédula..."
            autoComplete="off"
            className={cn(control, "pl-9")}
          />
        </div>
      </Campo>
      {consulta && (
        <ul className="mt-2 overflow-hidden rounded-[10px] border border-brand-gray-200 bg-white" aria-label={textos.lista}>
          {coincidencias.length === 0 ? (
            <li className="px-3 py-2 text-sm text-brand-gray-500">{textos.vacio}</li>
          ) : coincidencias.map((contacto) => (
            <li key={contacto.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-brand-gray-50 focus-visible:bg-brand-red-subtle focus-visible:outline-none"
                onClick={() => {
                  onSeleccionarContacto(contacto.identificacion);
                  setBusqueda(`${contacto.identificacion} — ${contacto.razonSocial}`);
                }}
              >
                <UserRound className="size-4 shrink-0 text-brand-gray-400" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-brand-gray-900">{contacto.razonSocial}</span>
                  <span className="font-mono text-xs text-brand-gray-500">{contacto.identificacion}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="my-4 flex items-center gap-3 text-[11px] font-semibold tracking-wide text-brand-gray-400 uppercase">
        <span className="h-px flex-1 bg-brand-gray-200" aria-hidden />
        o ingresa los datos
        <span className="h-px flex-1 bg-brand-gray-200" aria-hidden />
      </div>

      <ChipGroup ariaLabel="Tipo de identificación" opciones={tiposPermitidos} valor={tipoId} onChange={onTipoId} />

      {sustituto ?? (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Campo
            id={`${baseId}-id`}
            label="Identificación"
            requerido
            hint={idEstado.advertencia ?? idEstado.ayuda}
            hintClass={identificacion ? (idEstado.advertencia ? advertenciaCampo.texto : idEstado.valido ? "text-success" : "text-brand-red") : undefined}
          >
            <div className="relative">
              <Input
                id={`${baseId}-id`}
                required
                value={identificacion}
                onChange={(event) => onIdentificacion(event.target.value)}
                aria-invalid={Boolean(identificacion) && !idEstado.valido}
                aria-describedby={`${baseId}-id-hint`}
                inputMode={esNumerica(tipoId) ? "numeric" : "text"}
                maxLength={longitudMaxima(tipoId)}
                className={cn(
                  control,
                  "pr-14 font-mono tabular-nums",
                  identificacion && idEstado.valido && (idEstado.advertencia ? advertenciaCampo.borde : "border-success focus-visible:border-success"),
                  identificacion && !idEstado.valido && "border-brand-red",
                )}
              />
              {idEstado.contador && (
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[11px] text-brand-gray-400 tabular-nums">
                  {idEstado.contador}
                </span>
              )}
            </div>
          </Campo>
          <Campo id={`${baseId}-razon`} label="Razón social / Nombres" requerido>
            <Input id={`${baseId}-razon`} required value={razonSocial} onChange={(event) => onRazonSocial(event.target.value)} placeholder="Ej. Comercial Machala S.A." className={control} />
          </Campo>
          <Campo id={`${baseId}-email`} label="Correo (recomendado)" hint="Le llegará el RIDE (PDF) y el XML autorizado.">
            <Input id={`${baseId}-email`} type="email" value={email} onChange={(event) => onEmail(event.target.value)} placeholder="correo@empresa.com" className={control} />
          </Campo>
          {onDireccion && (
            <Campo id={`${baseId}-direccion`} label="Dirección" className="lg:col-span-3">
              <Input id={`${baseId}-direccion`} value={direccion ?? ""} onChange={(event) => onDireccion(event.target.value)} placeholder="Calle, número y ciudad" className={control} />
            </Campo>
          )}
          {guardar && !contactoYaExiste && (
            <label className="flex items-center gap-2 text-sm text-brand-gray-700 lg:col-span-3">
              <input
                type="checkbox"
                checked={guardar.checked}
                onChange={(event) => guardar.onChange(event.target.checked)}
                className="size-4 accent-brand-red"
              />
              {guardar.label}
            </label>
          )}
        </div>
      )}
    </SeccionCard>
  );
}
