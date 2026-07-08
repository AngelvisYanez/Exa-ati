# Guía de Despliegue en Plesk (vía Git)

Para desplegar este proyecto Next.js en Plesk utilizando la extensión Git y Node.js, sigue estos pasos:

## 1. Configuración de Git en Plesk
1. Ve a tu dominio en Plesk y abre **Git**.
2. Añade tu repositorio (si es privado, asegúrate de configurar la clave SSH de Plesk en tu proveedor de Git).
3. Configura el despliegue automático (Webhook) o manual hacia el directorio raíz de tu dominio (ej. `/httpdocs` o `/aplicacion`).

## 2. Configuración de Node.js en Plesk
1. Ve a **Node.js App** en el panel de tu dominio en Plesk.
2. Configura las siguientes opciones:
   - **Node.js Version**: 20.x o superior (la que sea compatible con Next.js 15/16).
   - **Document Root**: `/httpdocs/public` (Plesk necesita apuntar a una carpeta pública por seguridad, aunque la app corra en la raíz).
   - **Application Root**: `/httpdocs` (o donde se haya clonado el repo).
   - **Application Mode**: `production`.
   - **Application Startup File**: `server.js` (Este archivo ha sido creado en la raíz del proyecto para compatibilidad con Phusion Passenger de Plesk).

## 3. Variables de Entorno
1. En la configuración de **Node.js App** en Plesk, añade las variables de entorno necesarias (las mismas que tienes en tu `.env` o `.env.example`).
   - `DATABASE_URL`
   - Cualquier otra variable que requiera tu aplicación.

## 4. Scripts de Despliegue (Acciones Adicionales)
Dado que Next.js necesita compilarse, debes configurar Plesk para que ejecute el build después de obtener los cambios de Git.
1. En Plesk, ve a **Git** > **Repository Settings** (Ajustes del Repositorio).
2. Marca la opción **Enable additional deploy actions** (Habilitar acciones de despliegue adicionales).
3. En el recuadro, pega el siguiente script:
   ```bash
   npm install
   npx prisma generate
   npm run build
   touch tmp/restart.txt
   ```
   *(Nota: `touch tmp/restart.txt` le dice a Passenger que reinicie la aplicación Node.js).*

## 5. Notas Importantes
- **npm install**: Es importante que no se ejecute con el flag `--production` durante la fase de despliegue, ya que `next build` requiere algunas `devDependencies` (como Typescript y Tailwind) para compilar. El script de arriba usa `npm install` normal.
- El archivo `server.js` creado en la raíz es el punto de entrada que utilizará Plesk para levantar la aplicación Next.js en modo producción en el puerto asignado dinámicamente por Plesk.
- **Puppeteer / Chromium**: Este proyecto utiliza `@sparticuz/chromium` y `playwright-extra`/`puppeteer-core`. Plesk (y por debajo CentOS/Ubuntu) debe tener instaladas las dependencias a nivel sistema operativo para que Chromium pueda ejecutarse (ej. `libnss3`, `libatk1.0-0`, `libx11-xcb1`, etc.). Si encuentras errores de Chromium al ejecutar tu aplicación, deberás contactar al administrador del servidor Plesk para que instale estas bibliotecas del sistema.
