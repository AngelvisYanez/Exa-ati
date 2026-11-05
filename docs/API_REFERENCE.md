# SRI Electronic Invoicing — API Reference

> Todos los endpoints de facturación electrónica viven en Next.js API Routes bajo `/api/`.
> La base URL en producción depende del dominio donde esté desplegado Next.js.

---

## Autenticación

Todos los endpoints marcados con 🔒 requieren el header:
```
Authorization: Bearer <accessToken>
```

---

## Endpoints de Autenticación

### `POST /api/auth/login`
Inicia sesión y obtiene tokens JWT.

**Request Body:**
```json
{
  "email": "usuario@empresa.com",
  "password": "contraseña_segura"
}
```

**Response `200`:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "expiresIn": 86400,
  "user": {
    "id": 1,
    "email": "usuario@empresa.com",
    "nombre": "Juan Pérez",
    "rol": "admin"
  }
}
```

---

### `POST /api/auth/register`
Registra un nuevo usuario.

**Request Body:**
```json
{
  "email": "nuevo@empresa.com",
  "password": "contraseña",
  "nombre": "Juan Pérez",
  "tenantId": 1
}
```

**Response `201`:**
```json
{ "id": 2, "email": "nuevo@empresa.com", "nombre": "Juan Pérez" }
```

---

## Endpoints de Comprobantes

### 🔒 `GET /api/sri/comprobantes`
Lista comprobantes paginados del tenant autenticado.

**Query Params:**
| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `page` | number | `1` | Número de página |
| `limit` | number | `20` | Resultados por página |
| `tipo` | string | — | Filtrar por tipo (`01`=Factura, `04`=NC, etc.) |
| `rucEmisor` | string | — | Filtrar por RUC del emisor |

**Response `200`:**
```json
{
  "data": [ { "claveAcceso": "...", "tipo": "01", "estado": "AUTORIZADO", ... } ],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

---

### 🔒 `GET /api/sri/comprobantes/:claveAcceso`
Detalle completo de un comprobante (cabecera + detalles + impuestos + pagos).

**Response `200`:**
```json
{
  "cabecera": { "claveAcceso": "...", "fechaEmision": "2024-01-15", ... },
  "detalles": [ { "descripcion": "Producto A", "cantidad": 2, "precioUnitario": 10.00, ... } ],
  "impuestos": [ { "codigoImpuesto": "2", "tarifa": 15, "baseImponible": 20.00, "valor": 3.00 } ],
  "pagos": [ { "formaPago": "01", "total": 23.00 } ]
}
```

---

### 🔒 `GET /api/sri/comprobantes/:claveAcceso/xml`
Descarga el XML autorizado del comprobante.

**Response `200`:** Contenido XML (`Content-Type: application/xml`)

---

### 🔒 `POST /api/sri/emitir/factura`
Emite una factura electrónica completa (genera, firma, autoriza y persiste).

**Request Body:**
```json
{
  "emisorId": 1,
  "receptor": {
    "razonSocial": "Cliente S.A.",
    "identificacion": "0900000001001",
    "tipoIdentificacion": "04",
    "email": "cliente@empresa.com"
  },
  "detalles": [
    {
      "codigoProducto": "PRD001",
      "descripcion": "Servicio de Consultoría",
      "cantidad": 1,
      "precioUnitario": 100.00,
      "descuento": 0
    }
  ],
  "pagos": [
    { "formaPago": "01", "total": 115.00 }
  ],
  "ambiente": "1"
}
```

**Response `201`:**
```json
{
  "claveAcceso": "1501202401099...",
  "numeroAutorizacion": "1501202401099...",
  "fechaAutorizacion": "2024-01-15T10:30:00",
  "estado": "AUTORIZADO",
  "ambiente": "PRUEBAS"
}
```

---

### 🔒 `GET /api/sri/verificar/:claveAcceso`
Consulta el estado actual de un comprobante directamente en los servidores del SRI.

**Response `200`:**
```json
{
  "claveAcceso": "150120240109...",
  "estado": "AUTORIZADO",
  "numeroAutorizacion": "150120240109...",
  "fechaAutorizacion": "2024-01-15T10:30:00",
  "ambiente": "PRUEBAS",
  "comprobante": "<factura>...</factura>"
}
```

---

## Endpoints de Certificados

### 🔒 `POST /api/certificates/upload-cert`
Sube y vincula una firma electrónica `.p12` a un emisor.

**Request:** `multipart/form-data`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `file` | File | Archivo `.p12` de la firma electrónica |
| `password` | string | Contraseña de la firma |
| `emisorId` | number | ID del emisor al que se vincula |

**Response `201`:**
```json
{
  "mensaje": "Certificado cargado y vinculado correctamente",
  "emisorId": 1,
  "vigencia": {
    "desde": "2023-01-01",
    "hasta": "2025-01-01"
  }
}
```

**Response `400`:** Si la contraseña es incorrecta o el certificado está vencido.

---

## Códigos de Error Comunes

| Código | Significado |
|--------|-------------|
| `401` | Token inválido o expirado |
| `403` | Sin permisos para el recurso |
| `404` | Comprobante no encontrado |
| `409` | Comprobante ya existe (clave de acceso duplicada) |
| `422` | Datos de factura inválidos o faltantes |
| `500` | Error interno (SRI no disponible, DB error, etc.) |
| `503` | SRI no respondió (timeout SOAP) |
