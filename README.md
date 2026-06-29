# ATI-EXA — Asistente Tributario Inteligente

Plataforma inteligente que automatiza la preparación, validación y presentación de obligaciones tributarias en Ecuador.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Lenguaje** | TypeScript |
| **Estilos & UI** | Tailwind CSS v4, shadcn/ui, Lucide Icons |
| **Base de Datos** | PostgreSQL (Neon/Supabase) o MySQL |
| **Autenticación** | JWT + bcrypt |
| **Scraping** | Playwright + Puppeteer |
| **Firma Electrónica** | XAdES-BES (xadesjs, node-forge) |
| **IA** | Gemini / Claude API |

---

## Puesta en marcha (Desarrollo Local)

### Requisitos previos
- Node.js >= 20
- Opcional: MySQL 8+ (para desarrollo local con MySQL)
- Opcional: Cuenta en [Neon](https://neon.tech) o [Supabase](https://supabase.com) (para PostgreSQL cloud)

### Instalación

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/exa-ati.git
   cd exa-ati
   ```

2. Configurar variables de entorno:
   ```bash
   cp env.example .env
   ```

3. Elegir base de datos:

   **Opción A — PostgreSQL en la nube (Neon / Supabase):**
   - Crea una base de datos gratis en [Neon](https://neon.tech) o [Supabase](https://supabase.com)
   - En `.env`, descomenta `DATABASE_URL` y `DIRECT_DATABASE_URL` con tu connection string
   - Comenta o deja vacías las variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

   **Opción B — MySQL local:**
   - Asegúrate de tener MySQL 8+ instalado y corriendo
   - Crea la base de datos: `CREATE DATABASE db_sri;`
   - En `.env`, deja `DATABASE_URL` y `DIRECT_DATABASE_URL` comentadas
   - Configura `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

4. Instalar dependencias:
   ```bash
   npm install
   ```

5. Inicializar la base de datos:

   Para PostgreSQL:
   ```bash
   npx prisma db push
   ```

   Para MySQL:
   ```bash
   npx prisma db push
   ```

6. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

7. (Opcional) Crear usuario admin:
   ```bash
   npm run setup
   ```

La app estará disponible en `http://localhost:3000`.

---

## Despliegue con Docker

### Usando docker-compose (recomendado)

1. Configura `.env` con tu base de datos (Neon, Supabase o MySQL local)

2. Para usar PostgreSQL local con Docker, descomenta el servicio `db` en `docker-compose.yml`

3. Construir e iniciar:
   ```bash
   docker compose up -d --build
   ```

4. La app estará en `http://localhost:3001`

### Usando Docker directamente

```bash
docker build -t exa-ati .
docker run -d --name exa-ati \
  -p 3001:3001 \
  --env-file .env \
  exa-ati
```

---

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia servidor de desarrollo |
| `npm run build` | Compila para producción |
| `npm start` | Inicia servidor de producción (puerto 3001) |
| `npm test` | Ejecuta tests con Vitest |
| `npm run setup` | Crea el primer usuario admin |
| `npm run worker:sri` | Inicia el worker de scraping SRI |

---

## Variables de Entorno

Ver `env.example` para la lista completa de variables y sus descripciones.

### Gestión de secretos

Para generar secretos seguros:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Documentación adicional

- `docs/plesk-docker-deploy.md` — Despliegue en Plesk + Docker
- `docs/SRI_CONNECTOR.md` — Conexión SOAP al SRI
- `docs/SriPlaywrightScraper.md` — Scraping del portal SRI
- `docs/ARCHITECTURE.md` — Arquitectura del sistema
- `docs/API_REFERENCE.md` — Referencia de API
