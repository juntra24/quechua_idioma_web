const API_URL = 'http://localhost:3000/chat';

class ChatBot {
    constructor() {
        this.chatButton = document.getElementById('chat-button');
        this.chatContainer = document.getElementById('chat-container');
        this.closeChat = document.getElementById('close-chat');
        this.sendMessage = document.getElementById('send-message');
        this.chatInput = document.getElementById('chat-input');
        this.chatMessages = document.getElementById('chat-messages');
        if (!this.chatButton || !this.chatContainer || !this.closeChat || !this.sendMessage || !this.chatInput || !this.chatMessages) {
            return;
        }
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.chatButton.addEventListener('click', () => this.toggleChat());
        this.closeChat.addEventListener('click', () => this.hideChat());
        this.sendMessage.addEventListener('click', () => this.handleSendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });
    }

    toggleChat() {
        this.chatContainer.classList.toggle('hidden');
        if (!this.chatContainer.classList.contains('hidden')) {
            this.chatInput.focus();
        }
    }

    hideChat() {
        this.chatContainer.classList.add('hidden');
    }

    async handleSendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        this.addMessage(message, true);
        this.chatInput.value = '';
        this.chatInput.focus();

        const thinkingEl = this.addMessage('Pensando...', false);

        try {
            const response = await this.sendToBot(message);
            thinkingEl.textContent = response;
        } catch (error) {
            thinkingEl.textContent = 'Lo siento, ha ocurrido un error al procesar tu mensaje.';
        }
    }

    async sendToBot(message) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: message })
            });

            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = await response.json();
                return data.reply || data.text || JSON.stringify(data);
            }
            return await response.text();
        } catch (error) {
            throw error;
        }
    }

    addMessage(message, isUser = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(isUser ? 'user-message' : 'bot-message');
        messageElement.textContent = message;
        this.chatMessages.appendChild(messageElement);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        return messageElement;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});
