-- Diseños del PDF RIDE (MySQL)

CREATE TABLE IF NOT EXISTS ride_disenos (
  codigo              VARCHAR(40) PRIMARY KEY,
  nombre              VARCHAR(120) NOT NULL,
  descripcion         VARCHAR(500) NULL,
  plantilla           VARCHAR(20) NOT NULL,
  mostrar_logo        TINYINT(1) NOT NULL DEFAULT 1,
  mostrar_qr          TINYINT(1) NOT NULL DEFAULT 1,
  mostrar_adicional   TINYINT(1) NOT NULL DEFAULT 1,
  mostrar_pagos       TINYINT(1) NOT NULL DEFAULT 1,
  color_modo          VARCHAR(10) NOT NULL DEFAULT 'ruc',
  color_hex           VARCHAR(7) NULL,
  es_predeterminado   TINYINT(1) NOT NULL DEFAULT 0,
  es_sistema          TINYINT(1) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO ride_disenos (
  codigo, nombre, descripcion, plantilla,
  mostrar_logo, mostrar_qr, mostrar_adicional, mostrar_pagos,
  color_modo, color_hex, es_predeterminado, es_sistema
) VALUES
  (
    'clasico',
    'Clásico SRI',
    'Caja de autorización a la derecha, logo del emisor y código QR. Es el formato de una factura impresa.',
    'clasico',
    1, 1, 1, 1,
    'ruc', NULL, 1, 1
  ),
  (
    'compacto',
    'Compacto',
    'El mismo contenido, con la autorización más corta y el QR al final del documento.',
    'compacto',
    1, 1, 1, 1,
    'ruc', NULL, 0, 1
  ),
  (
    'banda',
    'Banda de marca',
    'Franja de color con el logo y los datos de autorización en dos paneles.',
    'banda',
    1, 1, 1, 1,
    'ruc', NULL, 0, 1
  );
