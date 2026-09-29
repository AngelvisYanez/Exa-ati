import { db } from "@/services/sri-api/db";

export type EmailPlantillaCodigo =
  | "bienvenida"
  | "pago_aprobado"
  | "comprobante_autorizado"
  | "notificacion_sistema"
  | (string & {});

export interface EmailPlantilla {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  asunto: string;
  cuerpoHtml: string;
  cuerpoTexto: string | null;
  variables: string[];
  activo: boolean;
  updatedAt: string | null;
}

export type EmailVars = Record<string, string | number | null | undefined>;

const DEFAULT_APP_NAME = "OFSERCONT IA";

/** Sustituye {{clave}} en plantillas. Claves faltantes → cadena vacía. */
export function renderTemplate(template: string, vars: EmailVars): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === null || v === undefined) return "";
    return String(v);
  });
}

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.PAYPHONE_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function appNombre(): string {
  return process.env.APP_DISPLAY_NAME || DEFAULT_APP_NAME;
}

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export async function getMailTransporter() {
  const nodemailer = await import("nodemailer");
  return nodemailer.default.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || undefined,
  });
}

function mapRow(row: {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  asunto: string;
  cuerpo_html: string;
  cuerpo_texto: string | null;
  variables: unknown;
  activo: boolean | number;
  updated_at?: Date | string | null;
}): EmailPlantilla {
  let variables: string[] = [];
  if (Array.isArray(row.variables)) {
    variables = row.variables.map(String);
  } else if (typeof row.variables === "string") {
    try {
      const parsed = JSON.parse(row.variables);
      if (Array.isArray(parsed)) variables = parsed.map(String);
    } catch {
      variables = [];
    }
  }
  return {
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion,
    asunto: row.asunto,
    cuerpoHtml: row.cuerpo_html,
    cuerpoTexto: row.cuerpo_texto,
    variables,
    activo: Boolean(row.activo),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

const FALLBACK_TEMPLATES: Record<string, EmailPlantilla> = {
  bienvenida: {
    codigo: "bienvenida",
    nombre: "Bienvenida al registrarse",
    descripcion: "Fallback sin migración 011",
    asunto: "Bienvenido a {{app_nombre}}, {{nombre}}",
    cuerpoHtml:
      "<p>Hola <strong>{{nombre}}</strong>, tu cuenta {{email}} para {{empresa}} quedó creada. Plan: {{plan_nombre}}.</p>",
    cuerpoTexto:
      "Hola {{nombre}}, tu cuenta {{email}} para {{empresa}} quedó creada. Plan: {{plan_nombre}}.",
    variables: ["nombre", "email", "empresa", "plan_nombre", "periodo", "link_pago", "app_nombre"],
    activo: true,
    updatedAt: null,
  },
  pago_aprobado: {
    codigo: "pago_aprobado",
    nombre: "Suscripción / pago aprobado",
    descripcion: "Fallback sin migración 011",
    asunto: "Pago aprobado · Orden {{orden}} · {{app_nombre}}",
    cuerpoHtml:
      "<p>Hola <strong>{{nombre}}</strong>, pago aprobado. Orden <strong>{{orden}}</strong>. Plan {{plan_nombre}} ({{periodo}}) · {{monto}}.</p>",
    cuerpoTexto:
      "Hola {{nombre}}, pago aprobado. Orden {{orden}}. Plan {{plan_nombre}} · {{monto}}.",
    variables: ["nombre", "email", "orden", "plan_nombre", "periodo", "monto", "link_panel", "app_nombre"],
    activo: true,
    updatedAt: null,
  },
  comprobante_autorizado: {
    codigo: "comprobante_autorizado",
    nombre: "Comprobante autorizado (cliente)",
    descripcion: "Fallback sin migración 011",
    asunto: "Comprobante {{serie}}-{{secuencial}} autorizado · {{emisor_razon_social}}",
    cuerpoHtml:
      "<p>Estimado/a {{receptor_razon_social}}, comprobante {{serie}}-{{secuencial}} por {{importe}}. Clave: {{clave_acceso}}</p>",
    cuerpoTexto:
      "Estimado/a {{receptor_razon_social}}, comprobante {{serie}}-{{secuencial}} por {{importe}}. Clave: {{clave_acceso}}",
    variables: [
      "receptor_razon_social",
      "serie",
      "secuencial",
      "importe",
      "clave_acceso",
      "emisor_razon_social",
      "emisor_ruc",
      "link_pdf",
    ],
    activo: true,
    updatedAt: null,
  },
  notificacion_sistema: {
    codigo: "notificacion_sistema",
    nombre: "Notificación del sistema",
    descripcion: "Fallback sin migración 011",
    asunto: "[{{app_nombre}}] {{titulo}}",
    cuerpoHtml: "<p><strong>{{titulo}}</strong></p><p>{{cuerpo}}</p>",
    cuerpoTexto: "{{titulo}}\n\n{{cuerpo}}",
    variables: ["titulo", "cuerpo", "link_accion", "texto_accion", "app_nombre"],
    activo: true,
    updatedAt: null,
  },
};

export async function listEmailPlantillas(): Promise<EmailPlantilla[]> {
  try {
    const rows = await db.queryAll<{
      codigo: string;
      nombre: string;
      descripcion: string | null;
      asunto: string;
      cuerpo_html: string;
      cuerpo_texto: string | null;
      variables: unknown;
      activo: boolean | number;
      updated_at: Date | string | null;
    }>(
      `SELECT codigo, nombre, descripcion, asunto, cuerpo_html, cuerpo_texto, variables, activo, updated_at
       FROM email_plantillas
       ORDER BY nombre ASC`
    );
    if (rows.length > 0) return rows.map(mapRow);
  } catch (err) {
    console.warn("[email] listEmailPlantillas fallback:", err);
  }
  return Object.values(FALLBACK_TEMPLATES);
}

export async function getEmailPlantilla(
  codigo: string
): Promise<EmailPlantilla | null> {
  try {
    const row = await db.queryOne<{
      codigo: string;
      nombre: string;
      descripcion: string | null;
      asunto: string;
      cuerpo_html: string;
      cuerpo_texto: string | null;
      variables: unknown;
      activo: boolean | number;
      updated_at: Date | string | null;
    }>(
      `SELECT codigo, nombre, descripcion, asunto, cuerpo_html, cuerpo_texto, variables, activo, updated_at
       FROM email_plantillas WHERE codigo = $1`,
      [codigo]
    );
    if (row) return mapRow(row);
  } catch {
    /* tabla ausente */
  }
  return FALLBACK_TEMPLATES[codigo] || null;
}

export async function updateEmailPlantilla(input: {
  codigo: string;
  nombre?: string;
  descripcion?: string | null;
  asunto?: string;
  cuerpoHtml?: string;
  cuerpoTexto?: string | null;
  activo?: boolean;
  updatedBy?: string | null;
}): Promise<EmailPlantilla> {
  const fields: string[] = [];
  const values: unknown[] = [];
  const push = (col: string, val: unknown) => {
    values.push(val);
    fields.push(`${col} = $${values.length}`);
  };
  if (input.nombre !== undefined) push("nombre", input.nombre);
  if (input.descripcion !== undefined) push("descripcion", input.descripcion);
  if (input.asunto !== undefined) push("asunto", input.asunto);
  if (input.cuerpoHtml !== undefined) push("cuerpo_html", input.cuerpoHtml);
  if (input.cuerpoTexto !== undefined) push("cuerpo_texto", input.cuerpoTexto);
  if (input.activo !== undefined) push("activo", input.activo);
  if (input.updatedBy !== undefined) push("updated_by", input.updatedBy);
  push("updated_at", new Date().toISOString());

  values.push(input.codigo);
  await db.query(
    `UPDATE email_plantillas SET ${fields.join(", ")} WHERE codigo = $${values.length}`,
    values
  );
  const updated = await getEmailPlantilla(input.codigo);
  if (!updated) throw new Error("Plantilla no encontrada");
  return updated;
}

export function previewPlantilla(
  plantilla: EmailPlantilla,
  sampleVars?: EmailVars
): { subject: string; html: string; text: string } {
  const defaults: EmailVars = {
    app_nombre: appNombre(),
    nombre: "María Pérez",
    email: "maria@ejemplo.com",
    empresa: "Comercial Demo S.A.",
    plan_nombre: "Emprendedor",
    periodo: "mensual",
    link_pago: `${appBaseUrl()}/suscripcion`,
    link_panel: `${appBaseUrl()}/panel`,
    orden: "ORD-DEMO-001",
    monto: "$19.00",
    receptor_razon_social: "Cliente Demo",
    serie: "001-001",
    secuencial: "000000123",
    importe: "$112.00",
    clave_acceso: "1234567890123456789012345678901234567890123456789",
    emisor_razon_social: "Comercial Demo S.A.",
    emisor_ruc: "1790000000001",
    link_pdf: `${appBaseUrl()}/api/sri/comprobantes/demo/pdf`,
    titulo: "Recordatorio de suscripción",
    cuerpo: "Tu plan vence en 3 días. Renueva para no perder el acceso.",
    link_accion: `${appBaseUrl()}/suscripcion`,
    texto_accion: "Renovar ahora",
    ...sampleVars,
  };
  return {
    subject: renderTemplate(plantilla.asunto, defaults),
    html: renderTemplate(plantilla.cuerpoHtml, defaults),
    text: renderTemplate(plantilla.cuerpoTexto || plantilla.cuerpoHtml, defaults),
  };
}

export async function sendTemplatedEmail(input: {
  codigo: EmailPlantillaCodigo;
  to: string;
  vars: EmailVars;
  attachments?: Array<{ filename: string; path?: string; content?: Buffer | string }>;
}): Promise<{ sent: boolean; skipped?: string }> {
  if (!smtpConfigured()) {
    return { sent: false, skipped: "SMTP_HOST no configurado" };
  }
  const plantilla = await getEmailPlantilla(input.codigo);
  if (!plantilla) {
    return { sent: false, skipped: `Plantilla ${input.codigo} no encontrada` };
  }
  if (!plantilla.activo) {
    return { sent: false, skipped: `Plantilla ${input.codigo} inactiva` };
  }

  const vars: EmailVars = {
    app_nombre: appNombre(),
    ...input.vars,
  };
  const subject = renderTemplate(plantilla.asunto, vars);
  const html = renderTemplate(plantilla.cuerpoHtml, vars);
  const text = renderTemplate(plantilla.cuerpoTexto || "", vars) || undefined;

  try {
    const transporter = await getMailTransporter();
    await transporter.sendMail({
      to: input.to,
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      subject,
      html,
      text,
      attachments: input.attachments,
    });
    return { sent: true };
  } catch (err) {
    console.error(`[email] send ${input.codigo}:`, err);
    return { sent: false, skipped: err instanceof Error ? err.message : "Error SMTP" };
  }
}
