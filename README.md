# Chat Híbrido TCP/UDP en Tiempo Real

Sistema de mensajería instantánea orientado a tecnologías **Open Source** que implementa una arquitectura híbrida utilizando los protocolos **TCP/IP** y **UDP** sobre sockets nativos. Una máquina virtual (**CachyOS**) actúa como host principal centralizando el control de sesiones y la difusión de datagramas entre un máximo de **4 usuarios simultáneos**.

---

## Arquitectura del Sistema

El proyecto separa la confiabilidad de la gestión de sesiones de la velocidad de transmisión de mensajes mediante dos canales independientes:

* **Canal TCP (Puerto `4000`) — Control y Confiabilidad:**
  * Gestiona el inicio de sesión (`LOGIN:<usuario>:<puerto_udp>`) y la desconexión de clientes.
  * Garantiza el límite estrictamente controlado de **4 usuarios conectados** (rechazando al quinto usuario con un mensaje de sala llena).
  * Mantiene sincronizada en tiempo real la lista de participantes activos (`USERS:...`).
* **Canal UDP (Puerto `4001`) — Mensajería en Tiempo Real:**
  * Transmite los mensajes del chat (`CHAT:<usuario>:<mensaje>`) mediante datagramas ligeros sin sobrecarga de conexión.
  * El host principal recibe cada datagrama y lo reenvía inmediatamente a la IP y puerto UDP registrados de cada cliente activo.
* **Puente Local (`bridge.js`) + Interfaz Web:**
  * Dado que los navegadores web no tienen acceso directo a sockets TCP/UDP puros por seguridad, cada cliente ejecuta un proceso ligero en Node.js que comunica la interfaz web (**HTML/CSS/JS** mediante `HTTP` y `Server-Sent Events`) con los sockets nativos `net` y `dgram`.

```text
[Navegador Web] <-- HTTP / SSE --> [bridge.js (Cliente)] <== TCP (4000) / UDP (4001) ==> [host-server.js (VM CachyOS)]
```

---

## Estructura del Proyecto

```text
chat-tcp-udp/
├── README.md                # Documentación del proyecto
├── server/
│   └── host-server.js       # Servidor principal (Sockets TCP y UDP) alojado en la VM
└── client/
    ├── bridge.js            # Cliente puente entre el navegador y los sockets de red
    └── public/
        ├── index.html       # Estructura de la interfaz de usuario
        ├── styles.css       # Estilos visuales responsivos
        └── app.js           # Lógica del cliente web y recepción de eventos en vivo
```

---

## Recursos y Tecnologías Open Source Utilizadas

* **Entorno de Ejecución:** [Node.js](https://nodejs.org/) (módulos nativos `net`, `dgram`, `http`, `fs`, `path`, sin dependencias externas).
* **Frontend:** HTML5, CSS3 y JavaScript Vanilla (ES6+ con `EventSource` / SSE).
* **Sistema Operativo Host (VM):** [CachyOS](https://cachyos.org/) (distribución Linux basada en Arch Linux).
* **Herramientas de Red y Control de Versiones:** Git, `ufw` (Uncomplicated Firewall), `iproute2` y `tcpdump`.

---

## Requisitos Previos y Configuración de Red

### 1. Configuración de la Máquina Virtual
Para que el host principal y los clientes se comuniquen dentro de la misma red local (LAN):
1. Abre la configuración de red de la VM (VirtualBox / VMware).
2. Cambia el modo del adaptador de red a **Adaptador Puente (Bridged Adapter)** vinculado a la interfaz de red activa del equipo anfitrión.

### 2. Preparación del Host Principal (VM CachyOS)
Instala las herramientas necesarias y habilita los puertos en el firewall del sistema:

```bash
# Actualizar repositorios e instalar Node.js, Git y herramientas de red
sudo pacman -Syu git nodejs ufw tcpdump

# Habilitar puertos TCP y UDP en el firewall
sudo ufw allow 4000/tcp
sudo ufw allow 4001/udp
sudo ufw enable
```

### 3. Preparación de los Equipos Cliente (Windows / Linux)
* Tener instalado **Node.js** (v18 o superior).
* Permitir el acceso de red a *Node.js* si el Firewall de Windows solicita autorización al iniciar el cliente (necesario para recibir los paquetes UDP entrantes).

---

## Guía de Ejecución Paso a Paso

### Paso 1: Iniciar el Host Principal en la VM CachyOS

1. Clona el repositorio y accede al directorio del proyecto:
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd <NOMBRE_DE_LA_CARPETA>
   ```
2. Obtén la dirección IP local de la máquina virtual:
   ```bash
   ip -4 addr show | grep inet
   ```
   *(Ejemplo de salida: `192.168.1.45`)*
3. Ejecuta el servidor principal:
   ```bash
   node server/host-server.js
   ```
   La consola confirmará que ambos servicios están activos:
   ```text
   Host TCP escuchando en 0.0.0.0:4000
   Host UDP escuchando en 0.0.0.0:4001
   ```

### Paso 2: Conectar los Clientes de Chat

En cada equipo cliente (o abriendo múltiples terminales para simular hasta 4 usuarios), ejecuta `bridge.js` indicando la **IP de la VM CachyOS** y un **puerto web local distinto** por usuario:

* **Terminal 1 (Usuario 1):**
  ```bash
  node client/bridge.js 192.168.1.45 3001
  ```
  Abrir en el navegador: `http://localhost:3001`

* **Terminal 2 (Usuario 2):**
  ```bash
  node client/bridge.js 192.168.1.45 3002
  ```
  Abrir en el navegador: `http://localhost:3002`

*(Repite con los puertos `3003` y `3004` para completar la sala de 4 usuarios).*

---

## Verificación de Paquetes en Vivo (Auditoría de Red)

Para inspeccionar en tiempo real el tráfico **TCP** (handshake, registro y lista de usuarios) y **UDP** (datagramas de mensajes) que recibe y reenvía la VM CachyOS, ejecuta en una segunda terminal del servidor:

```bash
sudo tcpdump -i any port 4000 or port 4001 -n
```
