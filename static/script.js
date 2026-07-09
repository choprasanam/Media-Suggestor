document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    const MAX_QUESTIONS = 5;
    let history = [];
    let currentQuestion = "";
    let selectedCategory = "";

    // --- DOM Elements ---
    const elements = {
        categorySection: document.getElementById('category-section'),
        startSection: document.getElementById('start-section'),
        quizSection: document.getElementById('quiz-section'),
        loadingSection: document.getElementById('loading-section'),
        resultsSection: document.getElementById('results-section'),
        errorSection: document.getElementById('error-section'),
        
        categoryBtns: document.querySelectorAll('.category-btn'),
        backToCategoriesBtn: document.getElementById('back-to-categories'),
        startHeadline: document.getElementById('start-headline'),
        startBody: document.getElementById('start-body'),
        
        startBtn: document.getElementById('start-btn'),
        quizForm: document.getElementById('quiz-form'),
        answerInput: document.getElementById('answer-input'),
        questionText: document.getElementById('question-text'),
        loadingTextDisplay: document.getElementById('loading-text-display'),
        itemsGrid: document.getElementById('items-grid'),
        errorText: document.getElementById('error-text'),
        retryBtn: document.getElementById('retry-btn'),
        restartBtn: document.getElementById('restart-btn'),
        progressContainer: document.getElementById('progress-container'),
        progressBar: document.getElementById('progress-bar'),
        progressText: document.getElementById('progress-text')
    };

    // --- Core Logic ---
    
    // Category Selection
    elements.categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedCategory = btn.dataset.category;
            
            // Update texts based on category
            if (selectedCategory === 'book') {
                elements.startHeadline.innerHTML = "Find a Book<br>Worth Your Time.";
            } else if (selectedCategory === 'movie') {
                elements.startHeadline.innerHTML = "Find a Movie<br>Worth Your Time.";
            } else if (selectedCategory === 'music') {
                elements.startHeadline.innerHTML = "Find Music<br>Worth Your Time.";
            }
            
            elements.categorySection.classList.add('hidden');
            elements.startSection.classList.remove('hidden');
        });
    });

    elements.backToCategoriesBtn.addEventListener('click', () => {
        elements.startSection.classList.add('hidden');
        elements.categorySection.classList.remove('hidden');
    });

    elements.startBtn.addEventListener('click', startQuiz);
    elements.quizForm.addEventListener('submit', handleAnswer);

    elements.retryBtn.addEventListener('click', () => {
        elements.errorSection.classList.add('hidden');
        if (history.length >= MAX_QUESTIONS) {
            fetchRecommendations();
        } else {
            fetchNextQuestion();
        }
    });

    elements.restartBtn.addEventListener('click', () => {
        history = [];
        selectedCategory = "";
        elements.resultsSection.classList.add('hidden');
        elements.categorySection.classList.remove('hidden');
        elements.progressContainer.classList.add('hidden');
    });

    async function startQuiz() {
        elements.startSection.classList.add('hidden');
        elements.progressContainer.classList.remove('hidden');
        history = [];
        updateProgress();
        await fetchNextQuestion();
    }

    async function fetchNextQuestion() {
        if (history.length > 0) {
            showLoading("Refining the search...");
            elements.quizSection.classList.add('hidden');
        }

        try {
            const response = await fetch('/api/next_question', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history, category: selectedCategory })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to connect to the curator.');

            if (data.done || history.length >= MAX_QUESTIONS) {
                await fetchRecommendations();
                return;
            }

            currentQuestion = data.question;
            elements.questionText.textContent = currentQuestion;
            elements.answerInput.value = '';

            hideLoading();
            elements.quizSection.classList.remove('hidden');
            elements.answerInput.focus();

        } catch (error) {
            console.error(error);
            showError(error.message);
        }
    }

    async function handleAnswer(e) {
        e.preventDefault();
        const answer = elements.answerInput.value.trim();
        if (!answer) return;

        history.push({ question: currentQuestion, answer });
        updateProgress();

        if (history.length >= MAX_QUESTIONS) {
            await fetchRecommendations();
        } else {
            elements.quizSection.classList.add('hidden');
            showLoading("Considering your thoughts...");
            await fetchNextQuestion();
        }
    }

    async function fetchRecommendations() {
        showLoading("Curating your final selections...");
        elements.quizSection.classList.add('hidden');
        elements.progressContainer.classList.add('hidden');

        try {
            const response = await fetch('/api/recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history, category: selectedCategory })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Curation failed.');

            renderItems(data.recommendations);
            hideLoading();
            elements.resultsSection.classList.remove('hidden');

        } catch (error) {
            console.error(error);
            showError(error.message);
        }
    }

    function updateProgress() {
        const count = history.length;
        const currentNum = Math.min(count + 1, MAX_QUESTIONS);
        const percentage = (count / MAX_QUESTIONS) * 100;

        if (elements.progressBar) elements.progressBar.style.width = `${percentage}%`;
        if (elements.progressText) elements.progressText.textContent = `Inquiry ${currentNum} of ${MAX_QUESTIONS}`;
    }

    function showLoading(msg) {
        elements.loadingTextDisplay.textContent = msg;
        elements.loadingSection.classList.remove('hidden');
        elements.errorSection.classList.add('hidden');
    }

    function hideLoading() {
        elements.loadingSection.classList.add('hidden');
    }

    function showError(msg) {
        hideLoading();
        elements.errorText.textContent = msg;
        elements.errorSection.classList.remove('hidden');
    }

    function renderItems(items) {
        elements.itemsGrid.innerHTML = '';
        if (!items || items.length === 0) {
            elements.itemsGrid.innerHTML = '<p>No recommendations found in the current selection.</p>';
            return;
        }

        items.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'book-card';
            card.style.animation = `fadeUp 0.6s ease forwards`;
            card.style.animationDelay = `${index * 0.1}s`;
            card.style.opacity = '0';

            const creatorRole = selectedCategory === 'movie' ? 'Directed by' : 
                                selectedCategory === 'music' ? 'By Artist' : 'By';

            card.innerHTML = `
                <div class="book-meta">${escapeHtml(item.genre || 'General')}</div>
                <h3 class="book-title">${escapeHtml(item.title || 'Untitled Work')}</h3>
                <div class="book-author">${creatorRole} ${escapeHtml(item.creator || 'Unknown')}</div>
                <div class="book-summary">${escapeHtml(item.summary || '')}</div>
                <div class="book-reason">${escapeHtml(item.reason || 'Selected based on your profile.')}</div>
            `;

            elements.itemsGrid.appendChild(card);
        });
    }

    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
});