import { db } from "@/services/sri-api/db";

export { isMetodoCodigo, slugifyMetodoCodigo } from "@/lib/metodos-pago";

export interface MetodoPagoRow {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  esSistema: boolean;
  usoOperativo: boolean;
  usoSuscripcion: boolean;
}

function mapRow(r: {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number | string;
  activo: boolean | number;
  es_sistema: boolean | number;
  uso_operativo: boolean | number;
  uso_suscripcion: boolean | number;
}): MetodoPagoRow {
  return {
    codigo: r.codigo,
    nombre: r.nombre,
    descripcion: r.descripcion,
    orden: Number(r.orden),
    activo: Boolean(r.activo),
    esSistema: Boolean(r.es_sistema),
    usoOperativo: Boolean(r.uso_operativo),
    usoSuscripcion: Boolean(r.uso_suscripcion),
  };
}

const FALLBACK_OPERATIVO: MetodoPagoRow[] = [
  { codigo: "EFECTIVO", nombre: "Efectivo", descripcion: null, orden: 10, activo: true, esSistema: true, usoOperativo: true, usoSuscripcion: false },
  { codigo: "TRANSFERENCIA", nombre: "Transferencia", descripcion: null, orden: 20, activo: true, esSistema: true, usoOperativo: true, usoSuscripcion: true },
  { codigo: "CHEQUE", nombre: "Cheque", descripcion: null, orden: 30, activo: true, esSistema: true, usoOperativo: true, usoSuscripcion: false },
  { codigo: "TARJETA", nombre: "Tarjeta", descripcion: null, orden: 40, activo: true, esSistema: true, usoOperativo: true, usoSuscripcion: false },
  { codigo: "DEPOSITO", nombre: "Depósito", descripcion: null, orden: 50, activo: true, esSistema: true, usoOperativo: true, usoSuscripcion: false },
  { codigo: "BANCO", nombre: "Banco", descripcion: null, orden: 60, activo: true, esSistema: true, usoOperativo: true, usoSuscripcion: false },
  { codigo: "OTRO", nombre: "Otro", descripcion: null, orden: 90, activo: true, esSistema: true, usoOperativo: true, usoSuscripcion: false },
];

const FALLBACK_SUSCRIPCION: MetodoPagoRow[] = [
  { codigo: "PAYPHONE", nombre: "PayPhone", descripcion: null, orden: 5, activo: true, esSistema: true, usoOperativo: false, usoSuscripcion: true },
  { codigo: "TRANSFERENCIA", nombre: "Transferencia", descripcion: null, orden: 20, activo: true, esSistema: true, usoOperativo: true, usoSuscripcion: true },
  { codigo: "CORTESIA", nombre: "Cortesía", descripcion: null, orden: 100, activo: true, esSistema: true, usoOperativo: false, usoSuscripcion: true },
];

export async function listMetodosPago(opts?: {
  includeInactive?: boolean;
  uso?: "operativo" | "suscripcion" | "all";
}): Promise<MetodoPagoRow[]> {
  const uso = opts?.uso || "all";
  try {
    const clauses: string[] = [];
    if (!opts?.includeInactive) clauses.push("activo = true");
    if (uso === "operativo") clauses.push("uso_operativo = true");
    if (uso === "suscripcion") clauses.push("uso_suscripcion = true");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await db.queryAll<{
      codigo: string;
      nombre: string;
      descripcion: string | null;
      orden: number | string;
      activo: boolean | number;
      es_sistema: boolean | number;
      uso_operativo: boolean | number;
      uso_suscripcion: boolean | number;
    }>(
      `SELECT codigo, nombre, descripcion, orden, activo, es_sistema, uso_operativo, uso_suscripcion
       FROM metodos_pago ${where}
       ORDER BY orden ASC, nombre ASC`
    );
    if (rows.length > 0) return rows.map(mapRow);
  } catch (err) {
    console.warn("[metodos-pago] list fallback:", err);
  }

  if (uso === "suscripcion") return FALLBACK_SUSCRIPCION;
  if (uso === "operativo") return FALLBACK_OPERATIVO;
  return [
    ...FALLBACK_OPERATIVO,
    ...FALLBACK_SUSCRIPCION.filter((m) => m.codigo === "PAYPHONE" || m.codigo === "CORTESIA"),
  ];
}
