# Despliegue en Plesk + Docker

> Guía completa para desplegar **OFSERCONT IA** (Next.js + Playwright + Neon PostgreSQL) en un servidor Plesk con Docker.

---

## Requisitos del servidor

| Componente | Requisito mínimo | Recomendado |
|------------|-----------------|-------------|
| **CPU** | 2 vCores | 4 vCores |
| **RAM** | 4 GB | 8 GB |
| **Disco** | 20 GB SSD | 40 GB SSD |
| **SO** | Ubuntu 22.04 / Debian 12 | Ubuntu 22.04 |
| **Docker** | 24+ | 27+ |
| **Plesk** | Obsidian 18+ con Docker extension | Última versión |
| **PostgreSQL** | Neon cloud (externo) | Neon cloud (externo) |

> ⚠️ **Importante:** Este proyecto usa Neon PostgreSQL como base de datos externa. No necesitas instalar PostgreSQL en el servidor.

---

## 1. Prerrequisitos en Plesk

### 1.1. Habilitar Docker en Plesk

1. Ve a **Plesk > Extensiones > Mis Extensiones**
2. Busca **Docker** e instálala si no está
3. Ve a **Plesk > Docker** y verifica que el servicio esté activo
4. Opcional: configura el registro de imágenes (Docker Hub es el default)

### 1.2. Verificar recursos del sistema

```bash
# Acceder al servidor por SSH
ssh usuario@tu-servidor.com

# Verificar Docker
docker --version
docker info

# Verificar recursos
free -h
df -h
nproc
```

---

## 2. Preparar el proyecto

### 2.1. Clonar o subir el repositorio

**Opción A — Git clone directo en Plesk:**

```bash
cd /var/www/vhosts/tudominio.com
git clone https://github.com/tu-usuario/exa-ati.git
cd exa-ati
```

**Opción B — Subir archivos vía Plesk File Manager:**

1. Ve a **Plesk > Archivos**
2. Sube el ZIP del proyecto
3. Extrae en `/var/www/vhosts/tudominio.com/exa-ati/`

### 2.2. Configurar variables de entorno

Crea un archivo `.env` a partir del template:

```bash
cp env.example .env
nano .env
```

Configura las variables (ver sección 2.3):

### 2.3. Variables de entorno requeridas

```bash
# ─── ENTORNO ──────────────────────────────────────────────
NODE_ENV=production
HEADLESS=true

# ─── BASE DE DATOS (Neon PostgreSQL) ──────────────────────
DATABASE_URL=postgresql://usuario:password@ep-tu-proyecto-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
DIRECT_DATABASE_URL=postgresql://usuario:password@ep-tu-proyecto.us-east-1.aws.neon.tech/neondb?sslmode=require

# ─── SEGURIDAD ─────────────────────────────────────────────
JWT_SECRET=<genera-un-secreto-seguro>
JWT_EXPIRATION=24h
ENCRYPTION_KEY=<32-caracteres-exactos>
ENCRYPTION_SALT=<salt-unico>

# ─── SRI ECUADOR ───────────────────────────────────────────
SRI_AMBIENTE=1
SRI_WSDL_TIMEOUT_MS=25000
SRI_SOAP_TIMEOUT_MS=45000
SRI_SOAP_MAX_RETRIES=3
SRI_AUTH_DELAY_MS=2000
SRI_POLLING_MAX_HOURS=24
SRI_POLLING_BATCH_LIMIT=50

# ─── CRON ──────────────────────────────────────────────────
CRON_SECRET=<genera-un-secreto-para-cron>

# ─── RESOLVEDOR DE CAPTCHA ─────────────────────────────────
ANTICAPTCHA_KEY=tu-api-key-de-anticaptcha
# SCRAPELESS_API_KEY=sk_... (alternativa a AntiCaptcha)

# ─── DIRECTORIOS ───────────────────────────────────────────
XMLS_DIR=./downloads/xmls
CERTS_DIR=./downloads/certs
PDFS_DIR=./downloads/pdfs
TEMPLATES_DIR=./downloads/templates

# ─── NEXT.JS ───────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://tudominio.com
NEXT_PUBLIC_DEV_MODE=false
```

> 🔐 **Generar secretos seguros:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 3. Construir la imagen Docker

### 3.1. Opción A — Build directo en Plesk

1. Ve a **Plesk > Docker > Imágenes > Construir**
2. Origen: Ruta del proyecto `/var/www/vhosts/tudominio.com/exa-ati`
3. Nombre de imagen: `ofsercont-ia:latest`
4. Contexto Docker: usar el directorio del proyecto
5. Haz clic en **Construir**

O por SSH:

```bash
cd /var/www/vhosts/tudominio.com/exa-ati
docker build -t ofsercont-ia:latest .
```

> ⏱️ El primer build toma **10-20 minutos** (descarga Playwright, dependencias, build de Next.js). Builds subsecuentes son más rápidos por caché.

### 3.2. Opción B — Build local y subir a registry

**En tu máquina local:**

```bash
docker build -t ofsercont-ia:latest .
docker tag ofsercont-ia:latest tu-usuario/ofsercont-ia:latest
docker push tu-usuario/ofsercont-ia:latest
```

**En Plesk:**

```bash
docker pull tu-usuario/ofsercont-ia:latest
docker tag tu-usuario/ofsercont-ia:latest ofsercont-ia:latest
```

---

## 4. Crear y configurar el contenedor

### 4.1. Por SSH

```bash
# Crear directorios para volúmenes persistentes
mkdir -p /var/www/vhosts/tudominio.com/exa-ati-data/{downloads,browser_session,logs}

# Ejecutar el contenedor
docker run -d \
  --name ofsercont-ia \
  --restart always \
  -p 3001:3001 \
  -v /var/www/vhosts/tudominio.com/exa-ati-data/downloads:/app/downloads \
  -v /var/www/vhosts/tudominio.com/exa-ati-data/browser_session:/app/browser_session \
  -v /var/www/vhosts/tudominio.com/exa-ati-data/logs:/app/logs \
  --env-file /var/www/vhosts/tudominio.com/exa-ati/.env \
  ofsercont-ia:latest
```

### 4.2. Por Plesk Docker UI

1. Ve a **Plesk > Docker > Contenedores > Ejecutar**
2. **Imagen:** `ofsercont-ia:latest`
3. **Nombre del contenedor:** `ofsercont-ia`
4. **Puerto:** `3001 → 3001` (host → contenedor)
5. **Volúmenes:**
   - `/var/www/vhosts/tudominio.com/exa-ati-data/downloads` → `/app/downloads`
   - `/var/www/vhosts/tudominio.com/exa-ati-data/browser_session` → `/app/browser_session`
   - `/var/www/vhosts/tudominio.com/exa-ati-data/logs` → `/app/logs`
6. **Variables de entorno:** Cargar desde archivo `.env`
7. **Política de reinicio:** `Siempre`
8. Haz clic en **Ejecutar**

---

## 5. Configurar dominio y proxy reverso

### 5.1. Agregar el dominio en Plesk

1. Ve a **Plesk > Sitios web y dominios > Añadir dominio**
2. Ingresa tu dominio (ej: `tudominio.com`)

### 5.2. Configurar proxy reverso a Docker

1. Ve a **Plesk > Sitios web y dominios > tudominio.com > Apache y nginx**
2. En **Directivas adicionales de nginx**, agrega:

```nginx
location / {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # Timeouts largos para scraping
    proxy_read_timeout 300s;
    proxy_connect_timeout 30s;
    proxy_send_timeout 300s;
}
```

3. Guarda los cambios y **recarga nginx**:
   ```bash
   plesk bin nginx --reload
   ```

### 5.3. SSL con Let's Encrypt

1. Ve a **Plesk > Sitios web y dominios > tudominio.com > SSL/TLS**
2. Haz clic en **Instalar SSL/TLS Let's Encrypt**
3. Marca `www.tudominio.com`
4. Asegúrate de que el redirect HTTP → HTTPS esté activo

---

## 6. Configurar la base de datos

### 6.1. Sincronizar esquema de base de datos

```bash
# Dentro del contenedor
docker exec ofsercont-ia npx prisma db push
```

O si el contenedor no está corriendo aún:

```bash
# Usando el esquema local
npx prisma db push
```

> Esto crea todas las tablas en Neon PostgreSQL según el esquema de Prisma.

---

## 7. Configurar Cron Jobs

### 7.1. En Plesk (recomendado)

1. Ve a **Plesk > Sitios web y dominios > tudominio.com > Cron Jobs**
2. Agrega un nuevo cron job:

```
Frecuencia: Cada 5 minutos
Comando: curl -X GET https://tudominio.com/api/cron/sri-check -H "Authorization: Bearer TU_CRON_SECRET"
```

### 7.2. Por SSH (alternativa)

```bash
crontab -e
# Agregar:
*/5 * * * * curl -X GET https://tudominio.com/api/cron/sri-check -H "Authorization: Bearer TU_CRON_SECRET"
```

---

## 8. Verificar el despliegue

### 8.1. Health check

```bash
curl https://tudominio.com/api/health
```

Respuesta esperada:
```json
{
  "status": "healthy",
  "uptime": 1234,
  "checks": { "database": "ok" },
  "memory": { "heapUsed": "120MB", "heapTotal": "180MB", "rss": "250MB" }
}
```

### 8.2. Logs del contenedor

```bash
docker logs -f ofsercont-ia
```

### 8.3. Prueba de scraping

1. Inicia sesión en la app
2. Vincula un RUC
3. Inicia un scraping de prueba (1-2 días)
4. Verifica que los comprobantes aparezcan en el dashboard

### 8.4. Verificar que Chrome funciona en el contenedor

```bash
docker exec ofsercont-ia npx playwright install --dry-run
docker exec ofsercont-ia which chromium-browser
docker exec ofsercont-ia google-chrome --version
```

---

## 9. Mantenimiento

### 9.1. Actualizar la aplicación

```bash
cd /var/www/vhosts/tudominio.com/exa-ati
git pull origin main
docker build -t ofsercont-ia:latest .
docker stop ofsercont-ia
docker rm ofsercont-ia
docker run -d --name ofsercont-ia ... (mismos args que arriba)
```

> 💡 **Tip:** Guarda el comando `docker run` en un script `deploy.sh` para no tener que escribirlo cada vez.

### 9.2. Backup de volúmenes

```bash
tar -czf backup-$(date +%Y%m%d).tar.gz /var/www/vhosts/tudominio.com/exa-ati-data/
```

### 9.3. Monitoreo de logs

```bash
# Logs en tiempo real
docker logs -f --tail 100 ofsercont-ia

# Logs de scraping
tail -f /var/www/vhosts/tudominio.com/exa-ati-data/logs/*.log
```

---

## 10. Solución de problemas

### El contenedor no inicia
```bash
docker logs ofsercont-ia
# Error común: DATABASE_URL no configurada
# Solución: verificar .env
```

### El health check falla
```bash
# Verificar que el contenedor está corriendo
docker ps -a

# Verificar conectividad a Neon
docker exec ofsercont-ia node -e "require('./src/lib/sri-api/db').db.query('SELECT 1').then(r=>console.log('DB OK'))"

# Probar health check interno
docker exec ofsercont-ia curl http://localhost:3001/api/health
```

### Chrome/Playwright no funciona
```bash
# Verificar que Chrome está instalado
docker exec ofsercont-ia google-chrome --version

# Reinstalar Chrome
docker exec ofsercont-ia npx playwright install chrome

# Probar lanzamiento headless
docker exec ofsercont-ia node -e "
  const playwright = require('playwright');
  (async () => {
    const browser = await playwright.chromium.launch({ headless: true });
    console.log('Chrome OK');
    await browser.close();
  })();
"
```

### Error de permisos en volúmenes
```bash
# Los directorios montados deben ser accesibles por el usuario del contenedor
chown -R 1000:1000 /var/www/vhosts/tudominio.com/exa-ati-data/
```

### Proxy reverso no funciona
```bash
# Verificar que nginx está corriendo
plesk sbin nginx -t
plesk bin nginx --reload

# Verificar que el contenedor responde en el puerto
curl http://localhost:3001/api/health
```

---

## Apéndice A: Comandos rápidos

```bash
# Build
docker build -t ofsercont-ia:latest .

# Run
docker run -d --name ofsercont-ia --restart always \
  -p 3001:3001 \
  -v /ruta/downloads:/app/downloads \
  -v /ruta/browser_session:/app/browser_session \
  -v /ruta/logs:/app/logs \
  --env-file .env \
  ofsercont-ia:latest

# Stop
docker stop ofsercont-ia

# Start
docker start ofsercont-ia

# Restart
docker restart ofsercont-ia

# Logs
docker logs -f --tail 100 ofsercont-ia

# Shell
docker exec -it ofsercont-ia bash

# Actualizar
git pull && docker build -t ofsercont-ia:latest . && docker stop ofsercont-ia && docker rm ofsercont-ia && docker run ...
```

---

## Apéndice B: Arquitectura

```
                    ┌──────────────────────┐
                    │   Usuario (Browser)   │
                    └──────────┬───────────┘
                               │ HTTPS
                    ┌──────────▼───────────┐
                    │   Plesk Nginx         │
                    │   (proxy reverso)     │
                    │   + SSL Let's Encrypt  │
                    └──────────┬───────────┘
                               │ localhost:3001
                    ┌──────────▼───────────┐
                    │   Docker Contenedor   │
                    │   ofsercont-ia:latest │
                    │                       │
                    │   ┌───────────────┐   │
                    │   │  Next.js App  │   │
                    │   │  (puerto 3001)│   │
                    │   └──────┬────────┘   │
                    │          │            │
                    │   ┌──────▼────────┐   │
                    │   │  Scraping SRI  │   │
                    │   │  (Playwright)  │   │
                    │   │  + Chrome      │   │
                    │   └──────┬────────┘   │
                    └──────────┼────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
┌─────────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│  Neon PostgreSQL  │  │  SRI Ecuador   │  │  Anti-Captcha   │
│  (cloud externo)  │  │  SOAP + Portal │  │  (resolvedor)    │
└──────────────────┘  └────────────────┘  └─────────────────┘
```
