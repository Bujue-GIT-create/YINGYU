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
// 导航栏左右滚动
function scrollNav(dir) {
    const nav = document.getElementById('navInner');
    if (!nav) return;
    nav.scrollBy({ left: dir * 200, behavior: 'smooth' });
}

function showPage(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageName).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.nav-btn[data-page="${pageName}"]`);
    if (btn) btn.classList.add('active');
    // 让当前激活的导航按钮滚动到可见区域
    if (btn) {
        const nav = document.getElementById('navInner');
        if (nav) {
            const btnLeft = btn.offsetLeft;
            const btnRight = btnLeft + btn.offsetWidth;
            const navLeft = nav.scrollLeft;
            const navRight = navLeft + nav.clientWidth;
            if (btnLeft < navLeft) nav.scrollTo({ left: btnLeft - 10, behavior: 'smooth' });
            else if (btnRight > navRight) nav.scrollTo({ left: btnRight - nav.clientWidth + 10, behavior: 'smooth' });
        }
    }

    // 页面切换时的初始化
    if (pageName === 'home') renderHomeStats();
    if (pageName === 'assess') renderAssessment();
    if (pageName === 'plan') renderPlan();
    if (pageName === 'words') { loadWordBank(); }
    if (pageName === 'quiz') { loadQuizQuestions(); }
    if (pageName === 'listening') { loadListeningOptions(); }
    if (pageName === 'exam') { resetExam(); }
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
    if (bank === 'cet4') currentWordList = cet4Words;
    else if (bank === 'cet4syl') currentWordList = cet4SyllabusWords;
    else if (bank === 'cet6') currentWordList = cet6Words;
    else if (bank === 'cet6syl') currentWordList = cet6SyllabusWords;
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
    if (exam === 'cet4') currentQuizList = cet4Questions;
    else if (exam === 'cet6') currentQuizList = cet6Questions;
    else if (exam === 'common') currentQuizList = commonQuestions;
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

    if ((q.type === 'reading' || q.type === 'vocabulary') && q.options.length > 0) {
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

// ============ 模拟考试 ============
let examQuestions = [];
let examAnswers = [];
let examTimerInterval = null;
let examRemaining = 0;
let examInProgress = false;

function resetExam() {
    if (examTimerInterval) {
        clearInterval(examTimerInterval);
        examTimerInterval = null;
    }
    examInProgress = false;
    document.getElementById('examContainer').innerHTML = '';
    document.getElementById('examResult').innerHTML = '';
    document.getElementById('examConfig').style.display = 'flex';
    document.getElementById('examTimer').style.display = 'none';
    document.getElementById('startExamBtn').style.display = '';
    document.getElementById('submitExamBtn').style.display = 'none';
    document.getElementById('examTime').textContent = '45:00';
}

function startExam() {
    const level = document.getElementById('examLevel').value;
    const bank = level === 'cet4' ? cet4Questions : cet6Questions;

    // 抽取阅读和词汇语法题（选择类）用于自动评分
    const choiceQuestions = bank.filter(q => (q.type === 'reading' || q.type === 'vocabulary') && q.options.length > 0);

    if (choiceQuestions.length < 5) {
        showToast('题目不足，无法开始考试');
        return;
    }

    // 随机抽取15道题
    examQuestions = [...choiceQuestions].sort(() => Math.random() - 0.5).slice(0, Math.min(15, choiceQuestions.length));
    examAnswers = new Array(examQuestions.length).fill(-1);
    examRemaining = 45 * 60; // 45分钟
    examInProgress = true;

    document.getElementById('examConfig').style.display = 'flex';
    document.getElementById('examTimer').style.display = '';
    document.getElementById('startExamBtn').style.display = 'none';
    document.getElementById('submitExamBtn').style.display = '';

    renderExamQuestions();

    if (examTimerInterval) clearInterval(examTimerInterval);
    examTimerInterval = setInterval(() => {
        examRemaining--;
        const m = String(Math.floor(examRemaining / 60)).padStart(2, '0');
        const s = String(examRemaining % 60).padStart(2, '0');
        document.getElementById('examTime').textContent = `${m}:${s}`;
        if (examRemaining <= 0) {
            clearInterval(examTimerInterval);
            examTimerInterval = null;
            showToast('时间到！自动交卷');
            submitExam();
        }
    }, 1000);
}

function renderExamQuestions() {
    const container = document.getElementById('examContainer');
    container.innerHTML = examQuestions.map((q, i) => {
        let html = `<div class="question-card" style="margin-bottom:20px;padding:16px;background:var(--bg);border-radius:10px;">`;
        html += `<div style="font-weight:bold;margin-bottom:8px;">${i + 1}. ${q.question}</div>`;
        if (q.passage) {
            html += `<div style="background:white;padding:12px;border-radius:8px;margin-bottom:12px;line-height:1.8;font-size:14px;color:var(--text-light);">${q.passage}</div>`;
        }
        html += '<div style="display:flex;flex-direction:column;gap:8px;">';
        q.options.forEach((opt, j) => {
            const checked = examAnswers[i] === j ? 'checked' : '';
            html += `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px;border-radius:6px;transition:background 0.2s;" onmouseover="this.style.background='var(--primary-light)'" onmouseout="this.style.background=''">
                <input type="radio" name="examQ${i}" value="${j}" ${checked} onchange="selectExamAnswer(${i}, ${j})" style="width:18px;height:18px;">
                <span>${String.fromCharCode(65 + j)}. ${opt}</span>
            </label>`;
        });
        html += '</div></div>';
        return html;
    }).join('');
}

function selectExamAnswer(qIndex, optIndex) {
    if (!examInProgress) return;
    examAnswers[qIndex] = optIndex;
}

function submitExam() {
    if (!examInProgress) return;
    examInProgress = false;
    if (examTimerInterval) {
        clearInterval(examTimerInterval);
        examTimerInterval = null;
    }

    // 计算得分
    let correct = 0;
    let unanswered = 0;
    examQuestions.forEach((q, i) => {
        if (examAnswers[i] === -1) {
            unanswered++;
        } else if (examAnswers[i] === q.answer) {
            correct++;
        }
    });

    const total = examQuestions.length;
    const score = Math.round((correct / total) * 710);
    const passed = score >= 425;

    // 显示结果
    const resultDiv = document.getElementById('examResult');
    let html = `<div style="background:var(--bg);padding:24px;border-radius:12px;text-align:center;">`;
    html += `<div style="font-size:20px;margin-bottom:12px;">📊 考试结果</div>`;
    html += `<div style="font-size:48px;font-weight:bold;color:${passed ? 'var(--success)' : 'var(--danger)'};margin:12px 0;">${score}</div>`;
    html += `<div style="font-size:18px;color:${passed ? 'var(--success)' : 'var(--danger)'};margin-bottom:12px;">${passed ? '🎉 恭喜通过！继续保持！' : '😢 未通过，再接再厉！'}</div>`;
    html += `<div style="color:var(--text-light);line-height:2;">`;
    html += `总题数：${total} 题<br>`;
    html += `答对：<span style="color:var(--success);font-weight:bold;">${correct}</span> 题<br>`;
    html += `答错：<span style="color:var(--danger);font-weight:bold;">${total - correct - unanswered}</span> 题<br>`;
    html += `未答：${unanswered} 题<br>`;
    html += `正确率：${Math.round((correct / total) * 100)}%</div>`;
    html += `</div>`;

    // 显示解析
    html += `<h3 style="margin-top:24px;margin-bottom:12px;color:var(--primary);">📝 答案与解析</h3>`;
    html += examQuestions.map((q, i) => {
        const userAns = examAnswers[i];
        const isCorrect = userAns === q.answer;
        const userText = userAns === -1 ? '未作答' : `${String.fromCharCode(65 + userAns)}. ${q.options[userAns]}`;
        const correctText = `${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}`;
        let item = `<div style="background:var(--bg);padding:16px;border-radius:10px;margin-bottom:12px;border-left:4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'};">`;
        item += `<div style="font-weight:bold;margin-bottom:8px;">${i + 1}. ${q.question} ${isCorrect ? '✅' : '❌'}</div>`;
        if (!isCorrect) {
            item += `<div style="color:var(--danger);margin-bottom:4px;">你的答案：${userText}</div>`;
            item += `<div style="color:var(--success);margin-bottom:4px;">正确答案：${correctText}</div>`;
        } else {
            item += `<div style="color:var(--success);margin-bottom:4px;">正确答案：${correctText}</div>`;
        }
        item += `<div style="color:var(--text-light);font-size:14px;">💡 ${q.analysis}</div>`;
        item += `</div>`;
        return item;
    }).join('');

    resultDiv.innerHTML = html;

    // 保存考试记录
    if (currentUserId) {
        const records = loadData('examRecords', []);
        records.push({
            date: new Date().toLocaleString('zh-CN'),
            level: document.getElementById('examLevel').value,
            score: score,
            correct: correct,
            total: total
        });
        saveData('examRecords', records);
    }

    document.getElementById('examConfig').style.display = 'none';
    showToast('考试已提交！');
}

// ============ 小游戏 ============
function startGame(type) {
    const container = document.getElementById('gameContainer');
    if (type === 'spelling') startSpellingGame(container);
    else if (type === 'matching') startMatchingGame(container);
    else if (type === 'choice') startChoiceGame(container);
    else if (type === 'decrypt') startDecryptGame(container);
    else if (type === 'sentence') startSentenceGame(container);
    else if (type === 'riddle') startRiddleGame(container);
    else if (type === 'match3') startMatch3Game(container);
    else if (type === 'grass') startGrassGame(container);
    else if (type === 'racing') startRacingGame(container);
    else if (type === 'cat') startCatGame(container);
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

// ============ 新游戏1：单词解密 ============
let decryptScore = 0;
let decryptTotal = 0;
let currentDecryptWord = null;

const decryptWordBank = [
    {en: "apple", cn: "苹果"}, {en: "book", cn: "书"}, {en: "water", cn: "水"},
    {en: "happy", cn: "快乐的"}, {en: "friend", cn: "朋友"}, {en: "school", cn: "学校"},
    {en: "music", cn: "音乐"}, {en: "family", cn: "家庭"}, {en: "teacher", cn: "老师"},
    {en: "student", cn: "学生"}, {en: "morning", cn: "早晨"}, {en: "evening", cn: "晚上"},
    {en: "summer", cn: "夏天"}, {en: "winter", cn: "冬天"}, {en: "flower", cn: "花"},
    {en: "animal", cn: "动物"}, {en: "doctor", cn: "医生"}, {en: "hospital", cn: "医院"},
    {en: "library", cn: "图书馆"}, {en: "computer", cn: "电脑"}, {en: "internet", cn: "互联网"},
    {en: "language", cn: "语言"}, {en: "weather", cn: "天气"}, {en: "journey", cn: "旅行"},
    {en: "mountain", cn: "山"}, {en: "river", cn: "河流"}, {en: "ocean", cn: "海洋"},
    {en: "forest", cn: "森林"}, {en: "bridge", cn: "桥"}, {en: "market", cn: "市场"}
];

function shuffleWord(word) {
    let arr = word.split('');
    let shuffled = arr;
    while (shuffled.join('') === word && word.length > 1) {
        shuffled = [...arr].sort(() => Math.random() - 0.5);
    }
    return shuffled.join('');
}

function startDecryptGame(container) {
    decryptScore = 0;
    decryptTotal = 0;
    container.innerHTML = `
        <div class="game-area">
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
                <span class="tag tag-primary">得分：<span id="decryptScore">0</span></span>
                <span class="tag tag-accent">已答：<span id="decryptTotal">0</span></span>
            </div>
            <p style="text-align:center;color:var(--text-light);margin-bottom:8px;">🔓 把打乱的字母重新排列成正确的单词</p>
            <div class="game-word" id="decryptShuffled" style="letter-spacing:8px;">APPLE</div>
            <div style="text-align:center;color:var(--text-light);margin-bottom:12px;" id="decryptHint">提示：</div>
            <input type="text" id="decryptInput" class="game-input" placeholder="输入正确的单词，回车提交" onkeypress="if(event.key==='Enter')checkDecrypt()">
            <div id="decryptResult"></div>
            <div style="text-align:center;margin-top:16px;">
                <button class="btn btn-primary" onclick="checkDecrypt()">提交</button>
                <button class="btn btn-outline" onclick="skipDecrypt()">跳过</button>
            </div>
        </div>
    `;
    nextDecryptWord();
}

function nextDecryptWord() {
    currentDecryptWord = decryptWordBank[Math.floor(Math.random() * decryptWordBank.length)];
    const shuffled = shuffleWord(currentDecryptWord.en);
    document.getElementById('decryptShuffled').textContent = shuffled.toUpperCase();
    document.getElementById('decryptHint').textContent = '提示：' + currentDecryptWord.cn;
    document.getElementById('decryptInput').value = '';
    document.getElementById('decryptInput').focus();
    document.getElementById('decryptResult').innerHTML = '';
}

function checkDecrypt() {
    const input = document.getElementById('decryptInput').value.trim().toLowerCase();
    if (!input) {
        showToast('请输入单词');
        return;
    }
    decryptTotal++;
    document.getElementById('decryptTotal').textContent = decryptTotal;
    const result = document.getElementById('decryptResult');
    if (input === currentDecryptWord.en.toLowerCase()) {
        decryptScore++;
        result.innerHTML = `<div class="game-result correct">✅ 正确！答案是 ${currentDecryptWord.en}</div>`;
        setTimeout(nextDecryptWord, 1500);
    } else {
        result.innerHTML = `<div class="game-result wrong">❌ 再想想，正确答案是：${currentDecryptWord.en}</div>`;
        setTimeout(nextDecryptWord, 2500);
    }
    document.getElementById('decryptScore').textContent = decryptScore;
}

function skipDecrypt() {
    decryptTotal++;
    document.getElementById('decryptTotal').textContent = decryptTotal;
    document.getElementById('decryptResult').innerHTML = `<div class="game-result wrong">⏭️ 跳过，答案是：${currentDecryptWord.en}</div>`;
    setTimeout(nextDecryptWord, 1500);
}

// ============ 新游戏2：句子排序 ============
let sentenceScore = 0;
let sentenceTotal = 0;
let currentSentenceWords = [];
let selectedOrder = [];

const sentenceBank = [
    { words: ["I", "love", "learning", "English"], cn: "我爱学英语" },
    { words: ["She", "goes", "to", "school", "every", "day"], cn: "她每天去上学" },
    { words: ["We", "had", "a", "good", "time", "yesterday"], cn: "我们昨天玩得很开心" },
    { words: ["The", "weather", "is", "nice", "today"], cn: "今天天气很好" },
    { words: ["He", "is", "reading", "a", "book"], cn: "他正在读书" },
    { words: ["They", "are", "playing", "football", "now"], cn: "他们正在踢足球" },
    { words: ["My", "mother", "cooks", "delicious", "food"], cn: "我妈妈做的饭很好吃" },
    { words: ["The", "cat", "is", "sleeping", "on", "the", "sofa"], cn: "猫在沙发上睡觉" },
    { words: ["I", "want", "to", "travel", "around", "the", "world"], cn: "我想环游世界" },
    { words: ["English", "is", "an", "international", "language"], cn: "英语是一门国际语言" },
    { words: ["Please", "turn", "off", "the", "lights"], cn: "请关灯" },
    { words: ["We", "should", "protect", "the", "environment"], cn: "我们应该保护环境" }
];

function startSentenceGame(container) {
    sentenceScore = 0;
    sentenceTotal = 0;
    container.innerHTML = `
        <div class="game-area">
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
                <span class="tag tag-primary">得分：<span id="sentenceScore">0</span></span>
                <span class="tag tag-accent">已答：<span id="sentenceTotal">0</span></span>
            </div>
            <p style="text-align:center;color:var(--text-light);margin-bottom:8px;">🧩 按正确顺序点击单词，组成句子</p>
            <div style="text-align:center;color:var(--primary);font-weight:bold;margin-bottom:16px;" id="sentenceCn"></div>
            <div id="sentenceAnswer" style="min-height:60px;border:2px dashed var(--border);border-radius:8px;padding:12px;margin-bottom:16px;text-align:center;font-size:18px;"></div>
            <div id="sentenceOptions" class="grid grid-4" style="gap:10px;"></div>
            <div style="text-align:center;margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="checkSentence()">提交答案</button>
                <button class="btn btn-outline" onclick="resetSentence()">重置</button>
                <button class="btn btn-outline" onclick="nextSentence()">换一题</button>
            </div>
            <div id="sentenceResult" style="margin-top:16px;text-align:center;"></div>
        </div>
    `;
    nextSentence();
}

function nextSentence() {
    const sentence = sentenceBank[Math.floor(Math.random() * sentenceBank.length)];
    currentSentenceWords = [...sentence.words].sort(() => Math.random() - 0.5);
    window.correctSentence = sentence.words.join(' ');
    selectedOrder = [];
    document.getElementById('sentenceCn').textContent = '中文：' + sentence.cn;
    document.getElementById('sentenceAnswer').innerHTML = '<span style="color:var(--text-light);">点击下方单词组成句子...</span>';
    document.getElementById('sentenceResult').innerHTML = '';

    const optionsContainer = document.getElementById('sentenceOptions');
    optionsContainer.innerHTML = currentSentenceWords.map((w, i) =>
        `<button class="btn btn-outline" style="padding:12px;font-size:16px;" id="sentenceWord${i}" onclick="selectSentenceWord(${i}, '${w}')">${w}</button>`
    ).join('');
}

function selectSentenceWord(index, word) {
    const btn = document.getElementById('sentenceWord' + index);
    if (btn.disabled) return;
    btn.disabled = true;
    btn.style.opacity = '0.3';
    selectedOrder.push(word);
    document.getElementById('sentenceAnswer').innerHTML = selectedOrder.map(w => `<span style="display:inline-block;background:var(--primary);color:white;padding:4px 10px;margin:4px;border-radius:6px;">${w}</span>`).join('');
}

function checkSentence() {
    if (selectedOrder.length === 0) {
        showToast('请先选择单词');
        return;
    }
    sentenceTotal++;
    document.getElementById('sentenceTotal').textContent = sentenceTotal;
    const result = document.getElementById('sentenceResult');
    if (selectedOrder.join(' ') === window.correctSentence) {
        sentenceScore++;
        result.innerHTML = `<div class="game-result correct">✅ 正确！</div>`;
    } else {
        result.innerHTML = `<div class="game-result wrong">❌ 正确句子是：${window.correctSentence}</div>`;
    }
    document.getElementById('sentenceScore').textContent = sentenceScore;
    setTimeout(nextSentence, 2500);
}

function resetSentence() {
    nextSentence();
}

// ============ 新游戏3：英语谜语猜词 ============
let riddleScore = 0;
let riddleTotal = 0;
let currentRiddle = null;

const riddleBank = [
    { question: "I have cities but no houses, forests but no trees, water but no fish. What am I?", answer: "map", options: ["map", "book", "globe", "photo"] },
    { question: "What has keys but no locks, space but no room, and you can enter but not go in?", answer: "keyboard", options: ["keyboard", "door", "computer", "piano"] },
    { question: "What gets wetter the more it dries?", answer: "towel", options: ["towel", "sponge", "umbrella", "cloud"] },
    { question: "What has hands but can't clap?", answer: "clock", options: ["clock", "robot", "doll", "puppet"] },
    { question: "What has teeth but cannot bite?", answer: "comb", options: ["comb", "saw", "zip", "brush"] },
    { question: "What has a head and a tail but no body?", answer: "coin", options: ["coin", "snake", "worm", "letter"] },
    { question: "What can you catch but not throw?", answer: "cold", options: ["cold", "ball", "fish", "wind"] },
    { question: "What goes up but never comes down?", answer: "age", options: ["age", "balloon", "smoke", "plane"] },
    { question: "I'm tall when I'm young and short when I'm old. What am I?", answer: "candle", options: ["candle", "tree", "person", "building"] },
    { question: "What has many keys but can't open a single door?", answer: "piano", options: ["piano", "keyboard", "lock", "drawer"] },
    { question: "What belongs to you but others use it more than you do?", answer: "name", options: ["name", "phone", "money", "car"] },
    { question: "What has a neck but no head?", answer: "bottle", options: ["bottle", "shirt", "giraffe", "shoe"] }
];

function startRiddleGame(container) {
    riddleScore = 0;
    riddleTotal = 0;
    container.innerHTML = `
        <div class="game-area">
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
                <span class="tag tag-primary">得分：<span id="riddleScore">0</span></span>
                <span class="tag tag-accent">已答：<span id="riddleTotal">0</span></span>
            </div>
            <p style="text-align:center;color:var(--text-light);margin-bottom:8px;">🧠 猜一猜这个英语谜语</p>
            <div id="riddleQuestion" style="background:var(--bg);padding:20px;border-radius:12px;margin-bottom:16px;font-size:16px;line-height:1.8;"></div>
            <div id="riddleOptions" class="grid grid-2"></div>
            <div id="riddleResult" style="margin-top:16px;"></div>
        </div>
    `;
    nextRiddle();
}

function nextRiddle() {
    currentRiddle = riddleBank[Math.floor(Math.random() * riddleBank.length)];
    document.getElementById('riddleQuestion').textContent = currentRiddle.question;
    document.getElementById('riddleResult').innerHTML = '';
    const options = [...currentRiddle.options].sort(() => Math.random() - 0.5);
    const optionsContainer = document.getElementById('riddleOptions');
    optionsContainer.innerHTML = options.map(w =>
        `<button class="btn btn-outline btn-block" style="padding:14px;font-size:16px;" onclick="checkRiddle('${w}', this)">${w}</button>`
    ).join('');
}

function checkRiddle(selected, element) {
    riddleTotal++;
    document.getElementById('riddleTotal').textContent = riddleTotal;
    const result = document.getElementById('riddleResult');
    const buttons = element.parentElement.querySelectorAll('button');
    buttons.forEach(b => b.disabled = true);

    if (selected === currentRiddle.answer) {
        riddleScore++;
        element.style.background = 'var(--success)';
        element.style.color = 'white';
        result.innerHTML = `<div class="game-result correct">✅ 正确！答案是 ${currentRiddle.answer}</div>`;
    } else {
        element.style.background = 'var(--danger)';
        element.style.color = 'white';
        buttons.forEach(b => {
            if (b.textContent === currentRiddle.answer) {
                b.style.background = 'var(--success)';
                b.style.color = 'white';
            }
        });
        result.innerHTML = `<div class="game-result wrong">❌ 正确答案是：${currentRiddle.answer}</div>`;
    }
    document.getElementById('riddleScore').textContent = riddleScore;
    setTimeout(nextRiddle, 2000);
}

// ============ 新游戏4：单词消消乐（三消） ============
let match3Grid = [];
let match3Score = 0;
let match3Selected = null;
const match3Words = [
    {en: "apple", cn: "苹果", color: "#ef4444"},
    {en: "book", cn: "书", color: "#3b82f6"},
    {en: "dog", cn: "狗", color: "#10b981"},
    {en: "cat", cn: "猫", color: "#f59e0b"},
    {en: "sun", cn: "太阳", color: "#8b5cf6"},
    {en: "moon", cn: "月亮", color: "#ec4899"},
    {en: "fish", cn: "鱼", color: "#06b6d4"},
    {en: "bird", cn: "鸟", color: "#84cc16"}
];

function startMatch3Game(container) {
    match3Score = 0;
    match3Selected = null;
    container.innerHTML = `
        <div class="game-area">
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
                <span class="tag tag-primary">得分：<span id="match3Score">0</span></span>
                <span class="tag tag-accent">消除3个以上相同单词得分</span>
            </div>
            <p style="text-align:center;color:var(--text-light);margin-bottom:12px;">💎 点击两个相邻的单词交换位置，3个及以上连成线即可消除</p>
            <div id="match3Board" style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;max-width:480px;margin:0 auto;"></div>
            <div style="text-align:center;margin-top:16px;">
                <button class="btn btn-outline" onclick="reshuffleMatch3()">🔄 重排</button>
            </div>
        </div>
    `;
    initMatch3Grid();
}

function initMatch3Grid() {
    match3Grid = [];
    for (let r = 0; r < 8; r++) {
        let row = [];
        for (let c = 0; c < 6; c++) {
            row.push(Math.floor(Math.random() * match3Words.length));
        }
        match3Grid.push(row);
    }
    // 确保初始没有三连
    while (findMatch3Matches().length > 0) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 6; c++) {
                match3Grid[r][c] = Math.floor(Math.random() * match3Words.length);
            }
        }
    }
    renderMatch3();
}

function renderMatch3() {
    const board = document.getElementById('match3Board');
    let html = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 6; c++) {
            const idx = match3Grid[r][c];
            const word = idx >= 0 ? match3Words[idx] : null;
            const isSelected = match3Selected && match3Selected.r === r && match3Selected.c === c;
            if (word) {
                html += `<div class="match3-cell" onclick="selectMatch3(${r},${c})" style="
                    background:${word.color};
                    color:white;
                    padding:12px 4px;
                    border-radius:8px;
                    text-align:center;
                    font-size:14px;
                    font-weight:bold;
                    cursor:pointer;
                    transition:all 0.2s;
                    border:${isSelected ? '3px solid gold' : '3px solid transparent'};
                    transform:${isSelected ? 'scale(1.1)' : 'scale(1)'};">
                    <div style="font-size:16px;">${word.en}</div>
                    <div style="font-size:11px;opacity:0.9;">${word.cn}</div>
                </div>`;
            } else {
                html += `<div style="background:transparent;padding:12px 4px;border-radius:8px;"></div>`;
            }
        }
    }
    board.innerHTML = html;
    const scoreEl = document.getElementById('match3Score');
    if (scoreEl) scoreEl.textContent = match3Score;
}

function selectMatch3(r, c) {
    if (!match3Selected) {
        match3Selected = {r, c};
        renderMatch3();
        return;
    }
    const dr = Math.abs(match3Selected.r - r);
    const dc = Math.abs(match3Selected.c - c);
    if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
        // 相邻，直接交换（自由交换，更解压）
        const temp = match3Grid[match3Selected.r][match3Selected.c];
        match3Grid[match3Selected.r][match3Selected.c] = match3Grid[r][c];
        match3Grid[r][c] = temp;
        match3Selected = null;
        const matches = findMatch3Matches();
        if (matches.length > 0) {
            processMatches(matches);
        } else {
            renderMatch3();
        }
    } else {
        // 不相邻，重新选择
        match3Selected = {r, c};
        renderMatch3();
    }
}

function findMatch3Matches() {
    const matches = [];
    // 横向
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 4; c++) {
            if (match3Grid[r][c] === match3Grid[r][c+1] && match3Grid[r][c] === match3Grid[r][c+2]) {
                matches.push({r, c, dir: 'h'});
            }
        }
    }
    // 纵向
    for (let c = 0; c < 6; c++) {
        for (let r = 0; r < 6; r++) {
            if (match3Grid[r][c] === match3Grid[r+1][c] && match3Grid[r][c] === match3Grid[r+2][c]) {
                matches.push({r, c, dir: 'v'});
            }
        }
    }
    return matches;
}

function processMatches(matches) {
    const toRemove = new Set();
    matches.forEach(m => {
        if (m.dir === 'h') {
            toRemove.add(`${m.r},${m.c}`);
            toRemove.add(`${m.r},${m.c+1}`);
            toRemove.add(`${m.r},${m.c+2}`);
        } else {
            toRemove.add(`${m.r},${m.c}`);
            toRemove.add(`${m.r+1},${m.c}`);
            toRemove.add(`${m.r+2},${m.c}`);
        }
    });
    match3Score += toRemove.size * 10;
    toRemove.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        match3Grid[r][c] = -1;
    });
    renderMatch3();
    setTimeout(() => {
        // 下落
        for (let c = 0; c < 6; c++) {
            let writePos = 7;
            for (let r = 7; r >= 0; r--) {
                if (match3Grid[r][c] !== -1) {
                    match3Grid[writePos][c] = match3Grid[r][c];
                    if (writePos !== r) match3Grid[r][c] = -1;
                    writePos--;
                }
            }
            for (let r = writePos; r >= 0; r--) {
                match3Grid[r][c] = Math.floor(Math.random() * match3Words.length);
            }
        }
        renderMatch3();
        const newMatches = findMatch3Matches();
        if (newMatches.length > 0) {
            setTimeout(() => processMatches(newMatches), 300);
        }
    }, 300);
}

function reshuffleMatch3() {
    initMatch3Grid();
    showToast('已重新排列');
}

// ============ 新游戏5：单词割草（肉鸽风格） ============
let grassState = {
    player: {x: 200, y: 200, hp: 100, atk: 10, level: 1, exp: 0},
    monsters: [],
    score: 0,
    kills: 0,
    wave: 1,
    running: false,
    keys: {}
};

const grassMonsters = [
    {en: "apple", cn: "苹果", hp: 20, color: "#ef4444"},
    {en: "book", cn: "书", hp: 25, color: "#3b82f6"},
    {en: "dog", cn: "狗", hp: 30, color: "#10b981"},
    {en: "cat", cn: "猫", hp: 25, color: "#f59e0b"},
    {en: "fish", cn: "鱼", hp: 20, color: "#06b6d4"},
    {en: "bird", cn: "鸟", hp: 22, color: "#84cc16"},
    {en: "sun", cn: "太阳", hp: 35, color: "#f97316"},
    {en: "moon", cn: "月亮", hp: 35, color: "#8b5cf6"}
];

function startGrassGame(container) {
    grassState = {
        player: {x: 200, y: 200, hp: 100, atk: 10, level: 1, exp: 0},
        monsters: [],
        score: 0,
        kills: 0,
        wave: 1,
        running: true,
        keys: {}
    };
    container.innerHTML = `
        <div class="game-area">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                <span class="tag tag-primary">等级：<span id="grassLevel">1</span></span>
                <span class="tag tag-success">生命：<span id="grassHp">100</span></span>
                <span class="tag tag-accent">击杀：<span id="grassKills">0</span></span>
                <span class="tag tag-primary">波次：<span id="grassWave">1</span></span>
                <span class="tag tag-accent">得分：<span id="grassScore">0</span></span>
            </div>
            <p style="text-align:center;color:var(--text-light);margin-bottom:12px;">⚔️ 用 WASD 或方向键移动，主动碰撞怪物来击杀它们！走位躲开怪物，越打越强。</p>
            <canvas id="grassCanvas" width="400" height="400" style="background:#1a1a2e;border-radius:12px;display:block;margin:0 auto;"></canvas>
            <div style="text-align:center;margin-top:12px;">
                <button class="btn btn-danger" onclick="stopGrassGame()">🏳️ 结束游戏</button>
            </div>
            <div id="grassTip" style="margin-top:12px;text-align:center;color:var(--text-light);font-size:14px;"></div>
        </div>
    `;
    document.addEventListener('keydown', grassKeyDown);
    document.addEventListener('keyup', grassKeyUp);
    spawnGrassWave();
    grassGameLoop();
}

function grassKeyDown(e) {
    grassState.keys[e.key.toLowerCase()] = true;
}
function grassKeyUp(e) {
    grassState.keys[e.key.toLowerCase()] = false;
}

function spawnGrassWave() {
    const count = 3 + grassState.wave * 2;
    for (let i = 0; i < count; i++) {
        const m = grassMonsters[Math.floor(Math.random() * grassMonsters.length)];
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        if (edge === 0) { x = Math.random() * 400; y = 0; }
        else if (edge === 1) { x = 400; y = Math.random() * 400; }
        else if (edge === 2) { x = Math.random() * 400; y = 400; }
        else { x = 0; y = Math.random() * 400; }
        grassState.monsters.push({
            ...m,
            x, y,
            currentHp: m.hp + grassState.wave * 5,
            maxHp: m.hp + grassState.wave * 5
        });
    }
}

function grassGameLoop() {
    if (!grassState.running) return;
    const p = grassState.player;
    // 防止页面切换后 DOM 元素不存在导致崩溃
    if (!document.getElementById('grassLevel')) {
        grassState.running = false;
        return;
    }
    const speed = 4;
    // 玩家移动
    if (grassState.keys['w'] || grassState.keys['arrowup']) p.y -= speed;
    if (grassState.keys['s'] || grassState.keys['arrowdown']) p.y += speed;
    if (grassState.keys['a'] || grassState.keys['arrowleft']) p.x -= speed;
    if (grassState.keys['d'] || grassState.keys['arrowright']) p.x += speed;
    p.x = Math.max(15, Math.min(385, p.x));
    p.y = Math.max(15, Math.min(385, p.y));

    // 怪物漫游：每个怪物有自己的移动方向，偶尔改变方向
    grassState.monsters.forEach(m => {
        if (!m.dir || Math.random() < 0.01) {
            const ang = Math.random() * Math.PI * 2;
            m.dir = { x: Math.cos(ang), y: Math.sin(ang) };
        }
        const mspeed = 0.8 + Math.random() * 0.4;
        m.x += m.dir.x * mspeed;
        m.y += m.dir.y * mspeed;
        // 边界反弹
        if (m.x < 14) { m.x = 14; m.dir.x *= -1; }
        if (m.x > 386) { m.x = 386; m.dir.x *= -1; }
        if (m.y < 14) { m.y = 14; m.dir.y *= -1; }
        if (m.y > 386) { m.y = 386; m.dir.y *= -1; }

        // 怪物碰到玩家造成伤害
        const dx = p.x - m.x;
        const dy = p.y - m.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 22) {
            p.hp -= 0.5;
            // 怪物被弹开
            m.dir.x *= -1;
            m.dir.y *= -1;
        }
    });

    // 玩家碰撞怪物才造成伤害（必须主动撞上去）
    grassState.monsters.forEach(m => {
        const dx = p.x - m.x;
        const dy = p.y - m.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 24) {
            m.currentHp -= p.atk * 0.15;
        }
    });

    // 移除死亡怪物
    const dead = grassState.monsters.filter(m => m.currentHp <= 0);
    dead.forEach(m => {
        grassState.kills++;
        grassState.score += 10 * grassState.wave;
        p.exp += 15;
        if (p.exp >= p.level * 50) {
            p.level++;
            p.exp = 0;
            p.hp = Math.min(100 + p.level * 10, p.hp + 20);
            p.atk += 3;
        }
    });
    grassState.monsters = grassState.monsters.filter(m => m.currentHp > 0);

    // 检查下一波
    if (grassState.monsters.length === 0) {
        grassState.wave++;
        spawnGrassWave();
    }

    // 更新UI
    document.getElementById('grassLevel').textContent = p.level;
    document.getElementById('grassHp').textContent = Math.max(0, Math.round(p.hp));
    document.getElementById('grassKills').textContent = grassState.kills;
    document.getElementById('grassWave').textContent = grassState.wave;
    document.getElementById('grassScore').textContent = grassState.score;

    // 绘制
    drawGrassGame();

    if (p.hp <= 0) {
        grassState.running = false;
        document.getElementById('grassTip').innerHTML = `<div style="color:var(--danger);font-size:20px;font-weight:bold;">💀 游戏结束！击杀 ${grassState.kills} 个怪物，得分 ${grassState.score}</div>`;
        document.removeEventListener('keydown', grassKeyDown);
        document.removeEventListener('keyup', grassKeyUp);
        return;
    }

    requestAnimationFrame(grassGameLoop);
}

function drawGrassGame() {
    const canvas = document.getElementById('grassCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 400, 400);

    // 画怪物
    grassState.monsters.forEach(m => {
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(m.en, m.x, m.y - 18);
        // 血条
        ctx.fillStyle = '#333';
        ctx.fillRect(m.x - 15, m.y - 14, 30, 4);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(m.x - 15, m.y - 14, 30 * (m.currentHp / m.maxHp), 4);
    });

    // 画玩家
    const p = grassState.player;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251,191,36,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('你', p.x, p.y + 4);
}

function stopGrassGame() {
    grassState.running = false;
    document.removeEventListener('keydown', grassKeyDown);
    document.removeEventListener('keyup', grassKeyUp);
    document.getElementById('grassTip').innerHTML = `<div style="color:var(--primary);font-size:20px;font-weight:bold;">🏳️ 游戏结束！击杀 ${grassState.kills} 个怪物，得分 ${grassState.score}</div>`;
}

// ============ 新游戏6：单词赛车（按词性选岔路）============
const racingWordBank = [
    {en: "run", cn: "跑", pos: "verb"},
    {en: "happy", cn: "快乐的", pos: "adj"},
    {en: "book", cn: "书", pos: "noun"},
    {en: "quickly", cn: "快速地", pos: "adv"},
    {en: "eat", cn: "吃", pos: "verb"},
    {en: "beautiful", cn: "美丽的", pos: "adj"},
    {en: "cat", cn: "猫", pos: "noun"},
    {en: "slowly", cn: "慢慢地", pos: "adv"},
    {en: "jump", cn: "跳", pos: "verb"},
    {en: "tall", cn: "高的", pos: "adj"},
    {en: "school", cn: "学校", pos: "noun"},
    {en: "carefully", cn: "小心地", pos: "adv"},
    {en: "write", cn: "写", pos: "verb"},
    {en: "smart", cn: "聪明的", pos: "adj"},
    {en: "water", cn: "水", pos: "noun"},
    {en: "suddenly", cn: "突然地", pos: "adv"},
    {en: "read", cn: "读", pos: "verb"},
    {en: "strong", cn: "强壮的", pos: "adj"},
    {en: "friend", cn: "朋友", pos: "noun"},
    {en: "easily", cn: "容易地", pos: "adv"},
    {en: "sleep", cn: "睡觉", pos: "verb"},
    {en: "cold", cn: "冷的", pos: "adj"},
    {en: "apple", cn: "苹果", pos: "noun"},
    {en: "loudly", cn: "大声地", pos: "adv"},
    {en: "play", cn: "玩", pos: "verb"},
    {en: "young", cn: "年轻的", pos: "adj"},
    {en: "music", cn: "音乐", pos: "noun"},
    {en: "quietly", cn: "安静地", pos: "adv"}
];

let racingState = null;
function startRacingGame(container) {
    if (racingState && racingState.timer) clearInterval(racingState.timer);
    container.innerHTML = `
        <div class="game-area">
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
                <span class="tag tag-primary">得分：<span id="racingScore">0</span></span>
                <span class="tag tag-accent">关卡：<span id="racingLevel">1</span></span>
            </div>
            <p style="text-align:center;color:var(--text-light);margin-bottom:12px;">🏎️ 看单词词性，按 ← → 键选择正确车道通过岔路！</p>
            <canvas id="racingCanvas" width="400" height="500" style="background:#2d2d44;border-radius:12px;display:block;margin:0 auto;"></canvas>
            <div id="racingWord" style="text-align:center;font-size:24px;font-weight:bold;margin:12px 0;color:var(--primary);">准备...</div>
            <div id="racingLanes" style="display:flex;justify-content:center;gap:20px;margin-bottom:12px;">
                <button class="btn btn-outline" id="laneLeft" onclick="chooseRacingLane(0)">← 左道</button>
                <button class="btn btn-outline" id="laneRight" onclick="chooseRacingLane(1)">右道 →</button>
            </div>
            <div id="racingResult" style="text-align:center;min-height:24px;"></div>
        </div>
    `;
    racingState = {
        score: 0,
        level: 1,
        currentWord: null,
        correctLane: 0,
        timeLeft: 5,
        timer: null,
        running: true,
        carX: 200,
        offset: 0
    };
    document.addEventListener('keydown', racingKeyHandler);
    nextRacingRound();
    drawRacing();
}

function racingKeyHandler(e) {
    if (!racingState || !racingState.running) return;
    if (e.key === 'ArrowLeft') chooseRacingLane(0);
    else if (e.key === 'ArrowRight') chooseRacingLane(1);
}

function nextRacingRound() {
    if (!racingState || !racingState.running) return;
    racingState.currentWord = racingWordBank[Math.floor(Math.random() * racingWordBank.length)];
    racingState.correctLane = Math.floor(Math.random() * 2);
    racingState.timeLeft = Math.max(2, 6 - Math.floor(racingState.level / 3));
    document.getElementById('racingWord').innerHTML = `<span style="color:var(--primary);">${racingState.currentWord.en}</span> <span style="font-size:16px;color:var(--text-light);">(${racingState.currentWord.cn})</span>`;
    document.getElementById('racingResult').innerHTML = '';
    // 显示两条车道的词性
    const posName = {verb: '动词 verb', noun: '名词 noun', adj: '形容词 adj', adv: '副词 adv'};
    const correctPos = racingState.currentWord.pos;
    // 错误词性随机
    const allPos = ['verb', 'noun', 'adj', 'adv'];
    let wrongPos = allPos[Math.floor(Math.random() * allPos.length)];
    while (wrongPos === correctPos) wrongPos = allPos[Math.floor(Math.random() * allPos.length)];
    const leftPos = racingState.correctLane === 0 ? correctPos : wrongPos;
    const rightPos = racingState.correctLane === 1 ? correctPos : wrongPos;
    document.getElementById('laneLeft').textContent = `← 左道 [${posName[leftPos]}]`;
    document.getElementById('laneRight').textContent = `右道 [${posName[rightPos]}] →`;

    if (racingState.timer) clearInterval(racingState.timer);
    racingState.timer = setInterval(() => {
        if (!racingState) return;
        racingState.timeLeft -= 0.1;
        if (racingState.timeLeft <= 0) {
            racingLose('⏰ 时间到！');
        }
    }, 100);
}

function chooseRacingLane(lane) {
    if (!racingState || !racingState.running) return;
    if (racingState.timer) clearInterval(racingState.timer);
    if (lane === racingState.correctLane) {
        racingState.score += 10 * racingState.level;
        racingState.level++;
        document.getElementById('racingScore').textContent = racingState.score;
        document.getElementById('racingLevel').textContent = racingState.level;
        document.getElementById('racingResult').innerHTML = `<div style="color:var(--success);font-weight:bold;">✅ 正确！通过岔路！</div>`;
        setTimeout(nextRacingRound, 800);
    } else {
        racingLose('❌ 走错车道了！');
    }
}

function racingLose(msg) {
    racingState.running = false;
    if (racingState.timer) clearInterval(racingState.timer);
    document.removeEventListener('keydown', racingKeyHandler);
    document.getElementById('racingResult').innerHTML = `<div style="color:var(--danger);font-weight:bold;font-size:18px;">${msg}<br>最终得分：${racingState.score}，通过 ${racingState.level - 1} 个岔路</div>`;
}

function drawRacing() {
    const canvas = document.getElementById('racingCanvas');
    if (!canvas || !racingState) return;
    const ctx = canvas.getContext('2d');
    racingState.offset = (racingState.offset + 4) % 40;
    // 背景
    ctx.fillStyle = '#2d2d44';
    ctx.fillRect(0, 0, 400, 500);
    // 道路
    ctx.fillStyle = '#3a3a5c';
    ctx.fillRect(60, 0, 280, 500);
    // 道路中线（虚线滚动）
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    ctx.moveTo(200, -racingState.offset);
    ctx.lineTo(200, 500);
    ctx.stroke();
    ctx.setLineDash([]);
    // 车道边线
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(60, 0); ctx.lineTo(60, 500);
    ctx.moveTo(340, 0); ctx.lineTo(340, 500);
    ctx.stroke();
    // 岔路标识（前方路口）
    ctx.fillStyle = '#10b981';
    ctx.fillRect(60, 60, 130, 6);
    ctx.fillRect(210, 60, 130, 6);
    // 玩家车
    const cx = racingState.correctLane === 0 ? 130 : 270;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(cx - 18, 420, 36, 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏎️', cx, 455);
    if (racingState.running) requestAnimationFrame(drawRacing);
}

// ============ 新游戏7：喂养小猫（文字事件）============
const catEvents = [
    {event: "🐱 小猫感觉好冷，浑身发抖...", need: ["clothes", "coat", "sweater", "warm"], emoji: "🧥", result: "小猫穿上了暖和的衣服，不再发抖了！"},
    {event: "🐱 小猫肚子饿了，喵喵叫着要吃东西...", need: ["food", "eat", "meal", "fish"], emoji: "🍱", result: "小猫吃饱了，满足地舔了舔嘴巴！"},
    {event: "🐱 小猫口渴了，一直在舔嘴巴...", need: ["water", "drink", "milk"], emoji: "🥛", result: "小猫喝到了水，精神多了！"},
    {event: "🐱 小猫困了，眼睛都睁不开了...", need: ["sleep", "bed", "rest"], emoji: "😴", result: "小猫甜甜地睡着了，做了个好梦！"},
    {event: "🐱 小猫看起来很无聊，想找人陪它玩...", need: ["play", "toy", "game", "ball"], emoji: "🎾", result: "小猫开心地玩起了玩具，活力满满！"},
    {event: "🐱 小猫身上有点脏，该洗澡了...", need: ["clean", "wash", "bath", "shower"], emoji: "🛁", result: "小猫洗得干干净净，毛变得蓬松柔软！"},
    {event: "🐱 小猫有点咳嗽，好像生病了...", need: ["medicine", "doctor", "hospital", "cure"], emoji: "💊", result: "小猫吃了药，很快就康复了！"},
    {event: "🐱 小猫心情不好，有点忧郁...", need: ["happy", "smile", "love", "hug"], emoji: "🤗", result: "小猫感受到了主人的爱，心情变得阳光起来！"},
    {event: "🐱 小猫的爪子长长了，需要修剪...", need: ["cut", "trim", "nail", "care"], emoji: "✂️", result: "小猫的指甲被修剪整齐，舒服多了！"},
    {event: "🐱 小猫住的猫窝有点乱，该整理了...", need: ["clean", "tidy", "room", "house"], emoji: "🏠", result: "小猫的窝变得整整齐齐，它满意地窝了进去！"},
    {event: "🐱 小猫想出门散步，但外面下雨了...", need: ["umbrella", "rain", "coat", "cover"], emoji: "☂️", result: "主人撑起了伞，小猫安全地完成了散步！"},
    {event: "🐱 小猫对路过的小鸟很好奇，一直盯着看...", need: ["watch", "look", "observe", "see"], emoji: "👀", result: "小猫安静地观察着小鸟，满足了好奇心！"}
];

let catState = null;
function startCatGame(container) {
    container.innerHTML = `
        <div class="game-area" style="text-align:center;">
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
                <span class="tag tag-success">心情：<span id="catMood">100</span></span>
                <span class="tag tag-primary">事件数：<span id="catCount">0</span></span>
            </div>
            <div id="catDisplay" style="font-size:120px;margin:20px 0;line-height:1.2;">🐱</div>
            <div id="catEvent" style="font-size:18px;font-weight:bold;margin-bottom:16px;min-height:28px;"></div>
            <div id="catOptions" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;max-width:500px;margin:0 auto;"></div>
            <div id="catResult" style="margin-top:16px;min-height:24px;"></div>
            <div style="margin-top:16px;">
                <button class="btn btn-outline" onclick="startGame('cat')">🔄 重新开始</button>
            </div>
        </div>
    `;
    catState = { mood: 100, count: 0, current: null };
    nextCatEvent();
}

function nextCatEvent() {
    if (!catState) return;
    if (catState.mood <= 0) {
        document.getElementById('catEvent').innerHTML = '😿 小猫心情太差，躲起来了...游戏结束';
        document.getElementById('catOptions').innerHTML = '';
        return;
    }
    catState.current = catEvents[Math.floor(Math.random() * catEvents.length)];
    document.getElementById('catEvent').textContent = catState.current.event;
    document.getElementById('catDisplay').textContent = '🐱';

    // 生成选项：1个正确 + 3个干扰（从 gameWords 中取）
    const correct = catState.current.need[Math.floor(Math.random() * catState.current.need.length)];
    const options = [correct];
    const used = new Set([correct]);
    while (options.length < 4) {
        const w = gameWords[Math.floor(Math.random() * gameWords.length)];
        const wn = w.en.toLowerCase();
        if (!used.has(wn)) {
            used.add(wn);
            options.push(wn);
        }
    }
    options.sort(() => Math.random() - 0.5);

    const optsDiv = document.getElementById('catOptions');
    optsDiv.innerHTML = options.map(w =>
        `<button class="btn btn-outline" style="padding:14px;font-size:15px;" onclick="chooseCatOption('${w}')">${w}</button>`
    ).join('');
    document.getElementById('catResult').innerHTML = '';
}

function chooseCatOption(word) {
    if (!catState || !catState.current) return;
    const correct = catState.current.need;
    const isRight = correct.some(c => word.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(word.toLowerCase()));
    const resultDiv = document.getElementById('catResult');
    const display = document.getElementById('catDisplay');
    const buttons = document.querySelectorAll('#catOptions button');
    buttons.forEach(b => b.disabled = true);

    if (isRight) {
        catState.mood = Math.min(100, catState.mood + 15);
        catState.count++;
        document.getElementById('catMood').textContent = catState.mood;
        document.getElementById('catCount').textContent = catState.count;
        display.textContent = catState.current.emoji + '🐱';
        resultDiv.innerHTML = `<div style="color:var(--success);font-weight:bold;">✅ ${catState.current.result}</div>`;
        setTimeout(nextCatEvent, 1800);
    } else {
        catState.mood -= 20;
        document.getElementById('catMood').textContent = Math.max(0, catState.mood);
        display.textContent = '😿';
        resultDiv.innerHTML = `<div style="color:var(--danger);font-weight:bold;">❌ 小猫不太满意... 正确答案可能是：${correct.join(' / ')}</div>`;
        setTimeout(nextCatEvent, 1800);
    }
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
