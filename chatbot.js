(function(){
  const API_KEY = 'sk-807f803d0b74443fb6bc9ccb86264e6f';
  const API_URL = 'https://api.deepseek.com/v1/chat/completions';

  function initChatbot() {
    
    document.body.insertAdjacentHTML('beforeend', `
      <button id="chat-button" aria-label="Abrir chat">💬</button>
      <div id="chat-container" class="hidden" role="dialog" aria-label="Chatbot">
        <div id="chat-header">
          <div>Chatbot</div>
          <button id="close-chat" aria-label="Cerrar" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer">✕</button>
        </div>
        <div id="chat-messages" aria-live="polite"></div>
        <div id="chat-input-wrap">
          <input id="chat-input" type="text" placeholder="Escribe un mensaje..." aria-label="Mensaje"/>
          <button id="send-btn" aria-label="Enviar">Enviar</button>
        </div>
      </div>
    `);


    const btn = document.getElementById('chat-button');
    const container = document.getElementById('chat-container');
    const closeBtn = document.getElementById('close-chat');
    const sendBtn = document.getElementById('send-btn');
    const input = document.getElementById('chat-input');
    const messagesEl = document.getElementById('chat-messages');

    
  }

  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }
})();
