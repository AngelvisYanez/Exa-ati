"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { EmptyState } from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { sriClient } from "@/lib/sriClient";
import { apiFetch } from "@/lib/apiFetch";
import PosHeader, { type EmisorPos } from "./_components/PosHeader";
import Catalogo, { filtrarProductos } from "./_components/Catalogo";
import TicketCliente from "./_components/TicketCliente";
import TicketLineas from "./_components/TicketLineas";
import TicketCobro, { type MotivoBloqueo } from "./_components/TicketCobro";
import ClienteDialog from "./_components/ClienteDialog";
import CobroDialog, { type ResultadoVenta } from "./_components/CobroDialog";
import { posFont } from "./_lib/pos-font";
import { LIMITE_CONSUMIDOR_FINAL, type FormaPagoCodigo } from "./_lib/pos-config";
import {
  agregarProducto,
  calcularTotalesTicket,
  camposFaltantes,
  construirPayloadPos,
  contarArticulos,
  formatoUSD,
  normalizarCliente,
  numeroFacturaDesdeClave,
  productoDesdeApi,
  tipoIdentificacionDe,
  type ClienteDatos,
  type LineaTicket,
  type ProductoPos,
} from "./_lib/pos-calc";

function esEditable(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

/** En pantallas táctiles no se fuerza el foco: abriría el teclado virtual en cada toque. */
function punteroFino(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
}

const MENSAJE_BLOQUEO: Record<Exclude<MotivoBloqueo, null>, string> = {
  vacio: "Agrega al menos un producto",
  emisor: "Selecciona un emisor",
  cliente: "Completa los datos del cliente",
  limiteCF: `Supera ${formatoUSD(LIMITE_CONSUMIDOR_FINAL)}: el SRI exige los datos del cliente`,
};

export default function PosPage() {
  const { hasSriLinked } = useAuth();
  const [emisores, setEmisores] = useState<EmisorPos[]>([]);
  const [emisorId, setEmisorId] = useState("");
  const [productos, setProductos] = useState<ProductoPos[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [errorProductos, setErrorProductos] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [lineas, setLineas] = useState<LineaTicket[]>([]);
  const [cliente, setCliente] = useState<ClienteDatos | null>(null);
  const [formaPago, setFormaPago] = useState<FormaPagoCodigo>("01");
  const [propina, setPropina] = useState(0);
  const [observaciones, setObservaciones] = useState("");

  const [clienteAbierto, setClienteAbierto] = useState(false);
  const [cobroAbierto, setCobroAbierto] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoVenta | null>(null);
  /** Datos previos para reabrir "Con datos" tras pasar a consumidor final. */
  const [ultimoCliente, setUltimoCliente] = useState<ClienteDatos | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasSriLinked) return;
    sriClient.getEmisores().then((res: { emisores?: EmisorPos[] }) => {
      const list = res.emisores || [];
      setEmisores(list);
      if (list.length === 1) setEmisorId(list[0].id);
    }).catch(() => {});

    apiFetch("/api/ecommerce/productos?activo=true&pos=true")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "No se pudo cargar el inventario");
        setProductos((data.data as Record<string, unknown>[]).map(productoDesdeApi));
      })
      .catch((e: Error) => setErrorProductos(e.message || "No se pudo cargar el inventario"))
      .finally(() => setCargandoProductos(false));
  }, [hasSriLinked]);

  const totales = useMemo(() => calcularTotalesTicket(lineas, propina), [lineas, propina]);
  const articulos = contarArticulos(lineas);
  const cantidades = useMemo(() => new Map(lineas.map((l) => [l.id, l.cantidad])), [lineas]);
  const excedeLimiteCF = cliente === null && totales.total > LIMITE_CONSUMIDOR_FINAL;
  const bloqueo: MotivoBloqueo =
    lineas.length === 0 ? "vacio"
      : !emisorId ? "emisor"
        : cliente && camposFaltantes(cliente).length > 0 ? "cliente"
          : excedeLimiteCF ? "limiteCF"
            : null;

  const enfocarBuscador = useCallback((forzar = false) => {
    if (!forzar && !punteroFino()) return;
    setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 0);
  }, []);

  /* ---------- Ticket ---------- */

  const agregar = useCallback((p: ProductoPos) => {
    setLineas((ls) => agregarProducto(ls, p));
    enfocarBuscador();
  }, [enfocarBuscador]);

  function agregarDesdeBuscador(valor: string) {
    const t = valor.trim();
    if (!t) return;
    const exacto = productos.find((p) => p.codigo.toLowerCase() === t.toLowerCase());
    const p = exacto ?? filtrarProductos(productos, t)[0];
    setQuery("");
    if (p) setLineas((ls) => agregarProducto(ls, p));
    else toast.error(`No se encontró «${t}»`);
  }

  const cambiarCantidad = useCallback((id: string, cantidad: number) => {
    setLineas((ls) => ls.map((l) => (l.id === id ? { ...l, cantidad } : l)));
  }, []);
  const cambiarDescuento = useCallback((id: string, descuento: number) => {
    setLineas((ls) => ls.map((l) => (l.id === id ? { ...l, descuento } : l)));
  }, []);
  const quitar = useCallback((id: string) => {
    setLineas((ls) => ls.filter((l) => l.id !== id));
    enfocarBuscador();
  }, [enfocarBuscador]);

  function limpiarVenta() {
    setLineas([]);
    setCliente(null);
    setUltimoCliente(null);
    setFormaPago("01");
    setPropina(0);
    setObservaciones("");
    setQuery("");
    setResultado(null);
    setCobroAbierto(false);
    setConfirmarCancelar(false);
    enfocarBuscador(true);
  }

  function cancelarVenta() {
    if (lineas.length > 0) setConfirmarCancelar(true);
    else limpiarVenta();
  }

  /* ---------- Cliente ---------- */

  function usarConsumidorFinal() {
    if (cliente) setUltimoCliente(cliente);
    setCliente(null);
    setClienteAbierto(false);
    enfocarBuscador();
  }

  function cerrarCliente(borrador: ClienteDatos) {
    const vacio = Object.values(borrador).every((v) => !v.trim());
    setCliente(vacio ? null : borrador);
    setClienteAbierto(false);
    enfocarBuscador();
  }

  function guardarCliente(c: ClienteDatos, esNuevo: boolean) {
    const n = normalizarCliente(c);
    setCliente(n);
    setClienteAbierto(false);
    enfocarBuscador();
    if (!esNuevo) return;
    apiFetch("/api/contactos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoIdentificacion: tipoIdentificacionDe(n.identificacion),
        identificacion: n.identificacion,
        razonSocial: n.razonSocial,
        email: n.email,
        direccion: n.direccion,
        telefono: n.telefono || undefined,
        esCliente: true,
        esProveedor: false,
      }),
    })
      .then((res) => { if (res.ok) toast.success("Cliente guardado en contactos"); })
      .catch(() => {});
  }

  /* ---------- Cobro ---------- */

  function abrirCobro() {
    if (bloqueo === null) {
      setCobroAbierto(true);
      return;
    }
    toast.error(MENSAJE_BLOQUEO[bloqueo]);
    if (bloqueo === "cliente") setClienteAbierto(true);
  }

  async function consultarEstado(claveAcceso: string) {
    let estado = "PENDIENTE";
    let numeroAutorizacion: string | null = null;
    try {
      const res = await apiFetch(`/api/sri/pos?limit=20&search=${claveAcceso.slice(30, 39)}`);
      const data = await res.json();
      const row = (data.data as { clave_acceso: string; estado: string; numero_autorizacion: string | null }[] | undefined)
        ?.find((v) => v.clave_acceso === claveAcceso);
      if (row) {
        estado = row.estado;
        numeroAutorizacion = row.numero_autorizacion;
      }
    } catch {}
    setResultado((r) => (r && r.claveAcceso === claveAcceso ? { ...r, estado, numeroAutorizacion } : r));
  }

  async function emitir(vuelto: number) {
    if (bloqueo !== null) {
      toast.error(MENSAJE_BLOQUEO[bloqueo]);
      return;
    }
    if (lineas.some((i) => !i.codigo || !i.descripcion || i.precioUnitario <= 0)) {
      toast.error("Hay productos sin código, descripción o precio");
      return;
    }

    setEmitiendo(true);
    try {
      const res = await apiFetch("/api/sri/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("sri_access_token")}` },
        body: JSON.stringify(construirPayloadPos({ emisorId, lineas, formaPago, propina, observaciones, cliente })),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResultado({
        claveAcceso: data.claveAcceso,
        numero: numeroFacturaDesdeClave(data.claveAcceso),
        total: totales.total,
        vuelto,
        estado: null,
        numeroAutorizacion: null,
      });
      void consultarEstado(data.claveAcceso);
    } catch (err) {
      toast.error((err as Error).message || "Error al emitir factura POS");
    } finally {
      setEmitiendo(false);
    }
  }

  async function imprimir() {
    if (!resultado) return;
    const ventana = window.open("", "_blank");
    try {
      const res = await apiFetch(`/api/sri/comprobantes/${resultado.claveAcceso}/pdf`);
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      if (ventana) ventana.location.href = url;
      else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      ventana?.close();
      toast.error("El RIDE aún no está disponible; búscalo luego en Ventas del día");
    }
  }

  /* ---------- Atajos ---------- */

  const modalAbierto = clienteAbierto || cobroAbierto || confirmarCancelar;

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (modalAbierto) return;
    const enBuscador = e.target === searchRef.current;

    switch (e.key) {
      case "F2":
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      case "F4":
        e.preventDefault();
        setClienteAbierto(true);
        return;
      case "F9":
        e.preventDefault();
        abrirCobro();
        return;
      case "Escape":
        if (esEditable(e.target) && !enBuscador) {
          (e.target as HTMLElement).blur();
          searchRef.current?.focus();
          return;
        }
        if (enBuscador && query) {
          setQuery("");
          return;
        }
        cancelarVenta();
        return;
    }

    // Un lector de código de barras "teclea": si el foco quedó en un botón, redirigir al buscador.
    if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey && !esEditable(e.target)) {
      e.preventDefault();
      setQuery((q) => q + e.key);
      searchRef.current?.focus();
    }
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyDown(e);
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (!hasSriLinked) {
    return (
      <>
        <title>POS - EXA ATI</title>
        <Topbar title="Punto de Venta" />
        <main className="ui-page flex-1 w-full">
          <EmptyState
            icon={<FileText className="w-5 h-5" />}
            title="Vincula tu RUC del SRI en Configuración para usar el POS."
          />
        </main>
      </>
    );
  }

  return (
    <>
      <title>POS - EXA ATI</title>
      <div className={`${posFont.className} flex min-h-dvh flex-col bg-pos-bg text-pos-ink lg:h-dvh lg:overflow-hidden`}>
        <PosHeader emisores={emisores} emisorId={emisorId} onEmisorChange={setEmisorId} />

        <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <Catalogo
            productos={productos}
            cargando={cargandoProductos}
            error={errorProductos}
            cantidades={cantidades}
            query={query}
            onQueryChange={setQuery}
            onEnter={agregarDesdeBuscador}
            onAgregar={agregar}
            searchRef={searchRef}
          />

          <aside
            aria-label="Ticket de venta"
            className="flex flex-col border-t border-pos-line bg-white lg:min-h-0 lg:w-[360px] lg:shrink-0 xl:w-[420px] lg:border-l lg:border-t-0"
          >
            <TicketCliente
              cliente={cliente}
              onConsumidorFinal={usarConsumidorFinal}
              onConDatos={() => setClienteAbierto(true)}
            />
            <TicketLineas
              lineas={lineas}
              onCantidad={cambiarCantidad}
              onDescuento={cambiarDescuento}
              onQuitar={quitar}
            />
            <TicketCobro
              totales={totales}
              propina={propina}
              articulos={articulos}
              formaPago={formaPago}
              onFormaPago={setFormaPago}
              bloqueo={bloqueo}
              onCobrar={abrirCobro}
              onCancelar={cancelarVenta}
              onConDatos={() => setClienteAbierto(true)}
            />
          </aside>
        </main>
      </div>

      <ClienteDialog
        open={clienteAbierto}
        inicial={cliente ?? ultimoCliente}
        onCerrar={cerrarCliente}
        onGuardar={guardarCliente}
        onConsumidorFinal={usarConsumidorFinal}
      />

      <CobroDialog
        open={cobroAbierto}
        total={totales.total}
        formaPago={formaPago}
        propina={propina}
        onPropina={setPropina}
        observaciones={observaciones}
        onObservaciones={setObservaciones}
        excedeLimiteCF={excedeLimiteCF}
        emitiendo={emitiendo}
        resultado={resultado}
        onConfirmar={emitir}
        onCerrar={() => {
          setCobroAbierto(false);
          enfocarBuscador();
        }}
        onNuevaVenta={limpiarVenta}
        onImprimir={imprimir}
      />

      <ConfirmDialog
        open={confirmarCancelar}
        title="¿Cancelar la venta?"
        message={`Se quitarán ${lineas.length} ${lineas.length === 1 ? "producto" : "productos"} del ticket y los datos del cliente.`}
        confirmLabel="Sí, cancelar venta"
        cancelLabel="Seguir vendiendo"
        variant="danger"
        onConfirm={limpiarVenta}
        onCancel={() => {
          setConfirmarCancelar(false);
          enfocarBuscador();
        }}
      />
    </>
  );
}
