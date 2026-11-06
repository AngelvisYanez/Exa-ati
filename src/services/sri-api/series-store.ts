import { db } from "@/services/sri-api/db";
import {
  TIPOS_COMPROBANTE_SERIE,
  esTipoComprobanteSerie,
  normalizarCodigoSerie,
  normalizarUltimo,
  siguienteDe,
  type TipoComprobanteSerie,
} from "@/lib/series-comprobante";

export interface PuntoAutorizado {
  puntoEmision: string;
  ultimo: number;
  siguiente: string;
}

export interface TipoAutorizado {
  tipo: TipoComprobanteSerie;
  nombre: string;
  puntos: PuntoAutorizado[];
}

export interface EstablecimientoAutorizado {
  codigo: string;
  direccion: string;
  ciudad: string;
  telefonos: string;
  ambiente: AmbienteSri;
  tipos: TipoAutorizado[];
}

export interface AutorizacionesEmision {
  ruc: string;
  establecimientos: EstablecimientoAutorizado[];
}

export interface EstablecimientoEntrada {
  codigo: string;
  codigoAnterior?: string;
  direccion?: string;
  ciudad?: string;
  telefonos?: string;
  ambiente?: string;
  tipos: { tipo: string; puntos: { puntoEmision: string; ultimo: number }[] }[];
}

export class AutorizacionInvalida extends Error {}

/** 1 = Pruebas, 2 = Producción (código de ambiente del SRI). */
export type AmbienteSri = "1" | "2";

export function normalizarAmbiente(value: unknown): AmbienteSri | null {
  const texto = String(value ?? "").trim();
  return texto === "1" || texto === "2" ? texto : null;
}

const usesPostgres = Boolean(process.env.DATABASE_URL);
const SERIE = /^(\d{3})-(\d{3})$/;

let tablaLista: Promise<void> | null = null;

export function ensureEstablecimientosTable(): Promise<void> {
  if (!tablaLista) {
    const sql = usesPostgres
      ? `CREATE TABLE IF NOT EXISTS establecimientos_emisor (
           emisor_id UUID NOT NULL,
           codigo VARCHAR(3) NOT NULL,
           direccion VARCHAR(300),
           ciudad VARCHAR(120),
           telefonos VARCHAR(120),
           ambiente VARCHAR(1),
           created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
           updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
           PRIMARY KEY (emisor_id, codigo)
         )`
      : `CREATE TABLE IF NOT EXISTS establecimientos_emisor (
           emisor_id CHAR(36) NOT NULL,
           codigo VARCHAR(3) NOT NULL,
           direccion VARCHAR(300) NULL,
           ciudad VARCHAR(120) NULL,
           telefonos VARCHAR(120) NULL,
           ambiente VARCHAR(1) NULL,
           created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
           updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
           PRIMARY KEY (emisor_id, codigo)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
    const agregarAmbiente = () => (usesPostgres
      ? db.query(`ALTER TABLE establecimientos_emisor ADD COLUMN IF NOT EXISTS ambiente VARCHAR(1)`)
      : db.query(`ALTER TABLE establecimientos_emisor ADD COLUMN ambiente VARCHAR(1) NULL`).catch((error: unknown) => {
          if (!/duplicate column/i.test(error instanceof Error ? error.message : String(error))) throw error;
        }));
    tablaLista = db.query(sql).then(agregarAmbiente).then(() => undefined).catch((error: unknown) => {
      tablaLista = null;
      throw error;
    });
  }
  return tablaLista;
}

function partesDeSerie(serie: string): { establecimiento: string; puntoEmision: string } | null {
  const match = SERIE.exec(serie);
  return match ? { establecimiento: match[1], puntoEmision: match[2] } : null;
}

function texto(value: string | undefined, max: number): string | null {
  const limpio = (value ?? "").trim().slice(0, max);
  return limpio || null;
}

export async function leerAutorizaciones(
  emisorId: string,
  ruc: string,
  establecimientoPrincipal: string,
  puntoPorDefecto: string,
  ambienteEmisor: string | null,
): Promise<AutorizacionesEmision> {
  await ensureEstablecimientosTable();
  const principal = normalizarCodigoSerie(establecimientoPrincipal) || "001";
  const defecto = normalizarCodigoSerie(puntoPorDefecto) || "001";
  const ambientePorDefecto = normalizarAmbiente(ambienteEmisor) ?? "1";

  const [datos, filas] = await Promise.all([
    db.queryAll<{
      codigo: string;
      direccion: string | null;
      ciudad: string | null;
      telefonos: string | null;
      ambiente: string | null;
    }>(
      `SELECT codigo, direccion, ciudad, telefonos, ambiente FROM establecimientos_emisor WHERE emisor_id = $1`,
      [emisorId],
    ),
    db.queryAll<{ tipo_comprobante: string; serie: string; ultimo_secuencial: number }>(
      `SELECT tipo_comprobante, serie, ultimo_secuencial FROM secuenciales WHERE emisor_id = $1 ORDER BY serie ASC`,
      [emisorId],
    ),
  ]);

  const codigos = new Set<string>([principal]);
  for (const fila of datos) codigos.add(fila.codigo);
  const puntos = new Map<string, PuntoAutorizado[]>();
  for (const fila of filas) {
    const partes = partesDeSerie(fila.serie);
    if (!partes || !esTipoComprobanteSerie(fila.tipo_comprobante)) continue;
    codigos.add(partes.establecimiento);
    const clave = `${partes.establecimiento}|${fila.tipo_comprobante}`;
    const ultimo = Number(fila.ultimo_secuencial) || 0;
    const lista = puntos.get(clave) ?? [];
    lista.push({ puntoEmision: partes.puntoEmision, ultimo, siguiente: siguienteDe(ultimo) });
    puntos.set(clave, lista);
  }

  const porCodigo = new Map(datos.map((fila) => [fila.codigo, fila]));
  const orden = [principal, ...[...codigos].filter((codigo) => codigo !== principal).sort()];

  return {
    ruc,
    establecimientos: orden.map((codigo) => {
      const fila = porCodigo.get(codigo);
      return {
        codigo,
        direccion: fila?.direccion ?? "",
        ciudad: fila?.ciudad ?? "",
        telefonos: fila?.telefonos ?? "",
        ambiente: normalizarAmbiente(fila?.ambiente) ?? ambientePorDefecto,
        tipos: TIPOS_COMPROBANTE_SERIE.map((item) => ({
          tipo: item.tipo,
          nombre: item.nombre,
          puntos: puntos.get(`${codigo}|${item.tipo}`)
            ?? [{ puntoEmision: codigo === principal ? defecto : "001", ultimo: 0, siguiente: siguienteDe(0) }],
        })),
      };
    }),
  };
}

export interface ConfigEstablecimiento {
  direccion: string | null;
  ambiente: AmbienteSri | null;
}

/** Dirección y ambiente guardados del establecimiento, para emitir. */
export async function configEstablecimiento(emisorId: string, codigo: string): Promise<ConfigEstablecimiento> {
  await ensureEstablecimientosTable();
  const fila = await db.queryOne<{ direccion: string | null; ciudad: string | null; ambiente: string | null }>(
    `SELECT direccion, ciudad, ambiente FROM establecimientos_emisor WHERE emisor_id = $1 AND codigo = $2`,
    [emisorId, codigo],
  );
  const ambiente = normalizarAmbiente(fila?.ambiente);
  const direccion = fila?.direccion?.trim();
  if (!direccion) return { direccion: null, ambiente };
  const ciudad = fila?.ciudad?.trim();
  const completa = ciudad && !direccion.toLowerCase().includes(ciudad.toLowerCase())
    ? `${direccion}, ${ciudad}`
    : direccion;
  return { direccion: completa.slice(0, 300), ambiente };
}

async function guardarUltimo(emisorId: string, tipo: string, serie: string, ultimo: number): Promise<void> {
  if (usesPostgres) {
    await db.query(
      `INSERT INTO secuenciales (emisor_id, tipo_comprobante, serie, ultimo_secuencial, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (emisor_id, tipo_comprobante, serie)
       DO UPDATE SET ultimo_secuencial = EXCLUDED.ultimo_secuencial, updated_at = NOW()`,
      [emisorId, tipo, serie, ultimo],
    );
    return;
  }
  await db.query(
    `INSERT INTO secuenciales (emisor_id, tipo_comprobante, serie, ultimo_secuencial, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON DUPLICATE KEY UPDATE ultimo_secuencial = VALUES(ultimo_secuencial), updated_at = NOW()`,
    [emisorId, tipo, serie, ultimo],
  );
}

interface DatosEstablecimiento {
  direccion: string | null;
  ciudad: string | null;
  telefonos: string | null;
  ambiente: AmbienteSri;
}

async function guardarDatosEstablecimiento(emisorId: string, codigo: string, datos: DatosEstablecimiento): Promise<void> {
  const valores = [emisorId, codigo, datos.direccion, datos.ciudad, datos.telefonos, datos.ambiente];
  if (usesPostgres) {
    await db.query(
      `INSERT INTO establecimientos_emisor (emisor_id, codigo, direccion, ciudad, telefonos, ambiente, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (emisor_id, codigo)
       DO UPDATE SET direccion = EXCLUDED.direccion, ciudad = EXCLUDED.ciudad,
                     telefonos = EXCLUDED.telefonos, ambiente = EXCLUDED.ambiente, updated_at = NOW()`,
      valores,
    );
    return;
  }
  await db.query(
    `INSERT INTO establecimientos_emisor (emisor_id, codigo, direccion, ciudad, telefonos, ambiente, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON DUPLICATE KEY UPDATE direccion = VALUES(direccion), ciudad = VALUES(ciudad),
                             telefonos = VALUES(telefonos), ambiente = VALUES(ambiente), updated_at = NOW()`,
    valores,
  );
}

function validarEntrada(establecimientos: EstablecimientoEntrada[]) {
  if (establecimientos.length === 0) {
    throw new AutorizacionInvalida("Debe quedar al menos un establecimiento.");
  }
  const codigos = new Set<string>();
  return establecimientos.map((estab) => {
    const codigo = normalizarCodigoSerie(estab.codigo);
    if (!codigo) throw new AutorizacionInvalida("Cada establecimiento debe tener de 1 a 3 dígitos, distinto de 000.");
    if (codigos.has(codigo)) throw new AutorizacionInvalida(`El establecimiento ${codigo} está repetido.`);
    codigos.add(codigo);
    const ambiente = normalizarAmbiente(estab.ambiente);
    if (!ambiente) throw new AutorizacionInvalida(`Elige Producción o Pruebas para el establecimiento ${codigo}.`);
    const tipos = estab.tipos.filter((item) => esTipoComprobanteSerie(item.tipo)).map((item) => {
      const vistos = new Set<string>();
      const puntos = item.puntos.map((punto) => {
        const puntoEmision = normalizarCodigoSerie(punto.puntoEmision);
        const ultimo = normalizarUltimo(punto.ultimo);
        if (!puntoEmision || ultimo === null) {
          throw new AutorizacionInvalida("Cada punto de emisión y cada último número deben ser válidos.");
        }
        if (vistos.has(puntoEmision)) {
          throw new AutorizacionInvalida(`El punto ${puntoEmision} está repetido en el establecimiento ${codigo}.`);
        }
        vistos.add(puntoEmision);
        return { puntoEmision, ultimo };
      });
      return { tipo: item.tipo, puntos };
    });
    return {
      codigo,
      anterior: normalizarCodigoSerie(estab.codigoAnterior ?? "") || null,
      direccion: texto(estab.direccion, 300),
      ciudad: texto(estab.ciudad, 120),
      telefonos: texto(estab.telefonos, 120),
      ambiente,
      tipos,
    };
  });
}

export async function guardarAutorizaciones(
  emisorId: string,
  tenantId: string,
  establecimientos: EstablecimientoEntrada[],
): Promise<void> {
  await ensureEstablecimientosTable();
  const limpios = validarEntrada(establecimientos);

  const anteriores = new Set(limpios.flatMap((estab) => (estab.anterior ? [estab.anterior] : [])));
  for (const estab of limpios) {
    if (estab.anterior && estab.anterior !== estab.codigo && anteriores.has(estab.codigo)) {
      throw new AutorizacionInvalida(`No se puede pasar ${estab.anterior} a ${estab.codigo} porque ese código ya existe. Cámbialo en dos pasos.`);
    }
  }

  const existentes = await db.queryAll<{ tipo_comprobante: string; serie: string }>(
    `SELECT tipo_comprobante, serie FROM secuenciales WHERE emisor_id = $1`,
    [emisorId],
  );
  const guardados = await db.queryAll<{ codigo: string }>(
    `SELECT codigo FROM establecimientos_emisor WHERE emisor_id = $1`,
    [emisorId],
  );

  for (const estab of limpios) {
    if (!estab.anterior || estab.anterior === estab.codigo) continue;
    for (const fila of existentes) {
      const partes = partesDeSerie(fila.serie);
      if (partes?.establecimiento !== estab.anterior) continue;
      await db.query(
        `UPDATE secuenciales SET serie = $1, updated_at = NOW()
         WHERE emisor_id = $2 AND tipo_comprobante = $3 AND serie = $4`,
        [`${estab.codigo}-${partes.puntoEmision}`, emisorId, fila.tipo_comprobante, fila.serie],
      );
    }
    await db.query(
      `DELETE FROM establecimientos_emisor WHERE emisor_id = $1 AND codigo = $2`,
      [emisorId, estab.anterior],
    );
  }

  const conservados = new Set(limpios.flatMap((estab) => [estab.codigo, estab.anterior ?? estab.codigo]));
  const quitados = new Set<string>();
  for (const fila of existentes) {
    const codigo = partesDeSerie(fila.serie)?.establecimiento;
    if (codigo && !conservados.has(codigo)) quitados.add(codigo);
  }
  for (const fila of guardados) {
    if (!conservados.has(fila.codigo)) quitados.add(fila.codigo);
  }
  for (const codigo of quitados) {
    await db.query(`DELETE FROM secuenciales WHERE emisor_id = $1 AND serie LIKE $2`, [emisorId, `${codigo}-%`]);
    await db.query(`DELETE FROM establecimientos_emisor WHERE emisor_id = $1 AND codigo = $2`, [emisorId, codigo]);
  }

  for (const estab of limpios) {
    await guardarDatosEstablecimiento(emisorId, estab.codigo, {
      direccion: estab.direccion,
      ciudad: estab.ciudad,
      telefonos: estab.telefonos,
      ambiente: estab.ambiente,
    });
    for (const tipo of estab.tipos) {
      const series = new Set(tipo.puntos.map((punto) => `${estab.codigo}-${punto.puntoEmision}`));
      const actuales = await db.queryAll<{ serie: string }>(
        `SELECT serie FROM secuenciales WHERE emisor_id = $1 AND tipo_comprobante = $2 AND serie LIKE $3`,
        [emisorId, tipo.tipo, `${estab.codigo}-%`],
      );
      for (const fila of actuales) {
        if (!series.has(fila.serie)) {
          await db.query(
            `DELETE FROM secuenciales WHERE emisor_id = $1 AND tipo_comprobante = $2 AND serie = $3`,
            [emisorId, tipo.tipo, fila.serie],
          );
        }
      }
      for (const punto of tipo.puntos) {
        await guardarUltimo(emisorId, tipo.tipo, `${estab.codigo}-${punto.puntoEmision}`, punto.ultimo);
      }
    }
  }

  const principal = limpios[0];
  const primerPuntoFactura = principal.tipos.find((item) => item.tipo === "01")?.puntos[0]?.puntoEmision;
  await db.query(
    `UPDATE emisores
     SET establecimiento = $1,
         punto_emision = COALESCE($2, punto_emision),
         ambiente = $3,
         updated_at = NOW()
     WHERE id = $4 AND tenant_id = $5 AND activo = true`,
    [principal.codigo, primerPuntoFactura ?? null, principal.ambiente, emisorId, tenantId],
  );
}

/** Reserva el siguiente número de la serie e incrementa el último emitido. */
export async function tomarSiguienteSecuencial(emisorId: string, tipo: string, serie: string): Promise<string> {
  return db.transaction(async (client) => {
    if (usesPostgres) {
      await client.query(
        `INSERT INTO secuenciales (emisor_id, tipo_comprobante, serie, ultimo_secuencial, created_at, updated_at)
         VALUES ($1, $2, $3, 1, NOW(), NOW())
         ON CONFLICT (emisor_id, tipo_comprobante, serie)
         DO UPDATE SET ultimo_secuencial = secuenciales.ultimo_secuencial + 1, updated_at = NOW()`,
        [emisorId, tipo, serie],
      );
      const res = await client.query(
        `SELECT ultimo_secuencial FROM secuenciales
         WHERE emisor_id = $1 AND tipo_comprobante = $2 AND serie = $3`,
        [emisorId, tipo, serie],
      );
      return String(res.rows[0].ultimo_secuencial).padStart(9, "0");
    }

    await client.query(
      `INSERT INTO secuenciales (emisor_id, tipo_comprobante, serie, ultimo_secuencial, created_at, updated_at)
       VALUES (?, ?, ?, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE ultimo_secuencial = ultimo_secuencial + 1, updated_at = NOW()`,
      [emisorId, tipo, serie],
    );
    const [rows] = await client.query(
      `SELECT ultimo_secuencial FROM secuenciales
       WHERE emisor_id = ? AND tipo_comprobante = ? AND serie = ?`,
      [emisorId, tipo, serie],
    );
    return String((rows as { ultimo_secuencial: number }[])[0].ultimo_secuencial).padStart(9, "0");
  });
}

/** Si esta emisión usó un número escrito a mano, el contador no puede quedar por debajo. */
export async function registrarSecuencialUsado(emisorId: string, tipo: string, serie: string, usado: number): Promise<void> {
  if (!Number.isInteger(usado) || usado < 1) return;
  if (usesPostgres) {
    await db.query(
      `INSERT INTO secuenciales (emisor_id, tipo_comprobante, serie, ultimo_secuencial, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (emisor_id, tipo_comprobante, serie)
       DO UPDATE SET ultimo_secuencial = GREATEST(secuenciales.ultimo_secuencial, EXCLUDED.ultimo_secuencial), updated_at = NOW()`,
      [emisorId, tipo, serie, usado],
    );
    return;
  }
  await db.query(
    `INSERT INTO secuenciales (emisor_id, tipo_comprobante, serie, ultimo_secuencial, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON DUPLICATE KEY UPDATE ultimo_secuencial = GREATEST(ultimo_secuencial, VALUES(ultimo_secuencial)), updated_at = NOW()`,
    [emisorId, tipo, serie, usado],
  );
}
