const API_KEY = 'sk-06dad8a653cc4b1498809e1dfedce208';
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

class ChatBot {
    constructor() {
        this.chatButton = document.getElementById('chat-button');
        this.chatContainer = document.getElementById('chat-container');
        this.closeChat = document.getElementById('close-chat');
        this.sendMessage = document.getElementById('send-message');
        this.chatInput = document.getElementById('chat-input');
        this.chatMessages = document.getElementById('chat-messages');
        
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

        try {
            const response = await this.sendToBot(message);
            this.addMessage(response);
        } catch (error) {
            this.addMessage('Lo siento, ha ocurrido un error al procesar tu mensaje.', false);
        }
    }

    async sendToBot(message) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        content: message
                    }],
                    model: 'deepseek-chat'
                })
            });

            if (!response.ok) {
                throw new Error('Error en la respuesta de la API');
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error al enviar mensaje al bot:', error);
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
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const chatBot = new ChatBot();
});
