const questions = [
    {
        question: "¿Cómo se dice 'Hola' en quechua?",
        options: ["Rimaykullayki", "Tupananchiskama", "Allinmi"],
        correct: 0
    },
    {
        question: "¿Qué significa 'Tayta'?",
        options: ["Hermano", "Padre", "Tío"],
        correct: 1
    },
    {
        question: "¿Qué significa 'Mikuy'?",
        options: ["Dormir", "Caminar", "Comer"],
        correct: 2
    },
    {
        question: "¿Qué significa 'Hanan'?",
        options: ["Abajo", "Arriba", "Atrás"],
        correct: 1
    },
    {
        question: "¿Qué significa 'Chiri'?",
        options: ["Frío", "Lluvia", "Sol/Calor"],
        correct: 0
    },
    {
        question: "¿Qué significa 'Yuraq'?",
        options: ["Rojo", "Negro", "Blanco"],
        correct: 2
    },
    {
    question: "¿Cómo se dice 'Comida' en quechua?",
        options: ["Sara", "Papa", "Mikhuna"],
        correct: 2
    },
    {
        question: "¿Cómo se dice 'Otoño' en quechua?",
        options: ["Paukar waray mit'a", "Poqoy mit'a", "Chirau mit'a", "Aparkilla mit'a"],
        correct: 3
    },
    {
        question: "¿Cómo se dice 'Árboles' en quechua?",
        options: ["Urqu", "Sachakuna", "Mayu"],
        correct: 1
    },
    {
        question: "¿Cómo se dice 'Ayer' en quechua?",
        options: ["Qayna", "Paqarin", "Kunan"],
        correct: 0
    },
    {
        question: "¿Cómo se dice 'Cabeza' en quechua?",
        options: ["Ñawi", "Simi", "Uma"],
        correct: 2
    },
    {
        question: "¿Qué significa 'Kuntur'?",
        options: ["Cóndor", "Gato", "Perro"],
        correct: 0
    },
    {
        question: "¿Qué significa 'Chunka'?",
        options: ["Dos", "Diez", "Ocho"],
        correct: 1
    },
    {
        question: "¿Qué significa 'Sulpayki'?",
        options: ["Hasta luego", "De nada", "Gracias"],
        correct: 2
    },
    {
        question: "¿Qué significa 'Qam'?",
        options: ["Tú", "Yo", "Él/Ella"],
        correct: 0
    },
];

let currentQuestion = 0;
let score = 0;
let timeLeft = 300;
let timer = null;

// XP de sesión (visual)
const XP_PER_CORRECT = 10;
const XP_PENALTY_PER_WRONG = 5;
const XP_DISPLAY_MAX = 100;
let xpSession = 0;

// Inicialización
function init() {
    bindEvents();
    resetState();
    updateTimerDisplay();
    updateProgress();
    resetXp();
}

function bindEvents() {
    document.getElementById('start-quiz').addEventListener('click', startQuiz);
    document.getElementById('retry-quiz').addEventListener('click', retryQuiz);
}

// Estado
function resetState() {
    currentQuestion = 0;
    score = 0;
    timeLeft = 300;
    clearInterval(timer);
    timer = null;
    // asegurar vistas
    document.getElementById('quiz-intro').classList.remove('hidden');
    document.getElementById('quiz-game').classList.add('hidden');
    document.getElementById('quiz-result').classList.add('hidden');
    document.getElementById('correct-answers').textContent = '0';
    updateTimerDisplay();
    updateProgress();
}

// XP utilities (session visual)
function resetXp(){
    xpSession = 0;
    updateXpUI();
}
function changeXp(delta){
    xpSession = Math.max(0, Math.min(XP_DISPLAY_MAX, xpSession + Math.round(delta)));
    updateXpUI();
}
function updateXpUI(){
    const bar = document.getElementById('xpBar');
    const text = document.getElementById('xpText');
    if (!bar || !text) return;
    const pct = Math.round((xpSession / XP_DISPLAY_MAX) * 100);
    bar.style.width = pct + '%';
    text.textContent = `${xpSession} / ${XP_DISPLAY_MAX}`;
}

// Control del quiz
function startQuiz() {
    document.getElementById('quiz-intro').classList.add('hidden');
    document.getElementById('quiz-game').classList.remove('hidden');
    resetRoundState();
    startTimer();
    resetXp();
    showQuestion();
}

function resetRoundState() {
    currentQuestion = 0;
    score = 0;
    updateProgress();
}

// Timer
function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(tickTimer, 1000);
}

function tickTimer() {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
        finishQuiz();
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('minutes').textContent = minutes.toString().padStart(2, '0');
    document.getElementById('seconds').textContent = seconds.toString().padStart(2, '0');
}

// Preguntas y opciones
function getCurrentQuestion() {
    return questions[currentQuestion];
}

function showQuestion() {
    const q = getCurrentQuestion();
    if (!q) return finishQuiz();
    document.getElementById('question-text').textContent = q.question;
    updateProgress();
    renderOptions(q);
}

function renderOptions(question) {
    const optionsContainer = document.querySelector('.options-container');
    optionsContainer.innerHTML = '';
    question.options.forEach((option, index) => {
        const button = createOptionButton(option, index);
        optionsContainer.appendChild(button);
    });
}

function createOptionButton(text, index) {
    const button = document.createElement('button');
    button.className = 'option-btn';
    button.textContent = text;
    button.addEventListener('click', () => handleOptionClick(index));
    return button;
}

function handleOptionClick(selectedIndex) {
    checkAnswer(selectedIndex);
}

// Comprobación de respuestas
function checkAnswer(selectedIndex) {
    const q = getCurrentQuestion();
    if (!q) return;
    const correctIndex = q.correct;
    const isCorrect = (selectedIndex === correctIndex);
    if (isCorrect) {
        score++;
        changeXp(XP_PER_CORRECT); // sumar XP visual
    } else {
        changeXp(-XP_PENALTY_PER_WRONG); // restar XP visual
    }

    disableOptions();
    markButtons(selectedIndex, correctIndex);

    // esperar y pasar a la siguiente
    setTimeout(() => {
        currentQuestion++;
        if (currentQuestion < questions.length) {
            showQuestion();
        } else {
            finishQuiz();
        }
    }, 1500);
}

function disableOptions() {
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach(b => b.disabled = true);
}

function markButtons(selectedIndex, correctIndex) {
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach((button, index) => {
        button.classList.remove('correct', 'wrong');
        if (index === correctIndex) {
            button.classList.add('correct');
        } else if (index === selectedIndex && index !== correctIndex) {
            button.classList.add('wrong');
        }
    });
}

// Finalizar quiz
function finishQuiz() {
    clearInterval(timer);
    document.getElementById('quiz-game').classList.add('hidden');
    document.getElementById('quiz-result').classList.remove('hidden');
    document.getElementById('correct-answers').textContent = score;
    // Guardar resultado para que el dashboard lo procese al volver (local fallback)
    try {
      const payload = { correct: score, wrong: Math.max(0, questions.length - score), xpSession: xpSession, timestamp: Date.now() };
      localStorage.setItem('g_quiz_result', JSON.stringify(payload));
    } catch (e) { console.warn('No se pudo guardar el resultado del quiz:', e); }

    // Intentar enviar al backend si está disponible
    (async function sendToServer(){
      try {
        // obtener email del perfil si existe
        let profile = null;
        try { profile = JSON.parse(sessionStorage.getItem('g_profile') || localStorage.getItem('g_profile') || 'null'); } catch(e){}
        const email = profile && profile.email ? profile.email : undefined;
        const body = { email, correct: score, wrong: Math.max(0, questions.length - score), xpSession };
        const resp = await fetch('/api/quiz-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!resp.ok) {
          console.warn('Servidor quiz-result retornó error', await resp.text().catch(()=>resp.status));
          return;
        }
        const data = await resp.json().catch(()=>null);
        if (data && data.ok && data.user) {
          // opcional: actualizar local leaderboard record (si existe)
          try {
            const lb = JSON.parse(localStorage.getItem('g_leaderboard') || '[]');
            const idx = lb.findIndex(u => u.email === (data.user.email || ''));
            if (idx >= 0) { lb[idx].level = data.user.level; lb[idx].xp = data.user.xp; lb[idx].lastLogin = data.user.lastLogin; localStorage.setItem('g_leaderboard', JSON.stringify(lb)); }
          } catch(e){}
        }
      } catch (err) {
        // server not available; keep local logic
        console.warn('No se pudo enviar resultado al backend:', err);
      }
    })();
}

// Reintentar
function retryQuiz() {
    timeLeft = 300;
    document.getElementById('quiz-result').classList.add('hidden');
    document.getElementById('quiz-intro').classList.remove('hidden');
    resetState();
    resetXp();
}

// Utilidades
function updateProgress() {
    document.getElementById('current-question').textContent = Math.min(questions.length, currentQuestion + 1);
}

// Ejecutar init al cargar el script
init();
