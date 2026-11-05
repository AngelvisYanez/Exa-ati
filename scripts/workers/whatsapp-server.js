const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
app.use(express.json());

const PORT = 8000;

console.log("Iniciando cliente de WhatsApp (whatsapp-web.js)...");
console.log("Si es la primera vez, aparecerá un código QR grande en esta consola. Escanéalo con WhatsApp.");

const fs = require('fs');
let executablePath;
if (process.platform === 'win32') {
    const winChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (fs.existsSync(winChrome)) executablePath = winChrome;
}

const puppeteerConfig = {
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote'
    ]
};
if (executablePath) {
    puppeteerConfig.executablePath = executablePath;
}

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "OFSERCONT_IA_BOT" }),
    puppeteer: puppeteerConfig
});

client.on('qr', (qr) => {
    console.log('\n=============================================================');
    console.log('Escanea el siguiente código QR con WhatsApp -> Dispositivos vinculados:');
    console.log('=============================================================\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(`\n======================================================`);
    console.log(`✅ [WhatsApp Web] Cliente conectado exitosamente`);
    console.log(`✅ [WhatsApp Web] Servidor local iniciado en http://localhost:${PORT}`);
    console.log(`✅ [WhatsApp Web] Listo para recibir peticiones en POST http://localhost:${PORT}/sendText`);
    console.log(`======================================================\n`);
});

client.on('disconnected', (reason) => {
    console.log('[WhatsApp Web] Cliente desconectado:', reason);
});

client.initialize();

app.post('/sendText', async (req, res) => {
    try {
        const { to, message } = req.body;
        
        if (!to || !message) {
            return res.status(400).json({ error: "Faltan parámetros 'to' o 'message'" });
        }

        const cleanNumber = to.replace(/\D/g, '');
        const chatId = `${cleanNumber}@c.us`;

        console.log(`[WhatsApp Web] Solicitud de envío a ${chatId}...`);
        
        const result = await client.sendMessage(chatId, message);
        
        console.log(`[WhatsApp Web] Mensaje enviado a ${chatId}`);
        return res.json({ success: true, result });
    } catch (error) {
        console.error("[WhatsApp Web] Error al enviar mensaje:", error);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`[API] Iniciando Express en puerto ${PORT}...`);
});
