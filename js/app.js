/* ===== 核心应用逻辑 ===== */

// ============ 全局变量 ============
let currentUserId = null;
let currentWordList = [];
let currentWordIndex = 0;
let currentQuizList = [];
let currentQuizIndex = 0;
let selectedQuizOption = -1;
let quizAnswered = false;
let assessmentAnswers = [];

// ============ 工具函数 ============
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function getStorageKey(userId, key) {
    return `cet_${userId}_${key}`;
}

function saveData(key, value) {
    if (!currentUserId) return;
    localStorage.setItem(getStorageKey(currentUserId, key), JSON.stringify(value));
}

function loadData(key, defaultValue) {
    if (!currentUserId) return defaultValue;
    const data = localStorage.getItem(getStorageKey(currentUserId, key));
    return data ? JSON.parse(data) : defaultValue;
}

// ============ 多用户管理 ============
function getUsers() {
    return JSON.parse(localStorage.getItem('cet_users') || '[]');
}

function saveUsers(users) {
    localStorage.setItem('cet_users', JSON.stringify(users));
}

function refreshUserSelect() {
    const users = getUsers();
    const select = document.getElementById('userSelect');
    select.innerHTML = '<option value="">-- 选择用户 --</option>';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        select.appendChild(option);
    });
    if (currentUserId) {
        select.value = currentUserId;
        const user = users.find(u => u.id === currentUserId);
        document.getElementById('currentUserName').textContent = user ? `👤 ${user.name}` : '未登录';
    }
}

function switchUser(userId) {
    if (!userId) {
        currentUserId = null;
        document.getElementById('currentUserName').textContent = '未登录';
        showToast('请选择用户');
        return;
    }
    currentUserId = userId;
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    document.getElementById('currentUserName').textContent = `👤 ${user.name}`;
    localStorage.setItem('cet_current_user', userId);
    showToast(`欢迎，${user.name}！`);
    initAllPages();
}

function showAddUserModal() {
    document.getElementById('addUserModal').style.display = 'flex';
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserName').focus();
}

function hideAddUserModal() {
    document.getElementById('addUserModal').style.display = 'none';
}

function addUser() {
    const name = document.getElementById('newUserName').value.trim();
    if (!name) {
        showToast('请输入用户名');
        return;
    }
    const users = getUsers();
    const newUser = {
        id: 'user_' + Date.now(),
        name: name,
        createdAt: new Date().toISOString()
    };
    users.push(newUser);
    saveUsers(users);
    currentUserId = newUser.id;
    localStorage.setItem('cet_current_user', currentUserId);
    hideAddUserModal();
    refreshUserSelect();
    showToast(`用户 ${name} 创建成功！`);
    initAllPages();
}

function deleteCurrentUser() {
    if (!currentUserId) {
        showToast('请先选择用户');
        return;
    }
    if (!confirm('确定要删除当前用户及其所有数据吗？此操作不可恢复！')) return;
    const users = getUsers().filter(u => u.id !== currentUserId);
    // 清除该用户的所有数据
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`cet_${currentUserId}_`)) {
            localStorage.removeItem(key);
        }
    });
    saveUsers(users);
    currentUserId = null;
    localStorage.removeItem('cet_current_user');
    refreshUserSelect();
    showToast('用户已删除');
    initAllPages();
}

function resetCurrentUserData() {
    if (!currentUserId) {
        showToast('请先选择用户');
        return;
    }
    if (!confirm('确定要重置当前用户的所有学习数据吗？此操作不可恢复！')) return;
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`cet_${currentUserId}_`)) {
            localStorage.removeItem(key);
        }
    });
    showToast('数据已重置');
    initAllPages();
}

// ============ 页面切换 ============
function showPage(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageName).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.nav-btn[data-page="${pageName}"]`);
    if (btn) btn.classList.add('active');

    // 页面切换时的初始化
    if (pageName === 'home') renderHomeStats();
    if (pageName === 'assess') renderAssessment();
    if (pageName === 'plan') renderPlan();
    if (pageName === 'words') { loadWordBank(); }
    if (pageName === 'quiz') { loadQuizQuestions(); }
    if (pageName === 'listening') { loadListeningOptions(); }
    if (pageName === 'progress') renderProgress();
}

// ============ 首页统计 ============
function renderHomeStats() {
    if (!currentUserId) {
        document.getElementById('homeStats').innerHTML = `
            <div class="stat-card"><div class="stat-number">0</div><div class="stat-label">已学单词</div></div>
            <div class="stat-card accent"><div class="stat-number">0</div><div class="stat-label">做题数量</div></div>
            <div class="stat-card success"><div class="stat-number">0</div><div class="stat-label">连续学习天数</div></div>
        `;
        return;
    }
    const wordProgress = loadData('wordProgress', {});
    const knownCount = Object.values(wordProgress).filter(v => v === 'known').length;
    const quizRecord = loadData('quizRecord', []);
    const studyDays = loadData('studyDays', []);
    const today = new Date().toDateString();
    const todayStudied = studyDays.includes(today);

    document.getElementById('homeStats').innerHTML = `
        <div class="stat-card"><div class="stat-number">${knownCount}</div><div class="stat-label">已掌握单词</div></div>
        <div class="stat-card accent"><div class="stat-number">${quizRecord.length}</div><div class="stat-label">已做题目</div></div>
        <div class="stat-card success"><div class="stat-number">${studyDays.length}</div><div class="stat-label">学习天数</div></div>
    `;

    if (!todayStudied) {
        studyDays.push(today);
        saveData('studyDays', studyDays);
    }
}

// ============ 水平评估 ============
function renderAssessment() {
    const container = document.getElementById('assessmentContainer');
    assessmentAnswers = new Array(assessmentQuestions.length).fill(-1);
    container.innerHTML = assessmentQuestions.map((q, i) => `
        <div class="quiz-question">
            <div class="quiz-question-text">${i + 1}. ${q.question}</div>
            <div class="quiz-options">
                ${q.options.map((opt, j) => `
                    <label class="quiz-option" data-question="${i}" data-option="${j}" onclick="selectAssessmentOption(${i}, ${j}, this)">
                        <input type="radio" name="q${i}" value="${j}">
                        <span>${opt.text}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function selectAssessmentOption(qIndex, oIndex, element) {
    assessmentAnswers[qIndex] = oIndex;
    // 更新该题的选中状态
    document.querySelectorAll(`[data-question="${qIndex}"]`).forEach(el => {
        el.classList.remove('selected');
    });
    element.classList.add('selected');
    element.querySelector('input').checked = true;
}

function submitAssessment() {
    const unanswered = assessmentAnswers.filter(a => a === -1).length;
    if (unanswered > 0) {
        showToast(`还有 ${unanswered} 道题未作答，请完成后再提交`);
        return;
    }
    let totalScore = 0;
    assessmentAnswers.forEach((a, i) => {
        totalScore += assessmentQuestions[i].options[a].score;
    });
    // 满分32分
    saveData('assessmentScore', totalScore);
    saveData('assessmentDate', new Date().toISOString());
    showToast('评估完成！正在生成学习计划...');
    setTimeout(() => showPage('plan'), 1000);
}

function getAssessmentLevel(score) {
    if (score <= 10) return { level: '基础薄弱', color: 'danger', desc: '你的英语基础相对薄弱，需要从词汇和基础语法开始系统学习。' };
    if (score <= 18) return { level: '基础一般', color: 'accent', desc: '你有一定英语基础，但各方面都有提升空间，需要全面强化训练。' };
    if (score <= 24) return { level: '基础较好', color: 'primary', desc: '你的英语基础不错，重点是查漏补缺，提高做题速度和准确率。' };
    return { level: '基础优秀', color: 'success', desc: '你的英语基础很好，可以冲刺高分，重点突破难题和写作翻译。' };
}

// ============ 学习计划生成 ============
function renderPlan() {
    const score = loadData('assessmentScore', null);
    const container = document.getElementById('planContent');

    if (score === null) {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:60px 20px;">
                <div style="font-size:60px;margin-bottom:16px;">📋</div>
                <h2 style="margin-bottom:12px;">还没有你的学习计划</h2>
                <p style="color:var(--text-light);margin-bottom:20px;">请先完成「水平评估」，系统会为你生成个性化学习计划</p>
                <button class="btn btn-primary btn-lg" onclick="showPage('assess')">去做评估</button>
            </div>
        `;
        return;
    }

    const level = getAssessmentLevel(score);
    const dailyHours = getDailyHoursFromScore(score);

    container.innerHTML = `
        <div class="card" style="border-left:4px solid var(--${level.color});">
            <h2 style="margin-bottom:8px;">🎯 你的英语水平：<span style="color:var(--${level.color});">${level.level}</span></h2>
            <p style="color:var(--text-light);">${level.desc}</p>
            <p>评估得分：${score} / 32 分</p>
            <p>建议每日学习时间：${dailyHours} 小时</p>
            <button class="btn btn-outline" onclick="showPage('assess')" style="margin-top:10px;">重新评估</button>
        </div>
        ${generatePlanHTML(score)}
    `;
}

function getDailyHoursFromScore(score) {
    if (score <= 10) return 2;
    if (score <= 18) return 1.5;
    if (score <= 24) return 1;
    return 0.5;
}

function generatePlanHTML(score) {
    const weak = getWeakArea(score);
    const plan = loadData('planProgress', {});

    // 基础阶段
    const phase1 = [
        `每天背 ${score <= 18 ? 40 : 30} 个高频词，第二天复习前一天的`,
        `每天精读1篇阅读文章，查出生词，分析长难句`,
        `每天听力训练30分钟，听3遍：做题→看原文跟读→盲听`,
        `每3天写1篇作文，掐时间30分钟，对照范文修改`,
        `每天复习当天学过的所有内容`
    ];

    // 强化阶段
    const phase2 = [
        `每天听力1小时，重点练速记关键词和数字`,
        `每2天做1套真题阅读，严格计时，分析错题`,
        `每天翻译1段真题翻译，积累地道表达`,
        `每3天写1篇作文+1段翻译`,
        `每周整理1次错题本，重点突破薄弱题型`
    ];

    // 冲刺阶段
    const phase3 = [
        `每3天完整做1套真题，严格按考试时间`,
        `分析错题，找出反复出错的题型，针对性补练`,
        `每天复习错题和生词`,
        `背诵5篇高分作文范文`,
        `考前最后3天，不再做新题，只看错题和范文`
    ];

    return `
        <div class="plan-phase">
            <h3>📘 阶段一：基础夯实（第1-20天）</h3>
            ${phase1.map((t, i) => renderPlanTask('p1', i, t, plan)).join('')}
        </div>
        <div class="plan-phase phase-2">
            <h3>📙 阶段二：题型强化（第21-45天）</h3>
            ${phase2.map((t, i) => renderPlanTask('p2', i, t, plan)).join('')}
        </div>
        <div class="plan-phase phase-3">
            <h3>📗 阶段三：模拟冲刺（第46-60天）</h3>
            ${phase3.map((t, i) => renderPlanTask('p3', i, t, plan)).join('')}
        </div>
        <div class="card" style="background:#fffbeb;">
            <p style="margin:0;"><strong>💡 温馨提示：</strong>这个计划是根据你的评估结果生成的。建议先试一周，然后根据实际完成情况来调整强度。如果某天只能学1小时，优先保证听力和背单词。</p>
        </div>
    `;
}

function renderPlanTask(phase, index, text, plan) {
    const key = `${phase}_${index}`;
    const done = plan[key];
    return `
        <div class="plan-task ${done ? 'done' : ''}">
            <input type="checkbox" ${done ? 'checked' : ''} onchange="togglePlanTask('${key}', this.checked)">
            <span>${text}</span>
        </div>
    `;
}

function togglePlanTask(key, checked) {
    const plan = loadData('planProgress', {});
    plan[key] = checked;
    saveData('planProgress', plan);
}

function getWeakArea(score) {
    // 根据分数判断薄弱项，简化处理
    if (score <= 12) return '词汇和基础语法';
    if (score <= 18) return '听力和阅读';
    if (score <= 24) return '写作和翻译';
    return '冲刺高分题型';
}

// ============ 背单词 ============
function loadWordBank() {
    const bank = document.getElementById('wordBankSelect').value;
    currentWordList = bank === 'cet4' ? cet4Words : cet6Words;
    currentWordIndex = 0;
    document.getElementById('wordProgress').textContent = '';
    showWord();
}

function showWord() {
    if (currentWordList.length === 0) return;
    const word = currentWordList[currentWordIndex];
    const viewMode = document.getElementById('wordViewMode').value;

    document.getElementById('wordEn').textContent = word.en;
    document.getElementById('wordPhonetic').textContent = word.phonetic;
    document.getElementById('wordCn').textContent = word.cn;
    document.getElementById('wordExample').textContent = '例句：' + word.example;

    if (viewMode === 'word') {
        document.getElementById('wordCn').style.display = 'none';
        document.getElementById('wordExample').style.display = 'none';
    } else if (viewMode === 'both') {
        document.getElementById('wordCn').style.display = 'block';
        document.getElementById('wordExample').style.display = 'block';
    } else {
        document.getElementById('wordEn').textContent = word.cn;
        document.getElementById('wordCn').style.display = 'none';
        document.getElementById('wordExample').style.display = 'none';
    }

    document.getElementById('wordProgress').textContent = `进度：${currentWordIndex + 1} / ${currentWordList.length}`;
}

function toggleWordMeaning() {
    const cn = document.getElementById('wordCn');
    const example = document.getElementById('wordExample');
    if (cn.style.display === 'none') {
        cn.style.display = 'block';
        example.style.display = 'block';
    } else {
        cn.style.display = 'none';
        example.style.display = 'none';
    }
}

function updateWordDisplay() {
    showWord();
}

function nextWord() {
    if (currentWordIndex < currentWordList.length - 1) {
        currentWordIndex++;
        showWord();
    } else {
        showToast('已经是最后一个单词了');
    }
}

function prevWord() {
    if (currentWordIndex > 0) {
        currentWordIndex--;
        showWord();
    } else {
        showToast('已经是第一个单词了');
    }
}

function markWord(status) {
    if (!currentUserId) {
        showToast('请先选择用户');
        return;
    }
    const word = currentWordList[currentWordIndex];
    const progress = loadData('wordProgress', {});
    progress[word.en] = status;
    saveData('wordProgress', progress);
    nextWord();
}

function markKnown() { markWord('known'); }
function markUnknown() { markWord('unknown'); }

// ============ 真题刷题 ============
function loadQuizQuestions() {
    const exam = document.getElementById('quizExamSelect').value;
    currentQuizList = exam === 'cet4' ? cet4Questions : cet6Questions;
    currentQuizIndex = 0;
    selectedQuizOption = -1;
    quizAnswered = false;
    showQuiz();
}

function showQuiz() {
    if (currentQuizList.length === 0) return;
    const q = currentQuizList[currentQuizIndex];
    const container = document.getElementById('quizContainer');
    document.getElementById('quizProgress').textContent = `第 ${currentQuizIndex + 1} / ${currentQuizList.length} 题`;

    let html = '<div class="question-card">';
    if (q.passage) {
        html += `<div style="background:var(--bg);padding:16px;border-radius:8px;margin-bottom:16px;line-height:1.8;">${q.passage}</div>`;
    }
    html += `<div class="question-text">${q.question}</div>`;

    if (q.type === 'reading' && q.options.length > 0) {
        html += '<div class="options-list">';
        q.options.forEach((opt, i) => {
            let cls = 'option-item';
            if (quizAnswered) {
                if (i === q.answer) cls += ' correct';
                else if (i === selectedQuizOption) cls += ' wrong';
                cls += ' disabled';
            }
            html += `<div class="${cls}" onclick="selectQuizOption(${i})">${String.fromCharCode(65 + i)}. ${opt}</div>`;
        });
        html += '</div>';
    } else {
        // 翻译和写作题
        html += `<textarea id="quizAnswerInput" style="width:100%;min-height:120px;padding:12px;border:2px solid var(--border);border-radius:8px;font-family:inherit;font-size:14px;" placeholder="请在此输入你的答案..."></textarea>`;
    }

    if (quizAnswered) {
        html += `<div style="margin-top:16px;padding:16px;background:#ecfdf5;border-radius:8px;">
            <strong style="color:#047857;">📌 参考答案：</strong>
            <p style="margin-top:8px;white-space:pre-wrap;">${q.answer}</p>
        </div>`;
        html += `<div style="margin-top:12px;padding:16px;background:#f0f9ff;border-radius:8px;">
            <strong style="color:#0369a1;">💡 解析：</strong>
            <p style="margin-top:8px;">${q.analysis}</p>
        </div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

function selectQuizOption(index) {
    if (quizAnswered) return;
    selectedQuizOption = index;
    document.querySelectorAll('.option-item').forEach((el, i) => {
        el.style.borderColor = i === index ? 'var(--primary)' : 'var(--border)';
        el.style.background = i === index ? '#eef2ff' : 'white';
    });
}

function submitQuizAnswer() {
    const q = currentQuizList[currentQuizIndex];
    if (q.type === 'reading') {
        if (selectedQuizOption === -1) {
            showToast('请选择一个答案');
            return;
        }
        const correct = selectedQuizOption === q.answer;
        saveQuizResult(correct);
    } else {
        // 翻译和写作：手动记录
        const input = document.getElementById('quizAnswerInput');
        if (input && !input.value.trim()) {
            showToast('请输入你的答案');
            return;
        }
        saveQuizResult(null);
    }
    quizAnswered = true;
    showQuiz();
}

function saveQuizResult(correct) {
    if (!currentUserId) return;
    const record = loadData('quizRecord', []);
    record.push({
        type: currentQuizList[currentQuizIndex].type,
        correct: correct,
        date: new Date().toISOString()
    });
    saveData('quizRecord', record);
}

function nextQuiz() {
    if (currentQuizIndex < currentQuizList.length - 1) {
        currentQuizIndex++;
        selectedQuizOption = -1;
        quizAnswered = false;
        showQuiz();
    } else {
        showToast('已经是最后一题了');
    }
}

function prevQuiz() {
    if (currentQuizIndex > 0) {
        currentQuizIndex--;
        selectedQuizOption = -1;
        quizAnswered = false;
        showQuiz();
    } else {
        showToast('已经是第一题了');
    }
}

// ============ 听力练习 ============
function loadListeningOptions() {
    const select = document.getElementById('listeningSelect');
    select.innerHTML = listeningMaterials.map((m, i) =>
        `<option value="${i}">${m.title}</option>`
    ).join('');
    loadListening();
}

function loadListening() {
    const index = parseInt(document.getElementById('listeningSelect').value);
    const material = listeningMaterials[index];
    const container = document.getElementById('listeningContainer');

    container.innerHTML = `
        <div style="margin-bottom:16px;">
            <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin-bottom:12px;">
                <strong>🎧 听力原文：</strong>
                <p id="listeningScript" style="margin-top:8px;line-height:1.8;display:none;">${material.script}</p>
                <button class="btn btn-outline" onclick="document.getElementById('listeningScript').style.display='block';this.style.display='none';">显示原文</button>
            </div>
        </div>
        <div id="listeningQuestions">
            ${material.questions.map((q, i) => `
                <div class="question-card">
                    <div class="question-text">问题 ${i + 1}：${q.question}</div>
                    <div class="options-list">
                        ${q.options.map((opt, j) => `
                            <div class="option-item" onclick="selectListeningOption(${i}, ${j}, this, ${q.answer})">${String.fromCharCode(65 + j)}. ${opt}</div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
        <div style="margin-top:16px;padding:16px;background:#fffbeb;border-radius:8px;">
            <strong>📝 听力技巧：</strong>
            <ul style="margin-top:8px;padding-left:20px;color:var(--text-light);">
                <li>第一遍：先看题目，预测内容，带着问题听</li>
                <li>第二遍：边听边记关键词（数字、人名、地点）</li>
                <li>第三遍：对照原文，找出没听懂的地方反复听</li>
            </ul>
        </div>
    `;
}

function selectListeningOption(qIndex, oIndex, element, correctAnswer) {
    const siblings = element.parentElement.children;
    Array.from(siblings).forEach((el, i) => {
        el.classList.remove('correct', 'wrong');
        if (i === correctAnswer) el.classList.add('correct');
        if (i === oIndex && oIndex !== correctAnswer) el.classList.add('wrong');
        el.style.pointerEvents = 'none';
    });
}

// ============ 小游戏 ============
function startGame(type) {
    const container = document.getElementById('gameContainer');
    if (type === 'spelling') startSpellingGame(container);
    else if (type === 'matching') startMatchingGame(container);
    else if (type === 'choice') startChoiceGame(container);
}

// 单词拼写游戏
let spellingScore = 0;
let spellingTotal = 0;
function startSpellingGame(container) {
    spellingScore = 0;
    spellingTotal = 0;
    container.innerHTML = `
        <div class="game-area">
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
                <span class="tag tag-primary">得分：<span id="spellingScore">0</span></span>
                <span class="tag tag-accent">已答：<span id="spellingTotal">0</span></span>
            </div>
            <p style="text-align:center;color:var(--text-light);margin-bottom:8px;">请根据中文意思拼写出英文单词</p>
            <div class="game-word" id="spellingCn">苹果</div>
            <input type="text" id="spellingInput" class="game-input" placeholder="输入英文单词，回车提交" onkeypress="if(event.key==='Enter')checkSpelling()">
            <div id="spellingResult"></div>
            <div style="text-align:center;margin-top:16px;">
                <button class="btn btn-primary" onclick="checkSpelling()">提交</button>
                <button class="btn btn-outline" onclick="nextSpellingWord()">下一个</button>
            </div>
        </div>
    `;
    nextSpellingWord();
}

let currentSpellingWord = null;
function nextSpellingWord() {
    currentSpellingWord = gameWords[Math.floor(Math.random() * gameWords.length)];
    document.getElementById('spellingCn').textContent = currentSpellingWord.cn;
    document.getElementById('spellingInput').value = '';
    document.getElementById('spellingInput').focus();
    document.getElementById('spellingResult').innerHTML = '';
}

function checkSpelling() {
    const input = document.getElementById('spellingInput').value.trim().toLowerCase();
    if (!input) {
        showToast('请输入单词');
        return;
    }
    spellingTotal++;
    document.getElementById('spellingTotal').textContent = spellingTotal;
    const result = document.getElementById('spellingResult');
    if (input === currentSpellingWord.en.toLowerCase()) {
        spellingScore++;
        result.innerHTML = `<div class="game-result correct">✅ 正确！太棒了！</div>`;
    } else {
        result.innerHTML = `<div class="game-result wrong">❌ 正确答案是：${currentSpellingWord.en}</div>`;
    }
    document.getElementById('spellingScore').textContent = spellingScore;
}

// 单词消消乐
function startMatchingGame(container) {
    // 随机选6对单词
    const selected = [...gameWords].sort(() => Math.random() - 0.5).slice(0, 6);
    const cards = [];
    selected.forEach(w => {
        cards.push({ type: 'en', text: w.en, pair: w.en });
        cards.push({ type: 'cn', text: w.cn, pair: w.en });
    });
    cards.sort(() => Math.random() - 0.5);

    let html = `
        <div class="game-area">
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
                <span class="tag tag-primary">翻牌：<span id="matchMoves">0</span></span>
                <span class="tag tag-success">已匹配：<span id="matchFound">0</span>/6</span>
            </div>
            <p style="text-align:center;color:var(--text-light);margin-bottom:12px;">翻开卡片，匹配英文单词和中文释义</p>
            <div class="match-grid" id="matchGrid">
    `;
    cards.forEach((c, i) => {
        html += `<div class="match-cell" data-index="${i}" data-pair="${c.pair}" onclick="flipMatchCard(this)">?</div>`;
    });
    html += `</div>
            <div style="text-align:center;margin-top:16px;">
                <button class="btn btn-outline" onclick="startGame('matching')">重新开始</button>
            </div>
        </div>
    `;
    container.innerHTML = html;

    // 保存卡片数据
    window.matchCards = cards;
    window.matchFlipped = [];
    window.matchMoves = 0;
    window.matchFound = 0;
    window.matchLocked = false;
}

function flipMatchCard(element) {
    if (window.matchLocked) return;
    if (element.classList.contains('matched') || element.classList.contains('flipped')) return;

    const index = parseInt(element.dataset.index);
    const card = window.matchCards[index];
    element.textContent = card.text;
    element.classList.add('flipped');
    window.matchFlipped.push({ element, pair: card.pair });

    if (window.matchFlipped.length === 2) {
        window.matchMoves++;
        document.getElementById('matchMoves').textContent = window.matchMoves;

        if (window.matchFlipped[0].pair === window.matchFlipped[1].pair) {
            // 匹配成功
            window.matchFlipped.forEach(f => f.element.classList.add('matched'));
            window.matchFlipped = [];
            window.matchFound++;
            document.getElementById('matchFound').textContent = window.matchFound;
            if (window.matchFound === 6) {
                setTimeout(() => showToast(`🎉 恭喜完成！用了${window.matchMoves}步`), 300);
            }
        } else {
            // 匹配失败
            window.matchLocked = true;
            setTimeout(() => {
                window.matchFlipped.forEach(f => {
                    f.element.textContent = '?';
                    f.element.classList.remove('flipped');
                });
                window.matchFlipped = [];
                window.matchLocked = false;
            }, 800);
        }
    }
}

// 词义选择游戏
let choiceScore = 0;
let choiceTotal = 0;
function startChoiceGame(container) {
    choiceScore = 0;
    choiceTotal = 0;
    container.innerHTML = `
        <div class="game-area">
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
                <span class="tag tag-primary">得分：<span id="choiceScore">0</span></span>
                <span class="tag tag-accent">已答：<span id="choiceTotal">0</span></span>
            </div>
            <p style="text-align:center;color:var(--text-light);margin-bottom:8px;">选择正确的中文释义</p>
            <div class="game-word" id="choiceEn">apple</div>
            <div id="choiceOptions" class="grid grid-2"></div>
            <div id="choiceResult"></div>
        </div>
    `;
    nextChoiceQuestion();
}

function nextChoiceQuestion() {
    const correct = gameWords[Math.floor(Math.random() * gameWords.length)];
    const options = [correct];
    while (options.length < 4) {
        const w = gameWords[Math.floor(Math.random() * gameWords.length)];
        if (!options.includes(w)) options.push(w);
    }
    options.sort(() => Math.random() - 0.5);

    document.getElementById('choiceEn').textContent = correct.en;
    document.getElementById('choiceResult').innerHTML = '';

    const optionsContainer = document.getElementById('choiceOptions');
    optionsContainer.innerHTML = options.map((w, i) =>
        `<button class="btn btn-outline btn-block" style="padding:16px;font-size:16px;" onclick="checkChoice('${w.cn}','${correct.cn}',this)">${w.cn}</button>`
    ).join('');
}

function checkChoice(selected, correct, element) {
    choiceTotal++;
    document.getElementById('choiceTotal').textContent = choiceTotal;
    const result = document.getElementById('choiceResult');
    const buttons = element.parentElement.querySelectorAll('button');
    buttons.forEach(b => b.disabled = true);

    if (selected === correct) {
        choiceScore++;
        element.style.background = 'var(--success)';
        element.style.color = 'white';
        result.innerHTML = `<div class="game-result correct">✅ 正确！</div>`;
    } else {
        element.style.background = 'var(--danger)';
        element.style.color = 'white';
        buttons.forEach(b => {
            if (b.textContent === correct) {
                b.style.background = 'var(--success)';
                b.style.color = 'white';
            }
        });
        result.innerHTML = `<div class="game-result wrong">❌ 正确答案是：${correct}</div>`;
    }
    document.getElementById('choiceScore').textContent = choiceScore;
    setTimeout(nextChoiceQuestion, 1500);
}

// ============ 学习进度 ============
function renderProgress() {
    const container = document.getElementById('progressContent');
    if (!currentUserId) {
        container.innerHTML = '<p style="color:var(--text-light);">请先选择用户</p>';
        return;
    }

    const wordProgress = loadData('wordProgress', {});
    const knownCount = Object.values(wordProgress).filter(v => v === 'known').length;
    const unknownCount = Object.values(wordProgress).filter(v => v === 'unknown').length;
    const quizRecord = loadData('quizRecord', []);
    const correctCount = quizRecord.filter(r => r.correct === true).length;
    const studyDays = loadData('studyDays', []);
    const assessmentScore = loadData('assessmentScore', null);

    const totalWords = cet4Words.length + cet6Words.length;
    const wordPercent = Math.round((knownCount / totalWords) * 100);

    container.innerHTML = `
        <div class="grid grid-4" style="margin-bottom:20px;">
            <div class="stat-card"><div class="stat-number">${knownCount}</div><div class="stat-label">已掌握单词</div></div>
            <div class="stat-card accent"><div class="stat-number">${quizRecord.length}</div><div class="stat-label">做题总数</div></div>
            <div class="stat-card success"><div class="stat-number">${correctCount}</div><div class="stat-label">做对题数</div></div>
            <div class="stat-card" style="background:linear-gradient(135deg,#8b5cf6,#6366f1);"><div class="stat-number">${studyDays.length}</div><div class="stat-label">学习天数</div></div>
        </div>

        ${assessmentScore !== null ? `
        <div class="card" style="background:#f0f9ff;">
            <h3 style="margin-bottom:12px;">📝 水平评估结果</h3>
            <p>得分：${assessmentScore} / 32 分</p>
            <p>等级：<span class="tag tag-primary">${getAssessmentLevel(assessmentScore).level}</span></p>
        </div>
        ` : ''}

        <div class="card">
            <h3 style="margin-bottom:12px;">📖 单词学习进度</h3>
            <p>已掌握 ${knownCount} / ${totalWords} 个单词（${wordPercent}%）</p>
            <div class="progress-bar"><div class="progress-fill" style="width:${wordPercent}%;"></div></div>
            <p style="margin-top:8px;color:var(--text-light);font-size:13px;">标记为不认识：${unknownCount} 个</p>
        </div>

        <div class="card">
            <h3 style="margin-bottom:12px;">✍️ 刷题记录</h3>
            ${quizRecord.length === 0 ? '<p style="color:var(--text-light);">还没有做题记录</p>' : `
                <p>做题总数：${quizRecord.length}</p>
                <p>正确题数：${correctCount}</p>
                <p>正确率：${quizRecord.length > 0 ? Math.round((correctCount / quizRecord.length) * 100) : 0}%</p>
            `}
        </div>
    `;
}

// ============ 数据导入导出 ============
function exportData() {
    if (!currentUserId) {
        showToast('请先选择用户');
        return;
    }
    const data = {};
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`cet_${currentUserId}_`)) {
            data[key] = localStorage.getItem(key);
        }
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `英语学习数据_${new Date().toLocaleDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导出');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            Object.keys(data).forEach(key => {
                localStorage.setItem(key, data[key]);
            });
            showToast('数据导入成功！');
            initAllPages();
        } catch (err) {
            showToast('导入失败：文件格式错误');
        }
    };
    reader.readAsText(file);
}

// ============ 初始化 ============
function initAllPages() {
    refreshUserSelect();
    renderHomeStats();
    renderPlan();
    renderProgress();
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', function() {
    // 恢复上次的用户
    const lastUserId = localStorage.getItem('cet_current_user');
    if (lastUserId) {
        const users = getUsers();
        if (users.find(u => u.id === lastUserId)) {
            currentUserId = lastUserId;
        }
    }
    refreshUserSelect();

    // 如果没有用户，提示创建
    const users = getUsers();
    if (users.length === 0) {
        setTimeout(() => {
            showToast('请先点击右上角"+ 用户"创建账号');
        }, 500);
    }

    initAllPages();
});
