const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const usersList = document.getElementById('users-list');
const userCount = document.getElementById('user-count');
const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('message-form');

let myUsername = '';

// Escuchar eventos enviados por bridge.js (TCP users y UDP chat)
const eventSource = new EventSource('/events');
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'users') {
        userCount.textContent = data.users.length;
        usersList.innerHTML = data.users
            .map(u => `<li>${u === myUsername ? `${u} (Tú)` : u}</li>`)
            .join('');
    }

    if (data.type === 'chat') {
        const div = document.createElement('div');
        div.className = `msg ${data.sender === myUsername ? 'own' : ''}`;
        div.innerHTML = `<strong>${data.sender}</strong><span>${data.text}</span>`;
        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
};

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const username = document.getElementById('username-input').value.trim();

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });
    const result = await res.json();

    if (result.ok) {
        myUsername = username;
        loginScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
    } else {
        loginError.textContent = result.error;
    }
});

messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;

    await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    input.value = '';
});