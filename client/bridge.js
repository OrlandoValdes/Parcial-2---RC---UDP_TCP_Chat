/*Este es el archivo .js que ejerce como puente entre el servidor y los clientes.
Sirve los archivos de la carpeta public/ al navegador y abre los sockets reales 
net y dgram hacia la IP de la VM Debian.

Hecho por: Ahmed Diaz (8-974-474)
           Orlando Valdés (8-997-1296)
Curso: Redes de Computadoras
Grupo: 1GS132 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const dgram = require('dgram');

// Uso: node bridge.js <IP_VM_DEBIAN> <PUERTO_WEB_LOCAL>
const HOST_IP = process.argv[2] || '127.0.0.1';
const WEB_PORT = parseInt(process.argv[3], 10) || 3000;
const HOST_TCP_PORT = 4000;
const HOST_UDP_PORT = 4001;

let tcpClient = null;
let currentUsername = '';
let sseResponse = null;

// --- SOCKET UDP DEL CLIENTE ---
const udpClient = dgram.createSocket('udp4');
udpClient.bind(0); // Asigna un puerto UDP libre automáticamente

udpClient.on('message', (msg) => {
    const raw = msg.toString(); // Formato: CHAT:usuario:mensaje
    if (raw.startsWith('CHAT:')) {
        const firstColon = raw.indexOf(':');
        const secondColon = raw.indexOf(':', firstColon + 1);
        const sender = raw.slice(firstColon + 1, secondColon);
        const text = raw.slice(secondColon + 1);
        sendToBrowser({ type: 'chat', sender, text });
    }
});

function sendToBrowser(payload) {
    if (sseResponse) {
        sseResponse.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
}

// --- SERVIDOR HTTP + SSE PARA LA INTERFAZ WEB ---
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8'
};

const httpServer = http.createServer((req, res) => {
    // Canal en tiempo real hacia el navegador (Server-Sent Events)
    if (req.url === '/events') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        sseResponse = res;
        return;
    }

    // Endpoint de Login (abre conexión TCP con la VM)
    if (req.method === 'POST' && req.url === '/api/login') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { username } = JSON.parse(body);
            const localUdpPort = udpClient.address().port;

            tcpClient = new net.Socket();
            tcpClient.connect(HOST_TCP_PORT, HOST_IP, () => {
                tcpClient.write(`LOGIN:${username}:${localUdpPort}\n`);
            });

            tcpClient.on('data', (data) => {
                const lines = data.toString().trim().split('\n');
                for (const line of lines) {
                    if (line.startsWith('OK:')) {
                        currentUsername = username;
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: true }));
                    } else if (line.startsWith('ERROR:')) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: false, error: line.slice(6) }));
                    } else if (line.startsWith('USERS:')) {
                        const users = line.slice(6).split(',').filter(Boolean);
                        sendToBrowser({ type: 'users', users });
                    }
                }
            });

            tcpClient.on('error', (err) => {
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: err.message }));
                }
            });
        });
        return;
    }

    // Endpoint para enviar mensaje (envía paquete UDP a la VM)
    if (req.method === 'POST' && req.url === '/api/message') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { text } = JSON.parse(body);
            const packet = Buffer.from(`CHAT:${currentUsername}:${text}`);
            udpClient.send(packet, HOST_UDP_PORT, HOST_IP);
            res.writeHead(200);
            res.end();
        });
        return;
    }

    // Servir archivos estáticos de /public
    const safePath = req.url === '/' ? '/index.html' : req.url;
    const filePath = path.join(__dirname, 'public', safePath);
    const ext = path.extname(filePath);

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('No encontrado');
            return;
        }
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        res.end(content);
    });
});

httpServer.listen(WEB_PORT, () => {
    console.log(`Interfaz web disponible en: http://localhost:${WEB_PORT}`);
    console.log(`Apuntando al Host Debian en: ${HOST_IP} (TCP:${HOST_TCP_PORT} / UDP:${HOST_UDP_PORT})`);
});