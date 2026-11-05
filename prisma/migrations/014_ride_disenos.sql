-- Diseños del PDF RIDE (solo los configura el superadmin)
-- PostgreSQL

CREATE TABLE IF NOT EXISTS ride_disenos (
  codigo              VARCHAR(40) PRIMARY KEY,
  nombre              VARCHAR(120) NOT NULL,
  descripcion         VARCHAR(500),
  plantilla           VARCHAR(20) NOT NULL,
  mostrar_logo        BOOLEAN NOT NULL DEFAULT true,
  mostrar_qr          BOOLEAN NOT NULL DEFAULT true,
  mostrar_adicional   BOOLEAN NOT NULL DEFAULT true,
  mostrar_pagos       BOOLEAN NOT NULL DEFAULT true,
  color_modo          VARCHAR(10) NOT NULL DEFAULT 'ruc',
  color_hex           VARCHAR(7),
  es_predeterminado   BOOLEAN NOT NULL DEFAULT false,
  es_sistema          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ride_disenos (
  codigo, nombre, descripcion, plantilla,
  mostrar_logo, mostrar_qr, mostrar_adicional, mostrar_pagos,
  color_modo, color_hex, es_predeterminado, es_sistema
) VALUES
  (
    'clasico',
    'Clásico SRI',
    'Caja de autorización a la derecha, logo del emisor y código QR. Es el formato de una factura impresa.',
    'clasico',
    true, true, true, true,
    'ruc', NULL, true, true
  ),
  (
    'compacto',
    'Compacto',
    'El mismo contenido, con la autorización más corta y el QR al final del documento.',
    'compacto',
    true, true, true, true,
    'ruc', NULL, false, true
  ),
  (
    'banda',
    'Banda de marca',
    'Franja de color con el logo y los datos de autorización en dos paneles.',
    'banda',
    true, true, true, true,
    'ruc', NULL, false, true
  )
ON CONFLICT (codigo) DO NOTHING;
