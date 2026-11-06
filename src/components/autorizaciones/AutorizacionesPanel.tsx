"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import { TIPOS_COMPROBANTE_SERIE, numeroSerie, siguienteDe } from "@/lib/series-comprobante";
import { cn } from "@/lib/utils";

interface EmisorOpcion {
  ruc: string;
  razonSocial: string;
}

interface PuntoForm {
  key: string;
  puntoEmision: string;
  ultimo: number;
}

interface TipoForm {
  tipo: string;
  nombre: string;
  puntos: PuntoForm[];
}

interface EstablecimientoForm {
  key: string;
  codigo: string;
  codigoAnterior?: string;
  direccion: string;
  ciudad: string;
  telefonos: string;
  ambiente: string;
  tipos: TipoForm[];
}

interface AutorizacionesApi {
  establecimientos: {
    codigo: string;
    direccion: string;
    ciudad: string;
    telefonos: string;
    ambiente: string;
    tipos: { tipo: string; nombre: string; puntos: { puntoEmision: string; ultimo: number }[] }[];
  }[];
}

type CampoEstablecimiento = "codigo" | "direccion" | "ciudad" | "telefonos" | "ambiente";

const AMBIENTES = [
  { value: "2", label: "Producción", ayuda: "Los comprobantes tienen validez tributaria.", punto: "bg-success" },
  { value: "1", label: "Pruebas", ayuda: "Los comprobantes no tienen validez tributaria.", punto: "bg-amber-500" },
];

const controlClass =
  "h-11 w-full rounded-[10px] border border-brand-gray-200 bg-white px-3 text-sm text-brand-gray-900 shadow-none placeholder:text-brand-gray-400 focus-visible:border-brand-red focus-visible:ring-3 focus-visible:ring-brand-red/15";

function nuevaKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function nuevoPunto(puntoEmision = ""): PuntoForm {
  return { key: nuevaKey(), puntoEmision, ultimo: 0 };
}

function desdeApi(data: AutorizacionesApi): EstablecimientoForm[] {
  return data.establecimientos.map((estab) => ({
    key: `estab-${estab.codigo}`,
    codigo: estab.codigo,
    codigoAnterior: estab.codigo,
    direccion: estab.direccion,
    ciudad: estab.ciudad,
    telefonos: estab.telefonos,
    ambiente: estab.ambiente,
    tipos: estab.tipos.map((tipo) => ({
      tipo: tipo.tipo,
      nombre: tipo.nombre,
      puntos: tipo.puntos.map((punto) => ({
        key: `${estab.codigo}-${tipo.tipo}-${punto.puntoEmision}`,
        puntoEmision: punto.puntoEmision,
        ultimo: punto.ultimo,
      })),
    })),
  }));
}

function codigoLibre(establecimientos: EstablecimientoForm[]): string {
  const usados = new Set(establecimientos.map((estab) => estab.codigo.padStart(3, "0")));
  for (let numero = 1; numero < 1000; numero++) {
    const codigo = String(numero).padStart(3, "0");
    if (!usados.has(codigo)) return codigo;
  }
  return "";
}

function codigoVisible(codigo: string): string {
  const padded = codigo.replace(/\D/g, "").padStart(3, "0").slice(-3);
  return padded === "000" ? "—" : padded;
}

export default function AutorizacionesPanel() {
  const [emisores, setEmisores] = useState<EmisorOpcion[]>([]);
  const [ruc, setRuc] = useState("");
  const [establecimientos, setEstablecimientos] = useState<EstablecimientoForm[]>([]);
  const [activo, setActivo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    apiFetch("/api/sri/emisores")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "No se pudieron leer los emisores");
        return (body.emisores || []) as EmisorOpcion[];
      })
      .then((lista) => {
        if (!vigente) return;
        setEmisores(lista);
        if (lista[0]) setRuc(lista[0].ruc);
        else setCargando(false);
      })
      .catch((err: Error) => {
        if (!vigente) return;
        setError(err.message);
        setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (!ruc) return;
    let vigente = true;
    setCargando(true);
    setError(null);
    apiFetch(`/api/sri/series?ruc=${encodeURIComponent(ruc)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "No se pudieron leer las autorizaciones");
        return body.autorizaciones as AutorizacionesApi;
      })
      .then((data) => {
        if (!vigente) return;
        const form = desdeApi(data);
        setEstablecimientos(form);
        setActivo(form[0]?.key ?? "");
      })
      .catch((err: Error) => {
        if (vigente) setError(err.message);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [ruc]);

  const estab = establecimientos.find((item) => item.key === activo) ?? establecimientos[0];
  const indiceActivo = estab ? establecimientos.indexOf(estab) : -1;

  function actualizarEstablecimiento(campo: CampoEstablecimiento, valor: string) {
    if (!estab) return;
    const limpio = campo === "codigo" ? valor.replace(/\D/g, "").slice(0, 3) : valor;
    setEstablecimientos((actual) => actual.map((item) => (
      item.key === estab.key ? { ...item, [campo]: limpio } : item
    )));
  }

  function actualizarTipos(cambio: (tipos: TipoForm[]) => TipoForm[]) {
    if (!estab) return;
    setEstablecimientos((actual) => actual.map((item) => (
      item.key === estab.key ? { ...item, tipos: cambio(item.tipos) } : item
    )));
  }

  function actualizarPunto(tipo: string, key: string, campo: "puntoEmision" | "ultimo", valor: string) {
    actualizarTipos((tipos) => tipos.map((item) => {
      if (item.tipo !== tipo) return item;
      return {
        ...item,
        puntos: item.puntos.map((punto) => {
          if (punto.key !== key) return punto;
          if (campo === "puntoEmision") return { ...punto, puntoEmision: valor.replace(/\D/g, "").slice(0, 3) };
          const digits = valor.replace(/\D/g, "").slice(0, 9);
          return { ...punto, ultimo: digits === "" ? 0 : Number(digits) };
        }),
      };
    }));
  }

  function agregarPunto(tipo: string) {
    actualizarTipos((tipos) => tipos.map((item) => (
      item.tipo === tipo ? { ...item, puntos: [...item.puntos, nuevoPunto()] } : item
    )));
  }

  function quitarPunto(tipo: string, key: string) {
    actualizarTipos((tipos) => tipos.map((item) => (
      item.tipo === tipo ? { ...item, puntos: item.puntos.filter((punto) => punto.key !== key) } : item
    )));
  }

  function agregarEstablecimiento() {
    const nuevo: EstablecimientoForm = {
      key: nuevaKey(),
      codigo: codigoLibre(establecimientos),
      direccion: "",
      ciudad: "",
      telefonos: "",
      ambiente: establecimientos[0]?.ambiente ?? "1",
      tipos: TIPOS_COMPROBANTE_SERIE.map((item) => ({
        tipo: item.tipo,
        nombre: item.nombre,
        puntos: [nuevoPunto("001")],
      })),
    };
    setEstablecimientos((actual) => [...actual, nuevo]);
    setActivo(nuevo.key);
  }

  function quitarEstablecimiento() {
    if (!estab || establecimientos.length < 2) return;
    const restantes = establecimientos.filter((item) => item.key !== estab.key);
    setEstablecimientos(restantes);
    setActivo(restantes[Math.max(0, indiceActivo - 1)]?.key ?? "");
  }

  async function guardar() {
    if (!ruc) return;
    setGuardando(true);
    setError(null);
    try {
      const response = await apiFetch("/api/sri/series", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruc,
          establecimientos: establecimientos.map((item) => ({
            codigo: item.codigo,
            codigoAnterior: item.codigoAnterior,
            direccion: item.direccion,
            ciudad: item.ciudad,
            telefonos: item.telefonos,
            ambiente: item.ambiente,
            tipos: item.tipos.map((tipo) => ({
              tipo: tipo.tipo,
              puntos: tipo.puntos.map((punto) => ({ puntoEmision: punto.puntoEmision, ultimo: punto.ultimo })),
            })),
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "No se pudieron guardar las autorizaciones");
      const form = desdeApi(body.autorizaciones as AutorizacionesApi);
      const codigoActivo = estab?.codigo.padStart(3, "0");
      setEstablecimientos(form);
      setActivo(form.find((item) => item.codigo === codigoActivo)?.key ?? form[0]?.key ?? "");
      toast.success("Autorizaciones guardadas");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudieron guardar las autorizaciones";
      setError(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  const estabVista = estab ? codigoVisible(estab.codigo) : "—";
  const deshabilitado = cargando || !ruc;

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <p className="max-w-2xl text-sm leading-relaxed text-brand-gray-500">
        Registra cada establecimiento de la empresa con su dirección y su ambiente (Producción o Pruebas). Dentro de cada uno, los comprobantes pueden tener varios puntos de emisión, y cada punto lleva su propio último número.
      </p>

      <section className="rounded-2xl border border-brand-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-1.5 sm:max-w-md">
          <Label htmlFor="autorizacion-ruc">RUC emisor</Label>
          <select
            id="autorizacion-ruc"
            value={ruc}
            onChange={(event) => setRuc(event.target.value)}
            className={controlClass}
          >
            {emisores.length === 0 && <option value="">Sin emisores</option>}
            {emisores.map((item) => (
              <option key={item.ruc} value={item.ruc}>{item.ruc} — {item.razonSocial}</option>
            ))}
          </select>
        </div>
      </section>

      {!cargando && estab && (
        <>
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Establecimientos">
            {establecimientos.map((item, indice) => {
              const seleccionado = item.key === estab.key;
              const lugar = item.ciudad.trim() || item.direccion.trim();
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={seleccionado}
                  onClick={() => setActivo(item.key)}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-[10px] border px-3 text-sm transition-colors",
                    seleccionado
                      ? "border-brand-red bg-brand-red-subtle font-semibold text-brand-red"
                      : "border-brand-gray-200 bg-white text-brand-gray-700 hover:bg-brand-gray-50",
                  )}
                >
                  <span className={cn("size-2 rounded-full", item.ambiente === "2" ? "bg-success" : "bg-amber-500")} aria-hidden />
                  <span className="sr-only">{item.ambiente === "2" ? "Producción" : "Pruebas"}</span>
                  <span className="font-mono tabular-nums">{codigoVisible(item.codigo)}</span>
                  {lugar && <span className="max-w-40 truncate font-normal">{lugar}</span>}
                  {indice === 0 && <span className="text-[11px] font-medium text-brand-gray-500">Principal</span>}
                </button>
              );
            })}
            <Button type="button" variant="outline" onClick={agregarEstablecimiento} className="h-11 rounded-[10px]">
              <Plus className="size-4" aria-hidden />
              Agregar establecimiento
            </Button>
          </div>

          <section className="rounded-2xl border border-brand-gray-200 bg-white p-4 shadow-sm sm:p-6" role="tabpanel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-brand-gray-900">Establecimiento {estabVista}</h2>
                <p className="mt-1 text-[13px] text-brand-gray-500">
                  {indiceActivo === 0
                    ? "Es el establecimiento principal del emisor."
                    : "La dirección se usa en los comprobantes emitidos desde este establecimiento."}
                </p>
              </div>
              {establecimientos.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={quitarEstablecimiento}
                  className="h-11 shrink-0 rounded-[10px] text-brand-gray-600 hover:text-brand-red"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Quitar
                </Button>
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[8rem_1fr]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="estab-codigo">Código</Label>
                <Input
                  id="estab-codigo"
                  inputMode="numeric"
                  maxLength={3}
                  value={estab.codigo}
                  disabled={deshabilitado}
                  onChange={(event) => actualizarEstablecimiento("codigo", event.target.value)}
                  className={cn(controlClass, "font-mono tabular-nums")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="estab-direccion">Dirección</Label>
                <Input
                  id="estab-direccion"
                  value={estab.direccion}
                  maxLength={300}
                  disabled={deshabilitado}
                  placeholder="Av. 9 de Octubre 123 y Malecón"
                  onChange={(event) => actualizarEstablecimiento("direccion", event.target.value)}
                  className={controlClass}
                />
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="estab-ciudad">Ciudad</Label>
                <Input
                  id="estab-ciudad"
                  value={estab.ciudad}
                  maxLength={120}
                  disabled={deshabilitado}
                  placeholder="Guayaquil"
                  onChange={(event) => actualizarEstablecimiento("ciudad", event.target.value)}
                  className={controlClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="estab-telefonos">Teléfonos</Label>
                <Input
                  id="estab-telefonos"
                  type="tel"
                  value={estab.telefonos}
                  maxLength={120}
                  disabled={deshabilitado}
                  placeholder="04 2345678, 0991234567"
                  onChange={(event) => actualizarEstablecimiento("telefonos", event.target.value)}
                  className={controlClass}
                />
              </div>
            </div>
            <fieldset className="mt-4" disabled={deshabilitado}>
              <legend className="text-sm font-medium text-brand-gray-900">Ambiente del SRI</legend>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {AMBIENTES.map((opcion) => {
                  const elegido = estab.ambiente === opcion.value;
                  return (
                    <label
                      key={opcion.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 transition-colors",
                        elegido ? "border-brand-red bg-brand-red-subtle" : "border-brand-gray-200 hover:bg-brand-gray-50",
                      )}
                    >
                      <input
                        type="radio"
                        name={`ambiente-${estab.key}`}
                        value={opcion.value}
                        checked={elegido}
                        onChange={() => actualizarEstablecimiento("ambiente", opcion.value)}
                        className="mt-1 accent-brand-red"
                      />
                      <span className="flex flex-col">
                        <span className="flex items-center gap-2 text-sm font-semibold text-brand-gray-900">
                          <span className={cn("size-2 rounded-full", opcion.punto)} aria-hidden />
                          {opcion.label}
                        </span>
                        <span className="text-[13px] text-brand-gray-500">{opcion.ayuda}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-[13px] text-brand-gray-500">Emitir usa este ambiente para todos los comprobantes de este establecimiento.</p>
            </fieldset>
          </section>

          {estab.tipos.map((tipo) => (
            <section key={`${estab.key}-${tipo.tipo}`} className="rounded-2xl border border-brand-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-brand-gray-900">{tipo.nombre}</h3>
                  <p className="mt-1 text-[13px] text-brand-gray-500">Código SRI {tipo.tipo}. Agrega un punto por cada caja de este establecimiento que emita este comprobante.</p>
                </div>
                <Button type="button" variant="outline" onClick={() => agregarPunto(tipo.tipo)} className="h-11 shrink-0 rounded-[10px]">
                  <Plus className="size-4" aria-hidden />
                  Agregar punto
                </Button>
              </div>

              {tipo.puntos.length === 0 ? (
                <p className="mt-4 text-sm text-brand-gray-500">Este comprobante no se emite desde este establecimiento.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[560px] table-fixed text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-semibold tracking-wide text-brand-gray-500 uppercase">
                        <th className="w-36 px-1 pb-2 font-semibold">Punto de emisión</th>
                        <th className="w-44 px-1 pb-2 text-right font-semibold">Último emitido</th>
                        <th className="pr-1 pb-2 pl-6 font-semibold">Siguiente</th>
                        <th className="w-12 px-1 pb-2"><span className="sr-only">Quitar</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tipo.puntos.map((punto) => {
                        const codigo = punto.puntoEmision.padStart(3, "0");
                        const siguiente = codigo !== "000" && estabVista !== "—"
                          ? numeroSerie(estabVista, codigo, siguienteDe(punto.ultimo))
                          : "—";
                        const idBase = `${estab.key}-${tipo.tipo}-${punto.key}`;
                        return (
                          <tr key={punto.key}>
                            <td className="px-1 py-1">
                              <label className="sr-only" htmlFor={`${idBase}-punto`}>Punto de emisión de {tipo.nombre}</label>
                              <Input
                                id={`${idBase}-punto`}
                                inputMode="numeric"
                                value={punto.puntoEmision}
                                onChange={(event) => actualizarPunto(tipo.tipo, punto.key, "puntoEmision", event.target.value)}
                                className={cn(controlClass, "w-28 font-mono tabular-nums")}
                              />
                            </td>
                            <td className="px-1 py-1">
                              <label className="sr-only" htmlFor={`${idBase}-ultimo`}>Último {tipo.nombre} del punto {punto.puntoEmision}</label>
                              <Input
                                id={`${idBase}-ultimo`}
                                inputMode="numeric"
                                value={String(punto.ultimo)}
                                onChange={(event) => actualizarPunto(tipo.tipo, punto.key, "ultimo", event.target.value)}
                                className={cn(controlClass, "text-right font-mono tabular-nums")}
                              />
                            </td>
                            <td className="py-1 pr-1 pl-6 font-mono text-xs tabular-nums text-brand-gray-600">{siguiente}</td>
                            <td className="px-1 py-1 text-right">
                              <button
                                type="button"
                                aria-label={`Quitar punto ${punto.puntoEmision || "nuevo"} de ${tipo.nombre}`}
                                onClick={() => quitarPunto(tipo.tipo, punto.key)}
                                className="inline-flex size-11 items-center justify-center rounded-[10px] text-brand-gray-400 hover:bg-brand-red-subtle hover:text-brand-red"
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </>
      )}

      {cargando && <p className="text-sm text-brand-gray-500">Cargando autorizaciones…</p>}
      {error && <p className="text-sm text-orange-900" role="alert">{error}</p>}

      <div>
        <Button
          type="button"
          onClick={guardar}
          disabled={deshabilitado || guardando}
          className="h-11 rounded-[10px] bg-brand-red px-4 text-white hover:bg-brand-red/90"
        >
          {guardando ? "Guardando..." : "Guardar autorizaciones"}
        </Button>
      </div>
    </div>
  );
}
