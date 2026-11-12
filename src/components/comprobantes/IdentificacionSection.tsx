"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, UserRound, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Campo from "./Campo";
import ClienteRapidoDialog from "./ClienteRapidoDialog";
import SeccionCard from "./SeccionCard";
import { type EstadoIdentificacion, type TipoIdentificacion } from "./identificacion";
import { chip, control, foco } from "./tokens";
import type { ContactoResumen, FuenteContactos } from "./types";

export type { FuenteContactos };

const MAX_RESULTADOS = 8;

const TEXTOS_FUENTE: Record<FuenteContactos, { buscar: string; lista: string; registrar: string }> = {
  cliente: { buscar: "Buscar cliente", lista: "Clientes encontrados", registrar: "Agregar cliente" },
  proveedor: { buscar: "Buscar proveedor", lista: "Proveedores encontrados", registrar: "Agregar proveedor" },
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
  onContactoCreado: (contacto: ContactoResumen) => void;
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

function filtrarContactos(contactos: ContactoResumen[], query: string): ContactoResumen[] {
  const q = query.trim().toLowerCase();
  if (!q) return contactos.slice(0, MAX_RESULTADOS);
  return contactos
    .map((contacto) => {
      const nombre = contacto.razonSocial.toLowerCase();
      const identificacion = contacto.identificacion.toLowerCase();
      let score = -1;
      if (nombre === q || identificacion === q) score = 0;
      else if (nombre.startsWith(q) || identificacion.startsWith(q)) score = 1;
      else if (nombre.includes(q) || identificacion.includes(q)) score = 2;
      return { contacto, score };
    })
    .filter((item) => item.score >= 0)
    .sort((a, b) => a.score - b.score || a.contacto.razonSocial.localeCompare(b.contacto.razonSocial, "es"))
    .slice(0, MAX_RESULTADOS)
    .map((item) => item.contacto);
}

export default function IdentificacionSection({
  n, titulo, ayuda, completa, fuente, contactos, onSeleccionarContacto, onContactoCreado,
  tiposPermitidos, tipoId, onTipoId, identificacion, onIdentificacion,
  razonSocial, onRazonSocial, email, onEmail, onDireccion, sustituto,
}: IdentificacionSectionProps) {
  const baseId = useId();
  const autoId = useId();
  const textos = TEXTOS_FUENTE[fuente];
  const listboxId = `${baseId}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [registro, setRegistro] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const coincidencias = useMemo(() => filtrarContactos(contactos, busqueda), [contactos, busqueda]);
  const query = busqueda.trim();
  const coincidenciaExacta = contactos.some((item) => {
    const q = query.toLowerCase();
    return item.identificacion.toLowerCase() === q || item.razonSocial.toLowerCase() === q;
  });
  const sinCoincidencia = query.length > 0 && !coincidenciaExacta;
  const permiteConsumidor = tiposPermitidos.some((tipo) => tipo.value === "07");
  const esConsumidor = tipoId === "07";
  const clienteElegido = completa && !esConsumidor && Boolean(identificacion.trim() && razonSocial.trim());

  useLayoutEffect(() => {
    if (!abierto) {
      setPos(null);
      return;
    }
    const update = () => {
      const input = inputRef.current;
      if (!input) return;
      const r = input.getBoundingClientRect();
      const width = Math.max(r.width, 280);
      const left = Math.min(Math.max(12, r.left), window.innerWidth - width - 12);
      const gap = 4;
      const espacioAbajo = window.innerHeight - r.bottom - gap - 12;
      const espacioArriba = r.top - gap - 12;
      const abrirArriba = espacioAbajo < 160 && espacioArriba > espacioAbajo;
      const maxHeight = Math.min(280, Math.max(120, abrirArriba ? espacioArriba : espacioAbajo));
      const top = abrirArriba ? r.top - gap - maxHeight : r.bottom + gap;
      setPos({ top, left, width, maxHeight });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [abierto, coincidencias.length, sinCoincidencia]);

  useEffect(() => {
    setActivo(0);
  }, [busqueda]);

  useEffect(() => {
    if (!abierto) return;
    const onPointer = (event: MouseEvent) => {
      const t = event.target as Node;
      if (inputRef.current?.contains(t) || listaRef.current?.contains(t)) return;
      setAbierto(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const opcion = listaRef.current?.querySelector<HTMLElement>("[data-activo='true']");
    opcion?.scrollIntoView({ block: "nearest" });
  }, [abierto, activo]);

  function elegir(contacto: ContactoResumen) {
    onSeleccionarContacto(contacto.identificacion);
    setBusqueda("");
    setAbierto(false);
  }

  function abrirRegistro() {
    setRegistro(query);
    setAbierto(false);
  }

  function quitarCliente() {
    const tipoBase = tiposPermitidos.find((tipo) => tipo.value !== "07")?.value ?? "04";
    onTipoId(tipoBase);
    onIdentificacion("");
    onRazonSocial("");
    onEmail("");
    onDireccion?.("");
    setBusqueda("");
    inputRef.current?.focus();
  }

  function confirmarActivo() {
    const contacto = coincidencias[activo];
    if (contacto) {
      elegir(contacto);
      return;
    }
    if (sinCoincidencia) abrirRegistro();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!abierto) {
        setAbierto(true);
        return;
      }
      confirmarActivo();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setAbierto(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!abierto) {
        setAbierto(true);
        return;
      }
      if (coincidencias.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActivo((actual) => (actual + delta + coincidencias.length) % coincidencias.length);
    }
  }

  const activoId = !abierto || coincidencias.length === 0
    ? undefined
    : coincidencias[activo]
      ? `${autoId}-opcion-${coincidencias[activo].id}`
      : undefined;

  return (
    <SeccionCard n={n} titulo={titulo} ayuda={ayuda} completa={completa}>
      {clienteElegido ? (
        <div className="flex items-center gap-3 rounded-xl border border-brand-gray-200 bg-brand-gray-50 px-3 py-2">
          <UserRound className="size-4 shrink-0 text-brand-gray-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-brand-gray-900">{razonSocial}</p>
            <p className="font-mono text-[11px] text-brand-gray-500">{identificacion}{email ? ` · ${email}` : ""}</p>
          </div>
          <button
            type="button"
            onClick={quitarCliente}
            aria-label="Cambiar cliente"
            className={cn("inline-flex size-8 items-center justify-center rounded-lg text-brand-gray-400 hover:bg-white hover:text-brand-red", foco)}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <>
          <Campo id={`${baseId}-buscar`} label={textos.buscar}>
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-gray-400" aria-hidden />
                <Input
                  ref={inputRef}
                  id={`${baseId}-buscar`}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={abierto}
                  aria-controls={listboxId}
                  aria-activedescendant={activoId}
                  value={busqueda}
                  onChange={(event) => {
                    setBusqueda(event.target.value);
                    setAbierto(true);
                  }}
                  onFocus={() => setAbierto(true)}
                  onClick={() => setAbierto(true)}
                  onKeyDown={onKeyDown}
                  placeholder="Nombre, RUC o cédula..."
                  autoComplete="off"
                  className={cn(control, "pl-9")}
                />
              </div>
              {sinCoincidencia ? (
                <button
                  type="button"
                  aria-label={textos.registrar}
                  title={textos.registrar}
                  onClick={abrirRegistro}
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-red text-white hover:brightness-90",
                    foco,
                  )}
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
          </Campo>
          {abierto && pos && typeof document !== "undefined" && createPortal(
            <div
              ref={listaRef}
              id={listboxId}
              role="listbox"
              aria-label={textos.lista}
              style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
              className="fixed z-50 overflow-y-auto rounded-xl border border-brand-gray-200 bg-white py-1 shadow-lg shadow-brand-gray-900/10"
            >
              {coincidencias.map((contacto, indice) => {
                const estaActivo = indice === activo;
                return (
                  <button
                    key={contacto.id}
                    type="button"
                    role="option"
                    id={`${autoId}-opcion-${contacto.id}`}
                    aria-selected={estaActivo}
                    tabIndex={-1}
                    data-activo={estaActivo || undefined}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                      estaActivo ? "bg-brand-red-subtle text-brand-gray-900" : "text-brand-gray-800 hover:bg-brand-gray-50",
                      foco,
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActivo(indice)}
                    onClick={() => elegir(contacto)}
                  >
                    <UserRound className="size-4 shrink-0 text-brand-gray-400" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{contacto.razonSocial}</span>
                      <span className="font-mono text-[11px] text-brand-gray-500">{contacto.identificacion}</span>
                    </span>
                  </button>
                );
              })}
              {coincidencias.length === 0 ? (
                <p className="px-3 py-2.5 text-sm text-brand-gray-500">
                  {query ? "No está. Pulsa + para agregarlo." : "Escribe un nombre, RUC o cédula."}
                </p>
              ) : null}
            </div>,
            document.body,
          )}
          {permiteConsumidor ? (
            <button
              type="button"
              role="radio"
              aria-checked={esConsumidor}
              onClick={() => onTipoId(esConsumidor ? (tiposPermitidos.find((tipo) => tipo.value !== "07")?.value ?? "04") : "07")}
              className={cn("mt-2", chip.base, esConsumidor ? chip.activo : cn(chip.inactivo, "hover:bg-brand-gray-50"))}
            >
              Consumidor final
            </button>
          ) : null}
        </>
      )}

      {esConsumidor ? sustituto : null}

      <ClienteRapidoDialog
        open={registro !== null}
        consultaInicial={registro ?? ""}
        fuente={fuente}
        onCerrar={() => setRegistro(null)}
        onCreado={(contacto) => {
          setRegistro(null);
          setBusqueda("");
          onContactoCreado(contacto);
        }}
      />
    </SeccionCard>
  );
}
