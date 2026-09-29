-- Plantillas de email editables + estado pendiente de pago en registro
-- PostgreSQL

-- ─── plan_estado: permitir 'pendiente' (registro sin pago aún) ───────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cuentas_plan_estado_check'
  ) THEN
    ALTER TABLE cuentas DROP CONSTRAINT cuentas_plan_estado_check;
  END IF;
  ALTER TABLE cuentas
    ADD CONSTRAINT cuentas_plan_estado_check
    CHECK (plan_estado IN ('pendiente', 'activo', 'gracia', 'vencido', 'cancelado'));
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_estado VARCHAR(20) NOT NULL DEFAULT 'activo';

ALTER TABLE cuentas
  ADD COLUMN IF NOT EXISTS telefono VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ciudad VARCHAR(80);

-- ─── Plantillas de email ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_plantillas (
  codigo          VARCHAR(50) PRIMARY KEY,
  nombre          VARCHAR(120) NOT NULL,
  descripcion     TEXT,
  asunto          VARCHAR(255) NOT NULL,
  cuerpo_html     TEXT NOT NULL,
  cuerpo_texto    TEXT,
  variables       JSONB NOT NULL DEFAULT '[]'::jsonb,
  activo          BOOLEAN NOT NULL DEFAULT true,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO email_plantillas (codigo, nombre, descripcion, asunto, cuerpo_html, cuerpo_texto, variables) VALUES
(
  'bienvenida',
  'Bienvenida al registrarse',
  'Se envía al crear la cuenta (tras el registro, antes o después del pago).',
  'Bienvenido a {{app_nombre}}, {{nombre}}',
  '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="color:#c41e3a;font-size:22px;margin:0 0 12px">¡Bienvenido a {{app_nombre}}!</h1>
  <p>Hola <strong>{{nombre}}</strong>,</p>
  <p>Tu cuenta <strong>{{email}}</strong> quedó creada para la empresa <strong>{{empresa}}</strong>.</p>
  <p>Plan seleccionado: <strong>{{plan_nombre}}</strong> ({{periodo}}).</p>
  <p>Completa el pago para activar tu panel y empezar a facturar.</p>
  <p style="margin:24px 0"><a href="{{link_pago}}" style="background:#c41e3a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">Continuar al pago</a></p>
  <p style="font-size:12px;color:#6b7280">Si no solicitaste esta cuenta, ignora este mensaje.</p>
</div>',
  'Hola {{nombre}},

Tu cuenta {{email}} quedó creada para {{empresa}}.
Plan: {{plan_nombre}} ({{periodo}}).
Completa el pago: {{link_pago}}

— {{app_nombre}}',
  '["nombre","email","empresa","plan_nombre","periodo","link_pago","app_nombre"]'::jsonb
),
(
  'pago_aprobado',
  'Suscripción / pago aprobado',
  'Confirmación cuando PayPhone aprueba el cobro de la suscripción.',
  'Pago aprobado · Orden {{orden}} · {{app_nombre}}',
  '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="color:#059669;font-size:22px;margin:0 0 12px">¡Pago aprobado!</h1>
  <p>Hola <strong>{{nombre}}</strong>,</p>
  <p>Recibimos tu pago. Número de orden: <strong>{{orden}}</strong>.</p>
  <p>Plan activo: <strong>{{plan_nombre}}</strong> ({{periodo}}) · Monto: <strong>{{monto}}</strong>.</p>
  <p style="margin:24px 0"><a href="{{link_panel}}" style="background:#c41e3a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">Ir al panel</a></p>
</div>',
  'Hola {{nombre}},

Pago aprobado. Orden: {{orden}}.
Plan: {{plan_nombre}} ({{periodo}}) · {{monto}}.
Panel: {{link_panel}}

— {{app_nombre}}',
  '["nombre","email","orden","plan_nombre","periodo","monto","link_panel","app_nombre"]'::jsonb
),
(
  'comprobante_autorizado',
  'Comprobante autorizado (cliente)',
  'Email al receptor cuando un comprobante queda AUTORIZADO por el SRI.',
  'Comprobante {{serie}}-{{secuencial}} autorizado · {{emisor_razon_social}}',
  '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="color:#c41e3a;font-size:20px;margin:0 0 12px">Comprobante autorizado</h1>
  <p>Estimado/a <strong>{{receptor_razon_social}}</strong>,</p>
  <p>Adjuntamos / compartimos su comprobante electrónico <strong>{{serie}}-{{secuencial}}</strong> por <strong>{{importe}}</strong>.</p>
  <p>Clave de acceso: <code style="font-size:12px">{{clave_acceso}}</code></p>
  <p>Emisor: {{emisor_razon_social}} ({{emisor_ruc}})</p>
  <p style="margin:24px 0"><a href="{{link_pdf}}" style="background:#c41e3a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">Ver PDF / RIDE</a></p>
</div>',
  'Estimado/a {{receptor_razon_social}},

Comprobante {{serie}}-{{secuencial}} por {{importe}}.
Clave: {{clave_acceso}}
Emisor: {{emisor_razon_social}} ({{emisor_ruc}})
PDF: {{link_pdf}}',
  '["receptor_razon_social","serie","secuencial","importe","clave_acceso","emisor_razon_social","emisor_ruc","link_pdf"]'::jsonb
),
(
  'notificacion_sistema',
  'Notificación del sistema',
  'Plantilla genérica para alertas enviadas por el canal Email.',
  '[{{app_nombre}}] {{titulo}}',
  '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="font-size:18px;margin:0 0 12px">{{titulo}}</h1>
  <p>{{cuerpo}}</p>
  <p style="margin:24px 0"><a href="{{link_accion}}" style="background:#c41e3a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">{{texto_accion}}</a></p>
  <p style="font-size:12px;color:#6b7280">{{app_nombre}}</p>
</div>',
  '{{titulo}}

{{cuerpo}}

{{link_accion}}

— {{app_nombre}}',
  '["titulo","cuerpo","link_accion","texto_accion","app_nombre"]'::jsonb
)
ON CONFLICT (codigo) DO NOTHING;

-- Módulo admin de emails (solo SUPERADMIN vía rol_modulos)
INSERT INTO modulos (codigo, nombre, grupo, ruta, orden) VALUES
  ('admin.emails', 'Plantillas de email', 'ADMINISTRACION', '/administracion/emails', 216)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  grupo = EXCLUDED.grupo,
  ruta = EXCLUDED.ruta,
  orden = EXCLUDED.orden;

INSERT INTO rol_modulos (rol_codigo, modulo_codigo)
SELECT 'SUPERADMIN', 'admin.emails'
WHERE EXISTS (SELECT 1 FROM roles WHERE codigo = 'SUPERADMIN')
  AND EXISTS (SELECT 1 FROM modulos WHERE codigo = 'admin.emails')
ON CONFLICT (rol_codigo, modulo_codigo) DO NOTHING;
