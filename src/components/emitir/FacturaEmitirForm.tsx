"use client";

import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { Search, TriangleAlert } from "lucide-react";
import ComprobanteLayout from "@/components/comprobantes/ComprobanteLayout";
import DatosComprobanteSection from "@/components/comprobantes/DatosComprobanteSection";
import DetalleTable, { type ColumnaDetalle } from "@/components/comprobantes/DetalleTable";
import IdentificacionSection from "@/components/comprobantes/IdentificacionSection";
import InventarioPicker from "@/components/comprobantes/InventarioPicker";
import LineaProductoCombobox from "@/components/comprobantes/LineaProductoCombobox";
import ProductoRapidoDialog from "@/components/comprobantes/ProductoRapidoDialog";
import {
  AccionEmitir,
  ChecklistEmision,
  ResumenFila,
  ResumenFilas,
  ResumenPanel,
  ResumenTotal,
} from "@/components/comprobantes/ResumenPanel";
import Campo from "@/components/comprobantes/Campo";
import SeccionCard from "@/components/comprobantes/SeccionCard";
import { TIPOS_IDENTIFICACION } from "@/components/comprobantes/identificacion";
import { numeroComprobante, serieEmisor } from "@/components/comprobantes/numeracion";
import { boton, chip, control, money, tono } from "@/components/comprobantes/tokens";
import type {
  ContactoResumen,
  EmisorOpcion,
  ProductoInventario,
  ResultadoEmision,
} from "@/components/comprobantes/types";
import { useChecklist } from "@/components/comprobantes/useChecklist";
import type { SerieVisible } from "@/components/comprobantes/PuntoEmisionSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  BORRADOR_DISPONIBLE,
  COD_IVA,
  FORMA_PAGO,
  ID_CONSUMIDOR_FINAL,
  NOMBRE_CONSUMIDOR_FINAL,
  ORDEN_FORMA_PAGO,
  PAGO_PRESENTACION,
  PLAZOS,
  TOPE_CONSUMIDOR_FINAL,
  UMBRAL_BANCARIZACION,
  VISTA_PREVIA_RIDE_DISPONIBLE,
  calcTotal,
  conFilaSiguiente,
  desgloseFactura,
  propinaDiezPorciento,
  revisarFactura,
  subtotalLinea,
  validarIdentificacionFactura,
  type DetalleItem,
} from "@/components/emitir/factura-calculos";

export type { ResultadoEmision };

interface FacturaEmitirFormProps {
  emisores: EmisorOpcion[];
  emisorRuc: string;
  fechaEmision: string;
  onFechaEmision: (value: string) => void;
  secuencial: string;
  onSecuencial: (value: string) => void;
  serieEmision: string;
  onSerieEmision: (value: string) => void;
  ambiente: string;
  onAmbiente: (value: string) => void;
  contactos: ContactoResumen[];
  onSeleccionarContacto: (identificacion: string) => void;
  onContactoCreado: (contacto: ContactoResumen) => void;
  tipoId: string;
  onTipoId: (value: string) => void;
  identificacion: string;
  onIdentificacion: (value: string) => void;
  razonSocial: string;
  onRazonSocial: (value: string) => void;
  email: string;
  onEmail: (value: string) => void;
  guardarCliente: boolean;
  onGuardarCliente: (value: boolean) => void;
  productos: ProductoInventario[];
  detalles: DetalleItem[];
  onDetalles: (detalles: DetalleItem[]) => void;
  onAgregarProducto: (codigo: string) => void;
  onProductoCreado: (producto: ProductoInventario, indice: number) => void;
  onAgregarLinea: () => void;
  onEliminarLinea: (indice: number) => void;
  formaPago: string;
  onFormaPago: (value: string) => void;
  plazo: number;
  onPlazo: (value: number) => void;
  propina: number;
  onPropina: (value: number) => void;
  observaciones: string;
  onObservaciones: (value: string) => void;
  emitiendo: boolean;
  resultado: ResultadoEmision | null;
  onEmitir: () => void;
  onOtra: () => void;
  onCambiarTipo: () => void;
}

const AVISO_AMBIENTE = {
  produccion: "Producción: la factura tiene validez tributaria y se enviará al SRI para su autorización.",
  pruebas: "Pruebas: esta factura no tiene validez tributaria.",
};

function pagoTitulo(codigo: string): string {
  return PAGO_PRESENTACION[codigo]?.titulo || FORMA_PAGO.find((item) => item.value === codigo)?.label || codigo;
}

function seleccionarAlEnfocar(event: FocusEvent<HTMLInputElement>) {
  const campo = event.currentTarget;
  campo.select();
  requestAnimationFrame(() => campo.select());
  window.setTimeout(() => campo.select(), 0);
}

function evitarColapsarSeleccion(event: MouseEvent<HTMLInputElement>) {
  event.preventDefault();
  event.currentTarget.select();
}

export default function FacturaEmitirForm(props: FacturaEmitirFormProps) {
  const {
    emisores, emisorRuc,
    fechaEmision, onFechaEmision, secuencial, onSecuencial, serieEmision, onSerieEmision,
    ambiente, onAmbiente, contactos, onSeleccionarContacto, onContactoCreado,
    tipoId, onTipoId, identificacion, onIdentificacion, razonSocial, onRazonSocial,
    email, onEmail, guardarCliente, onGuardarCliente,
    productos, detalles, onDetalles, onAgregarProducto, onProductoCreado, onAgregarLinea, onEliminarLinea,
    formaPago, onFormaPago, plazo, onPlazo, propina, onPropina,
    observaciones, onObservaciones,
    emitiendo, resultado, onEmitir, onOtra, onCambiarTipo,
  } = props;

  const baseId = useId();
  const [inventarioAbierto, setInventarioAbierto] = useState(false);
  const [registro, setRegistro] = useState<{ indice: number; nombre: string } | null>(null);
  const [serieGuardada, setSerieGuardada] = useState<SerieVisible | null>(null);
  const [propinaAutomatica, setPropinaAutomatica] = useState(false);
  const inventarioBtnRef = useRef<HTMLButtonElement>(null);

  const emisor = emisores.find((item) => item.ruc === emisorRuc);
  const serieBase = serieEmisor(emisor);
  const serie = serieGuardada
    ? { estab: serieGuardada.estab, pto: serieGuardada.pto }
    : serieBase;
  const totales = calcTotal(detalles);
  const desglose = desgloseFactura(detalles, propina);
  const revision = revisarFactura({
    emisorRuc, fechaEmision, ambiente, tipoId, identificacion, razonSocial, detalles, formaPago,
  });
  const esConsumidor = tipoId === "07";

  useEffect(() => {
    if (!propinaAutomatica) return;
    onPropina(propinaDiezPorciento(calcTotal(detalles).sinImp));
  }, [propinaAutomatica, detalles, onPropina]);

  const pasos = [
    { label: "Comprobante", done: revision.comprobante },
    { label: "Cliente", done: revision.cliente },
    { label: "Productos", done: revision.productos },
    { label: "Pago", done: revision.pago },
    { label: "Emitir", done: revision.emitir },
  ];

  const checklist = useChecklist([
    { ok: revision.comprobante, label: "Emisor, fecha y ambiente" },
    {
      ok: revision.identificacion,
      label: esConsumidor
        ? `Identificación de consumidor final dentro del tope de ${money(TOPE_CONSUMIDOR_FINAL)}`
        : "Identificación del cliente válida",
    },
    { ok: revision.razonSocial, label: "Nombre o razón social del cliente" },
    { ok: revision.productos, label: "Al menos una línea con producto, descripción y precio" },
    { ok: revision.pago, label: "Forma de pago acorde al monto" },
  ]);

  function elegirTipo(value: string) {
    onTipoId(value);
    if (value === "07") {
      onIdentificacion(ID_CONSUMIDOR_FINAL);
      onRazonSocial(NOMBRE_CONSUMIDOR_FINAL);
      return;
    }
    if (identificacion === ID_CONSUMIDOR_FINAL) onIdentificacion("");
    if (razonSocial === NOMBRE_CONSUMIDOR_FINAL) onRazonSocial("");
  }

  const cantidadesInventario = useMemo(() => {
    const map = new Map<string, number>();
    for (const linea of detalles) {
      if (!linea.codigoPrincipal) continue;
      map.set(linea.codigoPrincipal, (map.get(linea.codigoPrincipal) ?? 0) + linea.cantidad);
    }
    return map;
  }, [detalles]);

  function elegirProducto(indice: number, codigo: string) {
    const producto = productos.find((item) => item.codigo === codigo);
    if (!producto) return;
    onDetalles(conFilaSiguiente(detalles.map((linea, idx) => (
      idx === indice
        ? {
            ...linea,
            codigoPrincipal: producto.codigo,
            descripcion: producto.nombre,
            precioUnitario: parseFloat(producto.precio_unitario) || 0,
            iva: producto.iva_porcentaje === 5 ? "3" : producto.iva_porcentaje === 15 ? "2" : "0",
          }
        : linea
    ))));
  }

  function cambiarDescripcion(indice: number, valor: string) {
    onDetalles(detalles.map((linea, idx) => {
      if (idx !== indice) return linea;
      const producto = productos.find((item) => item.codigo === linea.codigoPrincipal);
      const sigueSiendoElProducto = !producto || producto.nombre === valor;
      return {
        ...linea,
        descripcion: valor,
        codigoPrincipal: sigueSiendoElProducto ? linea.codigoPrincipal : "",
      };
    }));
  }

  function cambiarDescripcionAdicional(indice: number, valor: string) {
    onDetalles(detalles.map((linea, idx) => (
      idx === indice ? { ...linea, descripcionAdicional: valor } : linea
    )));
  }

  function cambiarNumero(indice: number, campo: "cantidad" | "precioUnitario" | "descuento", valor: string) {
    const numero = parseFloat(valor);
    onDetalles(detalles.map((linea, idx) => (
      idx === indice ? { ...linea, [campo]: Number.isFinite(numero) ? numero : 0 } : linea
    )));
  }

  const enInventario = (linea: DetalleItem) => productos.some((item) => item.codigo === linea.codigoPrincipal);
  const numeroClass = cn(control, "px-2 text-right tabular-nums");

  const columnas: ColumnaDetalle<DetalleItem>[] = [
    {
      id: "descripcion",
      header: "Producto / servicio",
      ancho: "min-w-[12rem]",
      render: (linea, indice) => (
        <>
          <label className="sr-only" htmlFor={`${baseId}-desc-${indice}`}>Producto o servicio de la línea {indice + 1}</label>
          <LineaProductoCombobox
            id={`${baseId}-desc-${indice}`}
            valor={linea.descripcion}
            productos={productos}
            idSiguiente={`${baseId}-adicional-${indice}`}
            onChange={(valor) => cambiarDescripcion(indice, valor)}
            onElegir={(codigo) => elegirProducto(indice, codigo)}
            onRegistrar={(nombre) => setRegistro({ indice, nombre })}
          />
        </>
      ),
    },
    {
      id: "adicional",
      header: "Desc. adicional",
      ancho: "min-w-[9rem]",
      render: (linea, indice) => (
        <>
          <label className="sr-only" htmlFor={`${baseId}-adicional-${indice}`}>Descripción adicional de la línea {indice + 1}</label>
          <Input
            id={`${baseId}-adicional-${indice}`}
            value={linea.descripcionAdicional ?? ""}
            maxLength={300}
            placeholder="Detalle opcional"
            onChange={(event) => cambiarDescripcionAdicional(indice, event.target.value)}
            className={control}
          />
        </>
      ),
    },
    {
      id: "cantidad",
      header: "Cant.",
      ancho: "w-20",
      align: "right",
      render: (linea, indice) => (
        <>
          <label className="sr-only" htmlFor={`${baseId}-cant-${indice}`}>Cantidad de la línea {indice + 1}</label>
          <Input
            id={`${baseId}-cant-${indice}`}
            type="text"
            inputMode="decimal"
            value={linea.cantidad}
            onFocus={seleccionarAlEnfocar}
            onMouseUp={evitarColapsarSeleccion}
            onChange={(event) => cambiarNumero(indice, "cantidad", event.target.value)}
            className={numeroClass}
          />
        </>
      ),
    },
    {
      id: "precio",
      header: "P. unitario",
      ancho: "w-28",
      align: "right",
      render: (linea, indice) => {
        const bloqueada = enInventario(linea);
        return (
          <>
            <label className="sr-only" htmlFor={`${baseId}-precio-${indice}`}>Precio unitario de la línea {indice + 1}</label>
            <Input id={`${baseId}-precio-${indice}`} type="text" inputMode="decimal" value={linea.precioUnitario} disabled={bloqueada} title={bloqueada ? "Precio definido en inventario" : undefined} onFocus={seleccionarAlEnfocar} onMouseUp={evitarColapsarSeleccion} onChange={(event) => cambiarNumero(indice, "precioUnitario", event.target.value)} className={numeroClass} />
          </>
        );
      },
    },
    {
      id: "descuento",
      header: "Descuento",
      ancho: "w-24",
      align: "right",
      render: (linea, indice) => {
        const exceso = linea.descuento > linea.cantidad * linea.precioUnitario;
        return (
          <>
            <label className="sr-only" htmlFor={`${baseId}-descnto-${indice}`}>Descuento de la línea {indice + 1}</label>
            <Input id={`${baseId}-descnto-${indice}`} type="text" inputMode="decimal" value={linea.descuento} aria-invalid={exceso} onFocus={seleccionarAlEnfocar} onMouseUp={evitarColapsarSeleccion} onChange={(event) => cambiarNumero(indice, "descuento", event.target.value)} className={cn(numeroClass, exceso && "border-brand-red")} />
          </>
        );
      },
    },
    {
      id: "iva",
      header: "Tarifa IVA",
      ancho: "w-36",
      render: (linea, indice) => {
        const bloqueada = enInventario(linea);
        return (
          <>
            <label className="sr-only" htmlFor={`${baseId}-iva-${indice}`}>Tarifa IVA de la línea {indice + 1}</label>
            <select
              id={`${baseId}-iva-${indice}`}
              value={linea.iva}
              disabled={bloqueada}
              title={bloqueada ? "IVA definido en inventario" : undefined}
              onChange={(event) => onDetalles(detalles.map((item, idx) => idx === indice ? { ...item, iva: event.target.value } : item))}
              className={control}
            >
              {COD_IVA.map((tarifa) => <option key={tarifa.value} value={tarifa.value}>{tarifa.label}</option>)}
            </select>
          </>
        );
      },
    },
  ];

  return (
    <ComprobanteLayout
      titulo="Nueva factura electrónica"
      miga="Nueva factura"
      pasos={pasos}
      ariaPasos="Pasos de la factura"
      onCambiarTipo={onCambiarTipo}
      onGuardarBorrador={BORRADOR_DISPONIBLE ? () => {} : undefined}
      onSubmit={() => {
        if (revision.puedeEmitir && !emitiendo && !resultado) onEmitir();
      }}
      resumen={
        <>
          <ResumenPanel
            ariaLabel="Resumen de la factura"
            tipo="FACTURA"
            numero={numeroComprobante(secuencial, serie, serieGuardada?.siguiente)}
            ambiente={ambiente}
            sujeto={{ nombre: razonSocial, identificacion, sinNombre: "Cliente sin definir", sinIdentificacion: "Completa el paso 2" }}
          >
            <ResumenFilas>
              <ResumenFila label="Subtotal 15%" valor={desglose.subtotal15} />
              {desglose.subtotal5 > 0 && <ResumenFila label="Subtotal 5%" valor={desglose.subtotal5} />}
              <ResumenFila label="Subtotal 0%" valor={desglose.subtotal0} />
              {desglose.noObjeto > 0 && <ResumenFila label="No objeto" valor={desglose.noObjeto} />}
              {desglose.exento > 0 && <ResumenFila label="Exento" valor={desglose.exento} />}
              {desglose.descuento > 0 && <ResumenFila label="Descuentos" valor={desglose.descuento} />}
              <ResumenFila label="IVA 15%" valor={desglose.iva15} />
              {desglose.iva5 > 0 && <ResumenFila label="IVA 5%" valor={desglose.iva5} />}
              {desglose.propina > 0 && <ResumenFila label="Propina" valor={desglose.propina} />}
            </ResumenFilas>
            <ResumenTotal
              label="Total a pagar"
              valor={desglose.total}
              detalle={<>Pago: {pagoTitulo(formaPago)} · {plazo <= 0 ? "de contado" : `a ${plazo} días`}</>}
            />
          </ResumenPanel>

          <ChecklistEmision n={5} checklist={checklist}>
            <AccionEmitir
              listo={revision.puedeEmitir}
              emitiendo={emitiendo}
              resultado={resultado}
              textoListo={`Emitir factura · ${money(desglose.total)}`}
              textoOtra="Emitir otra factura"
              onOtra={onOtra}
              extra={VISTA_PREVIA_RIDE_DISPONIBLE && (
                <Button type="button" variant="outline" className="mt-2 h-9 w-full rounded-lg">
                  Vista previa del RIDE
                </Button>
              )}
            />
          </ChecklistEmision>
        </>
      }
    >
      <DatosComprobanteSection
        n={1}
        ayuda="Establecimiento, número y fecha de esta emisión."
        completa={revision.comprobante}
        tipo="01"
        emisorRuc={emisorRuc}
        fechaEmision={fechaEmision}
        onFechaEmision={onFechaEmision}
        serieEmision={serieEmision}
        onSerieEmision={onSerieEmision}
        onSerieInfo={(info) => {
          setSerieGuardada(info);
          if (info) onAmbiente(info.ambiente);
        }}
        refresco={resultado?.claveAcceso}
        secuencial={secuencial}
        onSecuencial={onSecuencial}
        ambiente={ambiente}
        avisoAmbiente={AVISO_AMBIENTE}
      />

      <IdentificacionSection
        n={2}
        titulo="¿A quién le facturas?"
        ayuda="Busca por nombre, RUC o cédula. Si no está, pulsa + para agregarlo. Si no pide factura con datos, usa Consumidor final."
        completa={revision.cliente}
        fuente="cliente"
        contactos={contactos}
        onSeleccionarContacto={onSeleccionarContacto}
        onContactoCreado={onContactoCreado}
        tiposPermitidos={TIPOS_IDENTIFICACION}
        tipoId={tipoId}
        onTipoId={elegirTipo}
        validar={validarIdentificacionFactura}
        identificacion={identificacion}
        onIdentificacion={onIdentificacion}
        razonSocial={razonSocial}
        onRazonSocial={onRazonSocial}
        email={email}
        onEmail={onEmail}
        guardar={{ label: "Guardar como cliente para próximas facturas", checked: guardarCliente, onChange: onGuardarCliente }}
        sustituto={esConsumidor ? (
          <div className={cn("mt-3 rounded-lg border px-3 py-2.5 text-[13px]", tono.info)}>
            <p>Se usará {ID_CONSUMIDOR_FINAL} · {NOMBRE_CONSUMIDOR_FINAL}.</p>
            <p className="mt-1">El monto de una factura a consumidor final no puede superar {money(TOPE_CONSUMIDOR_FINAL)}.</p>
            {revision.consumidorFinalExcedido && (
              <p className="mt-2 font-semibold" role="alert">
                Esta factura suma {money(totales.total)} y supera el tope. Usa RUC, cédula o pasaporte.
              </p>
            )}
          </div>
        ) : undefined}
      />

      <SeccionCard
        n={3}
        titulo="¿Qué estás vendiendo?"
        ayuda="Agrega productos o servicios. El IVA se calcula por línea según la tarifa que elijas."
        completa={revision.productos}
        accion={
          <Button
            ref={inventarioBtnRef}
            type="button"
            variant="outline"
            aria-expanded={inventarioAbierto}
            aria-haspopup="dialog"
            onClick={() => setInventarioAbierto((abierto) => !abierto)}
            className={cn(boton.secundario, "shrink-0 px-3")}
          >
            <Search className="size-4" aria-hidden />
            Buscar en inventario
          </Button>
        }
      >
        <InventarioPicker
          open={inventarioAbierto}
          productos={productos}
          cantidades={cantidadesInventario}
          anchorRef={inventarioBtnRef}
          onAgregar={onAgregarProducto}
          onCerrar={() => setInventarioAbierto(false)}
        />
        <DetalleTable
          filas={detalles}
          columnas={columnas}
          subtotal={subtotalLinea}
          minWidth="min-w-[920px]"
          onAgregar={onAgregarLinea}
          onEliminar={onEliminarLinea}
          nota={detalles.some((linea) => linea.descripcion.trim() && !linea.codigoPrincipal.trim()) && (
            <p className="mt-2 text-xs text-brand-gray-500">Pulsa Enter para elegir el producto, o para registrarlo si todavía no está en inventario.</p>
          )}
          pie={<>{detalles.length === 1 ? "1 línea" : `${detalles.length} líneas`} · Descuento en dólares por línea</>}
        />
        <ProductoRapidoDialog
          open={registro !== null}
          nombreInicial={registro?.nombre ?? ""}
          precioInicial={registro ? detalles[registro.indice]?.precioUnitario : undefined}
          tarifaInicial={registro ? (COD_IVA.find((item) => item.value === detalles[registro.indice]?.iva)?.tarifa) : undefined}
          onCerrar={() => setRegistro(null)}
          onCreado={(producto) => {
            if (!registro) return;
            onProductoCreado(producto, registro.indice);
            setRegistro(null);
          }}
        />
        <Campo
          id={`${baseId}-obs`}
          label="Observaciones"
          hint="Opcional. Sale al pie de la factura en el RIDE y el XML."
          className="mt-3"
        >
          <textarea
            id={`${baseId}-obs`}
            value={observaciones}
            maxLength={300}
            rows={2}
            onChange={(event) => onObservaciones(event.target.value)}
            placeholder="Ej. Entrega en bodega, orden de compra 123…"
            className={cn(control, "h-auto min-h-[4.5rem] resize-y py-2")}
          />
        </Campo>
      </SeccionCard>

      <SeccionCard
        n={4}
        titulo="¿Cómo te pagan?"
        ayuda="La forma de pago se reporta al SRI con su código. Desde $500 el pago debe hacerse por el sistema financiero para sustentar crédito tributario."
        completa={revision.pago && !revision.consumidorFinalExcedido}
      >
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <Campo
            id={`${baseId}-pago`}
            label="Forma de pago"
            requerido
            hint={PAGO_PRESENTACION[formaPago]?.descripcion}
          >
            <select
              id={`${baseId}-pago`}
              required
              value={formaPago}
              onChange={(event) => onFormaPago(event.target.value)}
              className={control}
            >
              {ORDEN_FORMA_PAGO.map((codigo) => (
                <option key={codigo} value={codigo}>
                  {PAGO_PRESENTACION[codigo].titulo} · SRI {codigo}
                </option>
              ))}
            </select>
          </Campo>
          <div>
            <Label htmlFor={`${baseId}-plazo`} className="text-[13px] text-brand-gray-700">Plazo de pago</Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label="Plazos frecuentes" className="flex flex-wrap gap-2">
                {PLAZOS.map((dias) => {
                  const activo = plazo === dias;
                  return (
                    <button
                      key={dias}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => onPlazo(dias)}
                      className={cn(chip.base, activo ? chip.activo : chip.inactivo)}
                    >
                      {dias === 0 ? "Contado" : `${dias} días`}
                    </button>
                  );
                })}
              </div>
              <Input
                id={`${baseId}-plazo`}
                type="number"
                min={0}
                value={plazo}
                onChange={(event) => onPlazo(parseInt(event.target.value, 10) || 0)}
                aria-describedby={`${baseId}-plazo-hint`}
                className={cn(control, "w-24 text-right tabular-nums")}
              />
            </div>
            <p id={`${baseId}-plazo-hint`} className="mt-1.5 text-[11px] leading-snug text-brand-gray-500">
              {plazo <= 0 ? "El cliente paga al momento." : `El cliente paga en ${plazo} días.`}
            </p>
          </div>
        </div>
        {revision.advertenciaBancarizacion && (
          <p role="status" className={cn("mt-3 flex gap-2 rounded-lg border px-3 py-2 text-[13px]", tono.aviso)}>
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>El total es de {money(totales.total)}, igual o mayor a {money(UMBRAL_BANCARIZACION)}. Efectivo (SRI 01) no usa el sistema financiero. Conviene transferencia, depósito o tarjeta.</span>
          </p>
        )}
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-brand-gray-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              role="switch"
              aria-checked={propinaAutomatica}
              onClick={() => {
                const siguiente = !propinaAutomatica;
                setPropinaAutomatica(siguiente);
                onPropina(siguiente ? propinaDiezPorciento(totales.sinImp) : 0);
              }}
              className="flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-brand-red"
            >
              <span className={cn("relative h-6 w-11 rounded-full transition-colors", propinaAutomatica ? "bg-brand-red" : "bg-brand-gray-300")}>
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-transform", propinaAutomatica ? "translate-x-5" : "translate-x-0.5")} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-brand-gray-900">Propina / servicio 10%</span>
                <span className="block text-xs text-brand-gray-500">Sobre el subtotal sin impuestos. Se envía en el campo propina, sin IVA.</span>
              </span>
            </button>
          </div>
          <div>
            <label className="sr-only" htmlFor={`${baseId}-propina`}>Propina</label>
            <Input
              id={`${baseId}-propina`}
              type="number"
              min={0}
              step="0.01"
              value={propina}
              onChange={(event) => {
                setPropinaAutomatica(false);
                onPropina(parseFloat(event.target.value) || 0);
              }}
              className={cn(control, "w-28 text-right tabular-nums")}
            />
          </div>
        </div>
      </SeccionCard>
    </ComprobanteLayout>
  );
}
