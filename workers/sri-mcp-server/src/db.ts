import { neon } from '@neondatabase/serverless';

export interface ComprobanteInsert {
  claveAcceso: string;
  tipo: string;
  emisorRuc: string;
  emisorRazonSocial: string;
  fechaEmision: string | null;
  xmlContent: string;
  pdfBase64: string;
  tenantId: string | null;
  receptorIdentificacion: string;
}

export interface SyncResult {
  processed: number;
  updated: number;
  imported: number;
  errors: number;
}

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);

  return {
    async saveComprobante(data: ComprobanteInsert): Promise<string | null> {
      try {
        const rows = await sql`
          INSERT INTO comprobantes (
            clave_acceso, tipo, estado, emisor_ruc, emisor_razon_social,
            receptor_identificacion, tenant_id, fecha_emision, categoria
          ) VALUES (
            ${data.claveAcceso}, ${data.tipo}, 'AUTORIZADO',
            ${data.emisorRuc || ''}, ${data.emisorRazonSocial || ''},
            ${data.receptorIdentificacion}, ${data.tenantId},
            ${data.fechaEmision ? data.fechaEmision.split('T')[0] : null}::date, 'Otros'
          )
          ON CONFLICT (clave_acceso) DO UPDATE SET
            estado = EXCLUDED.estado,
            emisor_ruc = COALESCE(NULLIF(EXCLUDED.emisor_ruc, ''), comprobantes.emisor_ruc),
            emisor_razon_social = COALESCE(NULLIF(EXCLUDED.emisor_razon_social, ''), comprobantes.emisor_razon_social),
            updated_at = NOW()
          RETURNING id
        `;

        const comprobanteId: string | undefined = rows[0]?.id;
        if (!comprobanteId) return null;

        if (data.xmlContent || data.pdfBase64) {
          await sql`
            INSERT INTO comprobante_xmls (comprobante_id, tipo, ruta_archivo, xml_autorizado_path)
            VALUES (
              ${comprobanteId}::uuid, 'autorizado',
              ${data.xmlContent || null},
              ${data.pdfBase64 || null}
            )
            ON CONFLICT (comprobante_id, tipo) DO UPDATE SET
              ruta_archivo = CASE WHEN ${!!data.xmlContent} THEN EXCLUDED.ruta_archivo ELSE comprobante_xmls.ruta_archivo END,
              xml_autorizado_path = CASE WHEN ${!!data.pdfBase64} THEN EXCLUDED.xml_autorizado_path ELSE comprobante_xmls.xml_autorizado_path END
          `;
        }

        return comprobanteId;
      } catch (e: any) {
        console.error(`[DB] Error guardando ${data.claveAcceso}:`, e.message);
        return null;
      }
    },

    async comprobanteExists(claveAcceso: string): Promise<boolean> {
      try {
        const rows = await sql`
          SELECT 1 FROM comprobantes WHERE clave_acceso = ${claveAcceso} LIMIT 1
        `;
        return rows.length > 0;
      } catch {
        return false;
      }
    },

    async close() {
      // neon() does not require explicit closing
    },
  };
}

export type NeonDb = ReturnType<typeof createDb>;
