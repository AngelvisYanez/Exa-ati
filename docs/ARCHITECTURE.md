# ATI-EXA — Arquitectura del Sistema

## Stack Tecnológico Actual

> La arquitectura fue migrada de un modelo NestJS + Redis + Next.js a un **monorepo unificado** donde Next.js gestiona tanto el frontend como el backend (API Routes).

### Frontend + Backend (Unificado)
- **Next.js 14** (App Router + Route Handlers como API)
- **TypeScript**
- **TailwindCSS** + **shadcn/ui**
- **React Query**
- **Zustand / Jotai**
- **NextAuth.js** (sesiones de UI)
- **Recharts** (gráficas)
- **`pg`** — Pool de conexiones a PostgreSQL (reemplaza ORM)
- **`jsonwebtoken`** — Autenticación JWT en API Routes
- **`bcrypt`** — Hashing de contraseñas
- **`node-forge`** — Parsing de certificados P12
- **`xadesjs`** — Firma digital XAdES-BES
- **`@peculiar/webcrypto`** — Motor WebCrypto para xadesjs en Node.js
- **`xmldom`** — DOM global para firma XML
- **`soap`** — Cliente SOAP para Web Services del SRI

### Base de Datos
- **PostgreSQL** — Única fuente de persistencia (sin Redis)
- Schema inicializado en [`backend/database/init.sql`](../backend/database/init.sql)

### Stack Eliminado
- ~~NestJS~~ — Reemplazado por Next.js API Routes
- ~~Redis~~ — Eliminado por completo (sin colas, sin cache distribuida)
- ~~Docker~~ — Ya no es obligatorio para desarrollo local
- ~~Celery~~ — No aplica para el nuevo stack

---

## Estructura de Directorios Clave

```
ati-exa/
├── frontend/                        # Todo el código (frontend + backend)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/                 # ← API Routes (ex-NestJS controllers)
│   │   │   │   ├── auth/
│   │   │   │   │   ├── login/route.ts
│   │   │   │   │   └── register/route.ts
│   │   │   │   ├── sri/
│   │   │   │   │   ├── comprobantes/
│   │   │   │   │   │   ├── route.ts
│   │   │   │   │   │   └── [claveAcceso]/
│   │   │   │   │   │       ├── route.ts
│   │   │   │   │   │       └── xml/route.ts
│   │   │   │   │   ├── emitir/
│   │   │   │   │   │   └── factura/route.ts
│   │   │   │   │   └── verificar/
│   │   │   │   │       └── [claveAcceso]/route.ts
│   │   │   │   └── certificates/
│   │   │   │       └── upload-cert/route.ts
│   │   │   └── (pages de UI)...
│   │   └── lib/
│   │       ├── sri-api/             # ← Lógica de negocio portada desde NestJS
│   │       │   ├── db.ts            # Pool PostgreSQL
│   │       │   ├── config.ts        # Variables de entorno
│   │       │   ├── auth-helper.ts   # Middleware JWT
│   │       │   ├── clave-acceso.ts  # Generador clave 49 dígitos (Módulo 11)
│   │       │   ├── xml-builder.ts   # Constructor de XMLs para el SRI
│   │       │   ├── xml-signer.ts    # Firmador XAdES-BES
│   │       │   ├── xml-storage.ts   # Lector/Escritor de archivos XML
│   │       │   └── sri-soap-client.ts # Cliente SOAP gubernamental
│   │       └── sriClient.ts         # Cliente HTTP del frontend (apunta a /api)
├── backend/
│   └── database/
│       └── init.sql                 # Schema PostgreSQL
├── docs/                            # Documentación técnica
└── PRD/                             # Product Requirements Documents
```

---

## Flujo de Emisión de Comprobante

```
UI (React) → POST /api/sri/emitir/factura
  │
  ├─ 1. auth-helper.ts → Valida JWT
  ├─ 2. db.ts → Obtiene secuencial y datos del emisor
  ├─ 3. clave-acceso.ts → Genera clave de 49 dígitos
  ├─ 4. xml-builder.ts → Construye XML según esquema SRI
  ├─ 5. xml-signer.ts → Firma XAdES-BES con certificado P12
  ├─ 6. sri-soap-client.ts → Envía a SRI (recepción + autorización)
  ├─ 7. xml-storage.ts → Guarda XML autorizado en disco
  └─ 8. db.ts → Persiste comprobante en PostgreSQL
```

---

## Variables de Entorno Requeridas

Crear el archivo `frontend/.env.local`:

```env
# Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=db_sri
DB_USER=postgres
DB_PASSWORD=postgres-sri-pwd

# Seguridad
JWT_SECRET=sri-jwt-secret-key-32bytes-long-now
JWT_EXPIRATION=24h
ENCRYPTION_KEY=12345678901234567890123456789012

# SRI (Ambiente)
SRI_AMBIENTE=1  # 1=Pruebas, 2=Producción
```

---

## Inicialización Local

```bash
# 1. Levantar PostgreSQL (sin Docker)
# Instalar PostgreSQL nativo y crear base de datos:
createdb db_sri
psql -d db_sri -f backend/database/init.sql

# 2. Configurar variables de entorno
cp frontend/.env.example frontend/.env.local
# Editar .env.local con tus credenciales

# 3. Instalar dependencias y correr
cd frontend
npm install
npm run dev
# → http://localhost:3000
```
