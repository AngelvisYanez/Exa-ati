# Guía de Despliegue en Plesk (vía Git)

Para desplegar este proyecto Next.js en Plesk utilizando la extensión Git y Node.js, sigue estos pasos:

## 1. Configuración de Git en Plesk
1. Ve a tu dominio en Plesk y abre **Git**.
2. Añade tu repositorio (si es privado, asegúrate de configurar la clave SSH de Plesk en tu proveedor de Git).
3. Configura el despliegue automático (Webhook) o manual hacia el directorio raíz de tu dominio (ej. `/httpdocs` o `/aplicacion`).

## 2. Configuración de Node.js en Plesk
1. Ve a **Node.js App** en el panel de tu dominio en Plesk.
2. Configura las siguientes opciones:
   - **Node.js Version**: 20.x o superior (la que sea compatible con Next.js).
   - **Document Root**: `/httpdocs/public` (Plesk necesita apuntar a una carpeta pública por seguridad, aunque la app corra en la raíz).
   - **Application Root**: `/httpdocs` (o donde se haya clonado el repo).
   - **Application Mode**: `production`.
   - **Application Startup File**: `app.js` (Este archivo ha sido creado en la raíz del proyecto para compatibilidad con Phusion Passenger de Plesk y fuerza el modo producción).

## 3. Variables de Entorno
1. En la configuración de **Node.js App** en Plesk, añade las variables de entorno necesarias (las mismas que tienes en tu `.env` o `.env.example`).
   - `DATABASE_URL`
   - Cualquier otra variable que requiera tu aplicación.

## 4. Instalación y Compilación (MUY IMPORTANTE)
Next.js requiere que la aplicación sea compilada antes de poder ejecutarse. Si omites esto, tu web se quedará colgada mostrando un error **504 Gateway Time-out**.

Cada vez que hagas un despliegue (Pull de Git), debes realizar lo siguiente en la pantalla de Node.js App:
1. Haz clic en **NPM install** para instalar nuevas dependencias.
2. Haz clic en **Run script** y selecciona **`build`**. Esto ejecuta `next build` en segundo plano. Espera pacientemente a que termine (el estado cambiará a `Success`).
3. Una vez compilado, presiona el botón **Restart App** (Reiniciar Aplicación).

*(Opcional)* Puedes automatizar esto en Plesk yendo a **Git > Repository Settings**, marcando **Enable additional deploy actions** y poniendo:
```bash
npm install
npm run build
touch tmp/restart.txt
```

## 5. 🛑 Lo que NUNCA debes hacer en Plesk
- **NUNCA ejecutes el script `start` o `dev` desde Plesk (Run Script):** Plesk, a través de Passenger y el archivo `app.js`, ya levanta tu servidor automáticamente en el puerto correcto. Si intentas iniciarlo a mano, generará un error `EADDRINUSE` y bloqueará los puertos.

## 6. Notas Adicionales
- Si el servidor se queda atascado con procesos Node.js huérfanos bloqueando el puerto, puedes ejecutar `npm exec -- kill-port 3000` y `npm exec -- kill-port 3001` desde un terminal SSH, o simplemente darle a **Restart App** en Plesk.
- **Puppeteer / Chromium**: Este proyecto utiliza `@sparticuz/chromium`. Plesk (y por debajo Ubuntu/CentOS) debe tener instaladas las dependencias a nivel sistema operativo para que Chromium pueda ejecutarse (`libnss3`, `libatk1.0-0`, `libx11-xcb1`, etc.).
