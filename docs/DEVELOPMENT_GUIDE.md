# Guía de Desarrollo — Facturación Electrónica SRI

## Configuración del Entorno

### Requisitos Previos
- Node.js 18+
- PostgreSQL 14+ (instalado localmente o en servidor)
- Un certificado de firma electrónica `.p12` vigente (para producción)

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tu-org/ati-exa.git
cd ati-exa

# Configurar base de datos
psql -U postgres -c "CREATE DATABASE db_sri;"
psql -U postgres -d db_sri -f backend/database/init.sql

# Configurar variables de entorno
cd frontend
cp .env.example .env.local
# Editar .env.local con tus datos
```

### Variables de Entorno (`.env.local`)

```env
# === Base de Datos ===
DB_HOST=localhost
DB_PORT=5432
DB_NAME=db_sri
DB_USER=postgres
DB_PASSWORD=tu_password_postgres

# === Seguridad ===
JWT_SECRET=coloca-aqui-un-secreto-largo-de-minimo-32-chars
JWT_EXPIRATION=24h
ENCRYPTION_KEY=12345678901234567890123456789012  # exactamente 32 chars

# === SRI ===
SRI_AMBIENTE=1   # 1=Pruebas, 2=Producción
```

### Correr en Desarrollo

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Módulos del Núcleo SRI (`src/lib/sri-api/`)

### `db.ts` — Pool de Conexiones
```typescript
import { query } from '@/lib/sri-api/db';

const result = await query('SELECT * FROM comprobantes WHERE tenant_id = $1', [tenantId]);
```

### `config.ts` — Variables de Entorno
```typescript
import { config } from '@/lib/sri-api/config';

const secret = config.jwt.secret;
const ambiente = config.sri.ambiente;
```

### `clave-acceso.ts` — Generador de Clave de Acceso
```typescript
import { generarClaveAcceso } from '@/lib/sri-api/clave-acceso';

const clave = generarClaveAcceso({
  fecha: '15012024',
  tipoComprobante: '01',
  ruc: '0999999999001',
  ambiente: '1',
  serie: '001001',
  secuencial: '000000001',
  codigoNumerico: '12345678',
  tipoEmision: '1'
});
// → "1501202401099999999990010010010000000011234567811"  (49 dígitos)
```

### `xml-builder.ts` — Constructor de XML
```typescript
import { buildFacturaXml } from '@/lib/sri-api/xml-builder';

const xmlString = buildFacturaXml({
  infoTributaria: { ... },
  infoFactura: { ... },
  detalles: [ ... ],
  pagos: [ ... ]
});
```

### `xml-signer.ts` — Firmador XAdES-BES
```typescript
import { signXml } from '@/lib/sri-api/xml-signer';

const xmlFirmado = await signXml(xmlString, p12Buffer, p12Password);
```

### `sri-soap-client.ts` — Cliente SOAP
```typescript
import { SriSoapClient } from '@/lib/sri-api/sri-soap-client';

const client = new SriSoapClient(ambiente);
const recepcion = await client.enviarComprobante(xmlFirmado);
const autorizacion = await client.autorizarComprobante(claveAcceso);
```

### `xml-storage.ts` — Almacenamiento de XMLs
```typescript
import { xmlStorage } from '@/lib/sri-api/xml-storage';

// Guardar
await xmlStorage.saveXml(ruc, claveAcceso, 'autorizado', xmlContent);

// Leer
const xmlContent = await xmlStorage.readXml(rutaArchivo);
```

### `auth-helper.ts` — Validación JWT
```typescript
import { requireAuth } from '@/lib/sri-api/auth-helper';

// En un Route Handler:
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  // user = { id, email, rol, tenantId }
  ...
}
```

---

## Crear un Nuevo Endpoint Protegido

```typescript
// src/app/api/ejemplo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/sri-api/auth-helper';
import { query } from '@/lib/sri-api/db';

export async function GET(req: NextRequest) {
  try {
    // 1. Autenticar
    const user = await requireAuth(req);
    
    // 2. Lógica de negocio
    const result = await query(
      'SELECT * FROM mi_tabla WHERE tenant_id = $1',
      [user.tenantId]
    );
    
    // 3. Responder
    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    if (error.status) return error; // Error de auth ya formateado
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
```

---

## Estructura de Tablas Principales

### `emisores`
```sql
id, ruc, razon_social, nombre_comercial, direccion, 
obligado_contabilidad, tipo_contribuyente,
certificado_p12 (bytea), password_certificado (encriptado),
cert_valido_desde, cert_valido_hasta, tenant_id
```

### `comprobantes`
```sql
id, clave_acceso (49 chars), tipo, serie, secuencial,
fecha_emision, receptor_identificacion, receptor_razon_social,
subtotal, iva, total, estado (FIRMADO/ENVIADO/AUTORIZADO/RECHAZADO),
numero_autorizacion, fecha_autorizacion, ambiente, emisor_id, tenant_id
```

---

## Ambientes del SRI

| Ambiente | Código | URL Recepción | URL Autorización |
|----------|--------|---------------|-----------------|
| Pruebas | `1` | `https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl` | `https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl` |
| Producción | `2` | `https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl` | `https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl` |

---

## Troubleshooting Común

### Error: `certificate expired`
El certificado P12 del emisor está vencido. Renovar con el Banco o Registro Civil.

### Error: `DEVUELTO` del SRI
El XML tiene errores de estructura. Revisar el campo `mensajes` en la respuesta del SRI.

### Error: `SOAP timeout`
Los servidores del SRI no respondieron. El sistema guarda el comprobante como `PENDIENTE` para reintentar.

### Error: `invalid signature`
La contraseña del certificado P12 es incorrecta, o el archivo P12 está corrupto.

### Error: `DB_HOST not configured`
Falta el archivo `.env.local` o las variables `DB_*` en el entorno.
