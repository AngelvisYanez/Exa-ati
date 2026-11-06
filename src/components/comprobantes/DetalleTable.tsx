import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { foco, money } from "./tokens";

export interface ColumnaDetalle<T> {
  id: string;
  header: string;
  /** Clase de ancho de la columna, p. ej. "w-28". */
  ancho?: string;
  align?: "left" | "right";
  render: (fila: T, indice: number) => ReactNode;
}

interface DetalleTableProps<T> {
  filas: readonly T[];
  columnas: readonly ColumnaDetalle<T>[];
  /** Agrega la columna Subtotal (alineada a la derecha) antes de la de eliminar. */
  subtotal?: (fila: T) => number;
  onAgregar: () => void;
  onEliminar: (indice: number) => void;
  /** Cantidad mínima de líneas que no se pueden eliminar. */
  minimo?: number;
  /** Ancho mínimo de la tabla antes de que aparezca el scroll horizontal. */
  minWidth?: string;
  etiquetaAgregar?: string;
  /** Se muestra en lugar de la tabla cuando no hay filas. */
  vacio?: ReactNode;
  /** Nota entre la tabla y el pie. */
  nota?: ReactNode;
  /** Texto a la derecha de "Agregar línea". */
  pie?: ReactNode;
}

export default function DetalleTable<T>({
  filas, columnas, subtotal, onAgregar, onEliminar, minimo = 1, minWidth = "min-w-[760px]",
  etiquetaAgregar = "Agregar línea", vacio, nota, pie,
}: DetalleTableProps<T>) {
  return (
    <>
      {filas.length === 0 && vacio ? vacio : (
        <div className="min-w-0 overflow-x-auto">
          <table className={cn("w-full border-separate border-spacing-y-2 text-sm", minWidth)}>
            <thead>
              <tr className="text-left text-[10px] font-semibold tracking-wide text-brand-gray-500 uppercase">
                <th className="w-8 px-1 font-semibold">#</th>
                {columnas.map((col) => (
                  <th key={col.id} className={cn(col.ancho, "px-1", col.align === "right" && "text-right", "font-semibold")}>
                    {col.header}
                  </th>
                ))}
                {subtotal && <th className="w-24 px-1 text-right font-semibold">Subtotal</th>}
                <th className="w-10 px-1"><span className="sr-only">Eliminar</span></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, indice) => (
                <tr key={indice}>
                  <td className="px-1 text-brand-gray-400 tabular-nums">{indice + 1}</td>
                  {columnas.map((col) => (
                    <td key={col.id} className="px-1">{col.render(fila, indice)}</td>
                  ))}
                  {subtotal && <td className="px-1 text-right font-semibold tabular-nums">{money(subtotal(fila))}</td>}
                  <td className="px-1">
                    <button
                      type="button"
                      onClick={() => onEliminar(indice)}
                      disabled={filas.length <= minimo}
                      aria-label={`Eliminar línea ${indice + 1}`}
                      className="flex size-11 items-center justify-center rounded-[10px] text-brand-gray-400 hover:bg-brand-red-subtle hover:text-brand-red disabled:pointer-events-none disabled:opacity-30"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nota}
      <div className="mt-2 flex items-center justify-between gap-3">
        <button type="button" onClick={onAgregar} className={cn("inline-flex h-11 items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-brand-red hover:bg-brand-red-subtle", foco)}>
          <Plus className="size-4" aria-hidden />
          {etiquetaAgregar}
        </button>
        {pie && <p className="text-xs text-brand-gray-500">{pie}</p>}
      </div>
    </>
  );
}
