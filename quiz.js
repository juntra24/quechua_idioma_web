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

document.getElementById('start-quiz').addEventListener('click', startQuiz);

function startQuiz() {
    document.getElementById('quiz-intro').classList.add('hidden');
    document.getElementById('quiz-game').classList.remove('hidden');
    currentQuestion = 0;
    score = 0;
    startTimer();
    showQuestion();
}

function startTimer() {
    timer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            endQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('minutes').textContent = minutes.toString().padStart(2, '0');
    document.getElementById('seconds').textContent = seconds.toString().padStart(2, '0');
}

function showQuestion() {
    const question = questions[currentQuestion];
    document.getElementById('question-text').textContent = question.question;
    document.getElementById('current-question').textContent = currentQuestion + 1;
    
    const optionsContainer = document.querySelector('.options-container');
    optionsContainer.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option;
        button.addEventListener('click', () => checkAnswer(index));
        optionsContainer.appendChild(button);
    });
}

function checkAnswer(selectedIndex) {
    const correct = questions[currentQuestion].correct === selectedIndex;
    if (correct) score++;
    
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach((button, index) => {
        button.disabled = true;
        if (index === questions[currentQuestion].correct) {
            button.classList.add('correct');
        } else if (index === selectedIndex && !correct) {
            button.classList.add('wrong');
        }
    });
    
    setTimeout(() => {
        currentQuestion++;
        if (currentQuestion < questions.length) {
            showQuestion();
        } else {
            endQuiz();
        }
    }, 1500);
}

function endQuiz() {
    clearInterval(timer);
    document.getElementById('quiz-game').classList.add('hidden');
    document.getElementById('quiz-result').classList.remove('hidden');
    document.getElementById('correct-answers').textContent = score;
}

document.getElementById('retry-quiz').addEventListener('click', () => {
    timeLeft = 300;
    document.getElementById('quiz-result').classList.add('hidden');
    document.getElementById('quiz-intro').classList.remove('hidden');
});
