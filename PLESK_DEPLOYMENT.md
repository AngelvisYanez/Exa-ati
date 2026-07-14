# Guía de Despliegue en Plesk (Docker + Git Clone)

Esta guía explica cómo desplegar Exa-ATI en Plesk usando Docker, clonando el repositorio desde Git en lugar de subir archivos manualmente.

---

## Requisitos Previos en el Servidor

Antes de empezar, asegúrate de tener instalado en tu servidor Plesk:

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Docker Compose (viene incluido con Docker moderno)
docker compose version

# Git
apt-get install -y git
```

---

## Opción 1: Despliegue Automático (Recomendado)

### Paso 1: Conectar vía SSH al servidor

```bash
ssh root@tu-servidor.com
```

### Paso 2: Ejecutar el script de despliegue

```bash
# Clonar el repositorio (solo necesitas esta línea)
git clone https://github.com/TU_USUARIO/Exa-ati.git /var/www/exa-ati
cd /var/www/exa-ati

# Configurar variables de entorno
cp .env.plesk.example .env
nano .env  # Editar con tus valores reales

# Ejecutar despliegue
bash scripts/deploy-plesk.sh
```

El script se encargará de:
1. Verificar que Docker y Git estén instalados
2. Clonar o actualizar el repositorio
3. Construir la imagen Docker
4. Levantar los contenedores

---

## Opción 2: Despliegue Manual

### Paso 1: Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/Exa-ati.git /var/www/exa-ati
cd /var/www/exa-ati
```

### Paso 2: Configurar variables de entorno

```bash
cp .env.plesk.example .env
nano .env
```

Edita las siguientes variables clave:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URL de conexión a PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secreto para tokens JWT | Genera con: `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Clave de encriptación (32 chars) | `12345678901234567890123456789012` |
| `NEXT_PUBLIC_APP_URL` | URL pública de tu app | `https://tu-dominio.com` |
| `ANTICAPTCHA_KEY` | API Key de AntiCaptcha | Tu API key |

### Paso 3: Construir y levantar

```bash
# Construir imagen Docker
docker compose -f docker-compose.plesk.yml build

# Levantar servicios
docker compose -f docker-compose.plesk.yml --env-file .env up -d
```

### Paso 4: Verificar

```bash
# Ver estado de contenedores
docker compose -f docker-compose.plesk.yml ps

# Ver logs
docker compose -f docker-compose.plesk.yml logs -f app
```

---

## Configurar Proxy Inverso en Plesk

La aplicación corre internamente en el puerto `3001`. Necesitas configurar Plesk para que redirija el tráfico.

### Opción A: Panel de Plesk (Recomendado)

1. Ve a tu dominio en Plesk → **Hosting Settings**
2. En **Web server configuration**, agrega:

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 300s;
    proxy_connect_timeout 30s;
    proxy_send_timeout 300s;
    client_max_body_size 50M;
}
```

### Opción B: Archivo de configuración Nginx

Edita el archivo de configuración de Nginx de tu dominio:

```bash
# En Plesk, generalmente está en:
# /var/www/vhosts/TU_DOMINIO/conf/nginx.conf

# O crea el archivo:
nano /var/www/vhosts/TU_DOMINIO/conf/vhost_nginx.conf
```

---

## Actualizaciones Futuras

Cuando hayan cambios en el repositorio:

```bash
cd /var/www/exa-ati

# Actualizar código
git pull origin main

# Reconstruir y reiniciar
docker compose -f docker-compose.plesk.yml build
docker compose -f docker-compose.plesk.yml --env-file .env up -d
```

O ejecuta el script de despliegue que hace todo automáticamente:

```bash
bash scripts/deploy-plesk.sh
```

---

## Comandos Útiles

```bash
# Ver logs en tiempo real
docker compose -f docker-compose.plesk.yml logs -f

# Ver logs de un servicio específico
docker compose -f docker-compose.plesk.yml logs -f app
docker compose -f docker-compose.plesk.yml logs -f db

# Reiniciar solo la app
docker compose -f docker-compose.plesk.yml restart app

# Detener todo
docker compose -f docker-compose.plesk.yml down

# Reconstruir desde cero
docker compose -f docker-compose.plesk.yml build --no-cache
docker compose -f docker-compose.plesk.yml up -d

# Ver contenedores activos
docker compose -f docker-compose.plesk.yml ps

# Entrar al contenedor de la app
docker exec -it exa-ati-app sh

# Verificar salud
curl http://localhost:3001/api/health
```

---

## Variables de Entorno

Todas las variables están documentadas en `.env.plesk.example`. Las más importantes:

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | URL de PostgreSQL (local o externa) |
| `JWT_SECRET` | Sí | Secreto para JWT |
| `ENCRYPTION_KEY` | Sí | Clave de encriptación (32 caracteres) |
| `NEXT_PUBLIC_APP_URL` | Sí | URL pública de la aplicación |
| `SRI_AMBIENTE` | No | 1=Pruebas, 0=Producción (default: 1) |
| `ANTICAPTCHA_KEY` | No | Para resolución de CAPTCHAs |
| `GEMINI_API_KEY` | No | Para chat tributario con IA |

---

## Solución de Problemas

### La app no responde
```bash
docker compose -f docker-compose.plesk.yml logs app
```
Verificar que el puerto 3001 no esté en uso por otro proceso.

### Error de base de datos
```bash
docker compose -f docker-compose.plesk.yml exec app npx prisma db push
```

### Puerto 3001 en uso
```bash
# Matar proceso en el puerto
fuser -k 3001/tcp
# O reiniciar la app
docker compose -f docker-compose.plesk.yml restart app
```

### Error 502 Bad Gateway en Plesk
Verificar que el proxy inverso esté configurado correctamente apuntando a `127.0.0.1:3001`.

---

## Notas Importantes

- **Puerto 3001**: La aplicación escucha en el puerto 3001 internamente. Plesk redirige desde el puerto 80/443.
- **Base de datos**: Si usas Neon (cloud), comenta el servicio `db` en `docker-compose.plesk.yml` y configura `DATABASE_URL` con tu URL de Neon.
- **SSL**: Plesk maneja los certificados SSL. No necesitas Certbot en Docker.
- **Volumes**: Los datos persisten en volumes de Docker (`exa-ati-downloads`, `exa-ati-browser-session`, etc.).
