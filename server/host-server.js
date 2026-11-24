/*Este es el archivo .js que permitirá convertir el VM principal como servidor host.
Recibe conexiones TCP para controlar el límite de 4 usuarios activos 
y escucha datagramas UDP para reenviar los mensajes del chat a todos los participantes.

Hecho por: Ahmed Diaz (8-974-474)
           Orlando Valdés (8-997-1296)
Curso: Redes de Computadoras
Grupo: 1GS132 */

const net = require('net');
const dgram = require('dgram');

const TCP_PORT = 4000;
const UDP_PORT = 4001;
const MAX_USERS = 4;

// Mapa de usuarios conectados: username -> { tcpSocket, ip, udpPort }
const activeUsers = new Map();

function broadcastUserList() {
    const userList = Array.from(activeUsers.keys()).join(',');
    const payload = `USERS:${userList}\n`;
    for (const user of activeUsers.values()) {
        user.tcpSocket.write(payload);
    }
}

// --- SERVIDOR TCP (Control de sesión y lista de usuarios) ---
const tcpServer = net.createServer((socket) => {
    let currentUser = null;
    // Limpiar prefijo IPv6 si la conexión entra como ::ffff:192.168.x.x
    const clientIp = socket.remoteAddress.replace(/^::ffff:/, '');

    socket.on('data', (data) => {
        const message = data.toString().trim();

        if (message.startsWith('LOGIN:')) {
            const [, username, udpPort] = message.split(':');

            if (activeUsers.size >= MAX_USERS) {
                socket.write('ERROR:Sala llena (máximo 4 usuarios)\n');
                socket.end();
                return;
            }
            if (activeUsers.has(username)) {
                socket.write('ERROR:El nombre de usuario ya está en uso\n');
                socket.end();
                return;
            }

            currentUser = username;
            activeUsers.set(username, {
                tcpSocket: socket,
                ip: clientIp,
                udpPort: parseInt(udpPort, 10)
            });

            console.log(`[TCP] Usuario conectado: ${username} (${clientIp}:${udpPort}) | Total: ${activeUsers.size}/${MAX_USERS}`);
            socket.write('OK:Conectado\n');
            broadcastUserList();
        }
    });

    const handleDisconnect = () => {
        if (currentUser && activeUsers.has(currentUser)) {
            activeUsers.delete(currentUser);
            console.log(`[TCP] Usuario desconectado: ${currentUser} | Total: ${activeUsers.size}/${MAX_USERS}`);
            broadcastUserList();
        }
    };

    socket.on('close', handleDisconnect);
    socket.on('error', handleDisconnect);
});

// --- SERVIDOR UDP (Recepción y reenvío de mensajes de chat) ---
const udpServer = dgram.createSocket('udp4');

udpServer.on('message', (msg, rinfo) => {
    const text = msg.toString();
    console.log(`[UDP] Paquete recibido desde ${rinfo.address}:${rinfo.port} -> ${text}`);

    // Reenviar el datagrama UDP a todos los usuarios registrados
    for (const user of activeUsers.values()) {
        udpServer.send(msg, user.udpPort, user.ip, (err) => {
            if (err) console.error(`[UDP] Error enviando a ${user.ip}:${user.udpPort}`, err);
        });
    }
});

tcpServer.listen(TCP_PORT, '0.0.0.0', () => {
    console.log(`Host TCP escuchando en 0.0.0.0:${TCP_PORT}`);
});

udpServer.bind(UDP_PORT, '0.0.0.0', () => {
    console.log(`Host UDP escuchando en 0.0.0.0:${UDP_PORT}`);
});