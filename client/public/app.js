const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const loginError = document.getElementById('login-error');

const usersList = document.getElementById('users-list');
const userCount = document.getElementById('user-count');
const myAvatar = document.getElementById('my-avatar');
const myUsernameLabel = document.getElementById('my-username-label');
const logoutBtn = document.getElementById('logout-btn');

const connDot = document.getElementById('conn-dot');
const connText = document.getElementById('conn-text');

const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const emojiToggle = document.getElementById('emoji-toggle');
const emojiPicker = document.getElementById('emoji-picker');

const EMOJIS = [
    '😀', '😂', '🤣', '😊', '😍', '😎', '🤔',
    '😮', '😢', '😡', '👍', '👎', '👏', '🔥',
    '🎉', '❤️', '💯', '🚀', '💻', '📡', '⚡',
    '✅', '❌', '🙏', '👀', '😅', '🥳', '🤝'
];

const AVATAR_COLORS = [
    '#60a5fa', '#34d399', '#fbbf24', '#f472b6',
    '#a78bfa', '#fb7185', '#38bdf8', '#4ade80'
];

let myUsername = '';
let previousUsers = null;

// --- Utilidades ---
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getUserColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMessageText(text) {
    const safeText = escapeHTML(text);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const imageUrls = [];

    const linkedText = safeText.replace(urlRegex, (url) => {
        if (/\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url)) {
            imageUrls.push(url);
        }
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });

    const previews = imageUrls
        .map((url) => `<a href="${url}" target="_blank" rel="noopener noreferrer"><img class="chat-img-preview" src="${url}" alt="Imagen compartida" loading="lazy"></a>`)
        .join('');

    return linkedText + previews;
}

function removeEmptyState() {
    const empty = document.getElementById('empty-state');
    if (empty) empty.remove();
}

function resetEmptyState() {
    messagesDiv.innerHTML = `
        <div id="empty-state" class="empty-state">
            <span>💬</span>
            <p>Aún no hay mensajes. ¡Envía el primero!</p>
        </div>
    `;
}

function addSystemMessage(text) {
    removeEmptyState();
    const div = document.createElement('div');
    div.className = 'msg-system';
    div.textContent = `${text} • ${formatTime()}`;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// --- Inicializar selector de emojis ---
EMOJIS.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-item';
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
        const start = messageInput.selectionStart ?? messageInput.value.length;
        const end = messageInput.selectionEnd ?? messageInput.value.length;
        messageInput.value =
            messageInput.value.slice(0, start) + emoji + messageInput.value.slice(end);
        const nextPos = start + emoji.length;
        messageInput.focus();
        messageInput.setSelectionRange(nextPos, nextPos);
    });
    emojiPicker.appendChild(btn);
});

emojiToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiToggle) {
        emojiPicker.classList.add('hidden');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        emojiPicker.classList.add('hidden');
    }
});

// --- Escuchar eventos enviados por bridge.js (TCP users y UDP chat) ---
const eventSource = new EventSource('/events');

eventSource.onopen = () => {
    connDot.className = 'status-dot online';
    connText.textContent = 'En línea';
};

eventSource.onerror = () => {
    connDot.className = 'status-dot offline';
    connText.textContent = 'Reconectando...';
};

eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'users') {
        if (myUsername && previousUsers !== null) {
            const joined = data.users.filter((u) => !previousUsers.includes(u));
            const left = previousUsers.filter((u) => !data.users.includes(u));

            joined.forEach((u) => {
                if (u !== myUsername) addSystemMessage(`${u} se unió a la sala`);
            });
            left.forEach((u) => {
                if (u !== myUsername) addSystemMessage(`${u} salió de la sala`);
            });
        }

        previousUsers = data.users;
        userCount.textContent = data.users.length;
        usersList.innerHTML = data.users
            .map((u) => {
                const isMe = u === myUsername;
                const color = getUserColor(u);
                const initial = escapeHTML(u.charAt(0));
                const safeName = escapeHTML(u);
                return `
                    <li class="${isMe ? 'is-me' : ''}">
                        <span class="avatar" style="background: ${color}">${initial}</span>
                        <span class="user-name-text">${safeName}${isMe ? ' (Tú)' : ''}</span>
                    </li>
                `;
            })
            .join('');
    }

    if (data.type === 'chat') {
        removeEmptyState();
        const isOwn = data.sender === myUsername;
        const senderColor = getUserColor(data.sender);
        const div = document.createElement('div');
        div.className = `msg ${isOwn ? 'own' : ''}`;
        div.innerHTML = `
            <div class="msg-header">
                <span class="msg-sender" style="${isOwn ? '' : `color: ${senderColor}`}">${escapeHTML(data.sender)}</span>
                <span class="msg-time">${formatTime()}</span>
            </div>
            <div class="msg-body">${formatMessageText(data.text)}</div>
        `;
        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
};

// --- Login ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const username = usernameInput.value.trim();
    if (!username) return;

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });
    const result = await res.json();

    if (result.ok) {
        myUsername = username;
        myUsernameLabel.textContent = username;
        myAvatar.textContent = username.charAt(0);
        myAvatar.style.background = getUserColor(username);

        loginScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        addSystemMessage(`Te uniste como ${username}`);
        messageInput.focus();
    } else {
        loginError.textContent = result.error;
    }
});

// --- Salir / Cambiar de usuario ---
logoutBtn.addEventListener('click', async () => {
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (_) {
        // Si bridge.js aún no tiene /api/logout, vuelve al login sin bloquear la interfaz
    }

    myUsername = '';
    emojiPicker.classList.add('hidden');
    resetEmptyState();
    chatScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    usernameInput.value = '';
    usernameInput.focus();
});

// --- Enviar mensaje ---
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    emojiPicker.classList.add('hidden');

    await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    messageInput.value = '';
    messageInput.focus();
});