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
            ${data.emisorRuc}, ${data.emisorRazonSocial},
            ${data.receptorIdentificacion}, ${data.tenantId},
            ${data.fechaEmision ? data.fechaEmision.split('T')[0] : null}::date, 'Otros'
          )
          ON CONFLICT (clave_acceso) DO UPDATE SET
            estado = EXCLUDED.estado,
            updated_at = NOW()
          RETURNING id
        `;

        const comprobanteId: string | undefined = rows[0]?.id;
        if (!comprobanteId) return null;

        if (data.xmlContent || data.pdfBase64) {
          await sql`
            INSERT INTO comprobante_xmls (comprobante_id, tipo, ruta_archivo, xml_autorizado_path)
            VALUES (${comprobanteId}::uuid, 'autorizado', ${data.xmlContent || null}, ${data.pdfBase64 || null})
            ON CONFLICT (comprobante_id, tipo) DO UPDATE SET
              ruta_archivo = EXCLUDED.ruta_archivo,
              xml_autorizado_path = EXCLUDED.xml_autorizado_path
          `;
        }

        return comprobanteId;
      } catch (e: any) {
        console.error(`[DB] Error guardando ${data.claveAcceso}:`, e.message);
        return null;
      }
    },
  };
}

export type NeonDb = ReturnType<typeof createDb>;
