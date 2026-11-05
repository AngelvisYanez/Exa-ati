# OFSERCONT IA / EXA-ATI — Arquitectura del Sistema

## Stack Tecnológico Actual

Monorepo unificado: **Next.js gestiona frontend (App Router) y backend (Route Handlers)**.

### Runtime
- **Next.js 16** (App Router, `standalone` output)
- **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (base-nova / `@base-ui/react`)
- **Prisma 7** + PostgreSQL (`pg` / Neon serverless adapters); MySQL opcional en local vía `DATABASE_URL`
- **JWT** (`jsonwebtoken` + `bcryptjs`) — sin NextAuth
- Cookies **httpOnly** (`sri_access_token`) para gate de middleware; Bearer en `localStorage` para llamadas API
- **Zod 4** + **React Hook Form** para formularios críticos
- **Recharts**, **TanStack Table**, **nuqs**, **sonner**, **motion**

### Dominio SRI
- `node-forge` / `xadesjs` / `@peculiar/webcrypto` — firma XAdES-BES
- `soap` — Web Services SRI
- Playwright / Puppeteer — scraping portal SRI / IESS

### Workers
- `scripts/worker` — jobs SRI
- `scripts/workers/whatsapp-server.js` — WhatsApp
- `workers/sri-mcp-server`, `workers/scrapper-cloudflare`

---

## Estructura de Directorios

```
Exa-ati/
├── src/
│   ├── app/
│   │   ├── (auth)/          # login, register
│   │   ├── (app)/           # dashboard y módulos (documentos, emitir, …)
│   │   ├── api/             # Route Handlers (~100+)
│   │   ├── proxy.ts         # Gate de páginas con cookie JWT (ex-middleware)
│   │   └── robots.ts
│   ├── components/          # UI, layout, paneles, documentos/, configuracion/
│   ├── contexts/            # Auth, Sidebar
│   ├── lib/
│   │   ├── schemas/         # Zod compartidos (auth, contacto, emisor, empleado)
│   │   ├── sriClient.ts     # Cliente HTTP frontend → /api
│   │   └── auth-cookies.ts  # httpOnly cookie helpers
│   └── services/
│       ├── sri-api/         # db, auth-helper, xml-*, soap, LLM, tax
│       ├── scraping/
│       ├── control-tributario/
│       └── nomina/
├── prisma/schema.prisma
├── tests/                   # Vitest (dominio fiscal)
└── docs/
```

---

## Autenticación

```
UI login → POST /api/auth/login
  ├─ Valida body con loginSchema (Zod)
  ├─ Rate limit por IP
  ├─ Emite access + refresh JWT
  ├─ Set-Cookie httpOnly sri_access_token (+ refresh)
  └─ JSON con tokens (cliente guarda en localStorage para Authorization: Bearer)

middleware.ts / proxy.ts
  └─ Si no hay cookie en rutas (app) → redirect /login

API routes
  └─ verifyAuth() lee Bearer o cookie; 401 uniforme
```

En Next.js 16 la convención se llama `src/proxy.ts` (`export function proxy`).
Logout: `clearSession()` limpia localStorage y llama `POST /api/auth/logout` para borrar cookies.

---

## Flujo de Emisión de Comprobante

```
UI → POST /api/sri/emitir/factura
  ├─ 1. auth-helper → JWT
  ├─ 2. db → emisor + secuencial
  ├─ 3. clave-acceso → 49 dígitos
  ├─ 4. xml-builder → XML SRI
  ├─ 5. xml-signer → XAdES (passwordCertificado canónico)
  ├─ 6. sri-soap-client → recepción + autorización
  ├─ 7. xml-storage → XML autorizado
  └─ 8. db → comprobante
```

---

## Validación de datos

- Schemas en `src/lib/schemas/` compartidos entre UI (RHF + zodResolver) y API (`parseBody` + `safeParse`).
- Formularios migrados: login, register, nuevo contacto, vincular SRI.

---

## Variables de entorno

Raíz del proyecto (`.env` / `.env.local`), no `frontend/.env.local`:

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | PostgreSQL (Neon/pg) o MySQL local |
| `JWT_SECRET` | Firma de tokens |
| `NEXT_PUBLIC_SRI_API_URL` | Base API (default `/api`) |
| Keys LLM / captcha / proxies | Según módulo |

---

## Notas de deuda conocida

- Muchas pages siguen siendo `"use client"` con fetches en `useEffect`.
- Dualidad SQL crudo (`db.query*`) vs Prisma Client en algunos módulos.
- Campos legacy de certificado en `Emisor` (`certificadoPassword`, `certificadoPasswordEncrypted`) — canónico: `passwordCertificado`.
- Modelo `Empleado` añadido; la UI de nómina puede seguir leyendo `planillas_iess` hasta migrar pantallas.
