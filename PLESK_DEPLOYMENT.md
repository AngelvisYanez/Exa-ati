# Despliegue en Plesk (Git + Docker)

## Configuración Inicial (una sola vez)

### 1. Conectar repositorio en Plesk
1. Ve a tu dominio → **Git**
2. Agrega la URL del repositorio: `https://github.com/AngelvisYanez/Exa-ati.git`
3. En **Repository Settings**, activa **Enable additional deploy actions** y pon:

```bash
bash scripts/deploy-plesk.sh
```

### 2. Variables de entorno
La primera vez que ejecutes el deploy, se creará un `.env` en el directorio del stack. Edítalo con tus valores:

```bash
nano /opt/psa/var/modules/docker/stacks/exa-ati/.env
```

### 3. Proxy inverso
En tu dominio → **Hosting Settings** o **Proxy Settings**, configura:

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
    proxy_read_timeout 300s;
    client_max_body_size 50M;
}
```

---

## Despliegues Futuros

### Opción A: Automático (recomendado)
Cada vez que hagas **Pull** en la extensión Git de Plesk, se ejecutará automáticamente el script de deploy.

### Opción B: Manual
Si necesitas ejecutar el deploy manualmente:

```bash
# Por SSH
cd /var/www/tu-dominio
bash scripts/deploy-plesk.sh
```

### Opción C: Desde Plesk UI
1. Ve a **Docker** → selecciona el stack `exa-ati`
2. Haz clic en **Build** (para reconstruir la imagen)
3. Haz clic en **Run** (para levantar los contenedores)

---

## Comandos Útiles por SSH

```bash
# Ver logs
docker logs -f exa-ati-app

# Ver estado
docker ps --filter "name=exa-ati"

# Reiniciar solo la app
docker restart exa-ati-app

# Verificar salud
curl http://localhost:3001/api/health

# Entrar al contenedor
docker exec -it exa-ati-app sh
```

---

## Solución de Problemas

### Error "no such file: Dockerfile"
El directorio del stack está vacío. Ejecuta:
```bash
bash scripts/deploy-plesk.sh
```

### Error 502 Bad Gateway
El contenedor no está corriendo o el proxy inverso está mal configurado:
```bash
docker ps --filter "name=exa-ati"
# Si no aparece, reiniciar:
docker compose -f /opt/psa/var/modules/docker/stacks/exa-ati/compose.yaml up -d
```

### Puerto 3001 en uso
```bash
fuser -k 3001/tcp
docker restart exa-ati-app
```
