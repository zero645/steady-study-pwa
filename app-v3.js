"use strict";

const STORAGE_KEY = "stepwise-study-planner-v3";
const LEGACY_STORAGE_KEY = "stepwise-study-planner-v2";
const Planner = StudyPlannerV3;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const todayKey = Planner.dateKey(new Date());

let store = loadStore();
let activeView = "today";
let selectedSubject = "全部";
let lastResultTaskId = null;
let deferredInstallPrompt = null;
let timerHandle = null;
let toastHandle = null;

function loadStore() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "null");
  } catch {
    raw = null;
  }
  const next = Planner.migrateStore(raw, todayKey);
  Planner.ensureDay(next, todayKey);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function refreshIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

function subjectKey(subject) {
  return Planner.SUBJECT_META[subject]?.key || "math";
}

function subjectShort(subject) {
  return Planner.SUBJECT_META[subject]?.short || subject;
}

function showToast(message) {
  clearTimeout(toastHandle);
  $("#toastText").textContent = message;
  $("#toast").classList.remove("hidden");
  toastHandle = setTimeout(() => $("#toast").classList.add("hidden"), 2400);
  refreshIcons();
}

function formatDate(key, options) {
  return new Intl.DateTimeFormat("zh-CN", options).format(Planner.pointByCode ? new Date(key + "T12:00:00") : new Date());
}

function render() {
  $$(".view").forEach((view) => view.classList.toggle("hidden", view.dataset.view !== activeView));
  $$("[data-view-target]").forEach((button) => button.classList.toggle("active", button.dataset.viewTarget === activeView));
  if (activeView === "today") renderToday();
  if (activeView === "review") renderReview();
  if (activeView === "progress") renderProgress();
  renderDueBadge();
  refreshIcons();
}

function renderToday() {
  const day = Planner.ensureDay(store, todayKey);
  const current = Planner.currentTask(store, todayKey);
  const completed = day.tasks.filter((task) => task.completed).length;
  const hasStarted = day.tasks.some((task) => task.completed || task.phase !== "ready");
  const date = new Date(todayKey + "T12:00:00");
  $("#todayDate").textContent = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(date);
  $("#todayGreeting").textContent = completed
    ? (completed === day.tasks.length ? "今天已经完成，可以停下了。" : "已经开始了，继续下一小步。")
    : "先完成今天最小的一步。";
  const mode = Planner.MODES[day.mode];
  $("#modeSummary").textContent = mode.label + " · 约 " + mode.minutes + " 分钟";
  $$("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === day.mode);
    button.disabled = hasStarted;
  });
  $("#rescueMode").disabled = hasStarted;
  $("#queueProgress").textContent = completed + " / " + day.tasks.length;

  const resultTask = lastResultTaskId ? day.tasks.find((task) => task.id === lastResultTaskId) : null;
  if (resultTask?.completed) {
    $("#taskStage").innerHTML = renderResultCard(resultTask, day);
  } else if (current) {
    $("#taskStage").innerHTML = renderTaskCard(current, day);
  } else {
    $("#taskStage").innerHTML = renderDoneCard(day);
  }

  $("#queueList").innerHTML = day.tasks.map((task, index) => {
    const currentClass = current?.id === task.id ? " current" : "";
    const completedClass = task.completed ? " completed" : "";
    const state = task.completed
      ? task.result.score + "%"
      : current?.id === task.id
        ? (task.phase === "ready" ? "现在" : task.phase === "learning" ? "学习中" : "小测中")
        : "待开始";
    return '<div class="queue-item' + currentClass + completedClass + '">' +
      '<span class="queue-order">' + (task.completed ? '<i data-lucide="check"></i>' : index + 1) + '</span>' +
      '<div class="queue-copy"><strong>' + escapeHtml(task.title) + '</strong><span>' +
      escapeHtml(subjectShort(task.subject)) + " · " + task.duration + " 分钟 · " + (task.kind === "review" ? "复习" : "新学") +
      '</span></div><span class="queue-state">' + state + '</span></div>';
  }).join("");

  syncTimer(current);
  refreshIcons();
}

function renderTaskCard(task, day) {
  const cardClass = "subject-" + subjectKey(task.subject);
  if (task.phase === "quiz") return renderQuizCard(task, day);
  if (task.phase === "learning") return renderLearningCard(task, day);
  const index = day.tasks.findIndex((item) => item.id === task.id);
  return '<article class="action-card ' + cardClass + '">' +
    '<div class="action-body">' +
      renderTaskTopline(task, index, day.tasks.length) +
      '<h2>' + escapeHtml(task.title) + '</h2>' +
      '<p class="task-duration"><i data-lucide="clock-3"></i>建议 ' + task.duration + ' 分钟</p>' +
      renderGoals(task) +
      renderSearch(task) +
    '</div>' +
    '<footer class="action-footer"><button class="primary-button" data-action="start-task" data-task-id="' + task.id + '">' +
      '<i data-lucide="play"></i>开始学习</button></footer>' +
  '</article>';
}

function renderTaskTopline(task, index, total) {
  return '<div class="task-topline"><div>' +
    '<span class="subject-pill ' + subjectKey(task.subject) + '">' + escapeHtml(subjectShort(task.subject)) + '</span>' +
    '<span class="task-kind">' + (task.kind === "review" ? "到期复习" : "新知识") + '</span>' +
    '<span class="knowledge-code">' + escapeHtml(task.knowledgeId) + '</span>' +
    '</div><span class="task-step">第 ' + (index + 1) + ' 项 / 共 ' + total + ' 项</span></div>';
}

function renderGoals(task) {
  return '<div class="goal-block"><span class="block-label">完成标准</span><ul class="goal-list">' +
    task.goals.map((goal) => '<li>' + escapeHtml(goal) + '</li>').join("") +
    '</ul></div>';
}

function renderSearch(task) {
  return '<div class="search-block"><span class="block-label">搜索词</span><div class="search-value">' +
    '<span>' + escapeHtml(task.search) + '</span>' +
    '<button class="copy-button" data-action="copy-search" data-query="' + escapeHtml(task.search) + '" aria-label="复制搜索词" title="复制搜索词"><i data-lucide="copy"></i></button>' +
    '</div></div>';
}

function renderLearningCard(task, day) {
  const index = day.tasks.findIndex((item) => item.id === task.id);
  const searchUrl = "https://www.bing.com/search?q=" + encodeURIComponent(task.search);
  return '<article class="action-card subject-' + subjectKey(task.subject) + '">' +
    '<div class="action-body">' +
      renderTaskTopline(task, index, day.tasks.length) +
      '<div class="session-head"><div><h2>' + escapeHtml(task.title) + '</h2><p class="task-duration"><i data-lucide="clock-3"></i>目标 ' +
      task.duration + ' 分钟</p></div><div class="timer-box"><strong id="studyTimer">00:00</strong><span>已学习</span></div></div>' +
      renderGoals(task) +
      renderSearch(task) +
      '<div class="session-actions">' +
        '<a class="secondary-button search-link" href="' + searchUrl + '" target="_blank" rel="noopener"><i data-lucide="search"></i>打开搜索</a>' +
        '<button class="primary-button" data-action="start-quiz" data-task-id="' + task.id + '"><i data-lucide="list-checks"></i>学完，开始小测</button>' +
      '</div>' +
    '</div>' +
  '</article>';
}

function renderQuizCard(task, day) {
  const index = day.tasks.findIndex((item) => item.id === task.id);
  const questions = Planner.questionsFor(task.knowledgeId, task.quizLimit);
  const body = questions.length
    ? questions.map((question, questionIndex) => {
        return '<fieldset class="question-block"><h3>' + (questionIndex + 1) + ". " + escapeHtml(question.prompt) + '</h3>' +
          '<div class="option-list">' + question.options.map((option, optionIndex) =>
            '<label class="option-row"><input type="radio" name="question-' + questionIndex + '" value="' + optionIndex + '" required />' +
            '<span>' + escapeHtml(option) + '</span></label>'
          ).join("") + '</div></fieldset>';
      }).join("")
    : '<div class="external-score"><label>完成网上找到的 5 道基础题后，选择正确题数' +
      '<select name="external-score" required><option value="">请选择</option>' +
      [0, 1, 2, 3, 4, 5].map((score) => '<option value="' + score + '">' + score + " / 5</option>").join("") +
      '</select></label></div>';

  return '<article class="action-card subject-' + subjectKey(task.subject) + '">' +
    '<form id="quizForm" data-task-id="' + task.id + '" data-question-count="' + questions.length + '">' +
      '<div class="action-body"><div class="quiz-header">' +
        renderTaskTopline(task, index, day.tasks.length) +
        '<h2>' + (questions.length ? "完成 " + questions.length + " 道小测" : "记录练习结果") + '</h2>' +
        '<span class="quiz-progress">' + escapeHtml(task.title) + '</span>' +
      '</div>' + body + '</div>' +
      '<footer class="action-footer"><button class="primary-button" type="submit"><i data-lucide="check"></i>提交小测</button></footer>' +
    '</form>' +
  '</article>';
}

function renderResultCard(task, day) {
  const questions = Planner.questionsFor(task.knowledgeId, task.quizLimit);
  const result = task.result;
  const nextReview = store.progress[task.knowledgeId]?.nextReview;
  const message = result.score >= 80
    ? "本次通过，" + result.interval + " 天后再检查一次。"
    : result.score >= 40
      ? "基础还不稳定，" + result.interval + " 天后复习。"
      : "先不要赶进度，明天重新处理这个知识点。";
  const answers = questions.length ? '<div class="answer-review">' + questions.map((question, index) => {
    const selected = Number(result.answers[index]);
    const correct = selected === question.answer;
    return '<div class="answer-item ' + (correct ? "correct" : "wrong") + '"><strong>' +
      '<i data-lucide="' + (correct ? "circle-check" : "circle-x") + '"></i>' +
      (index + 1) + ". " + (correct ? "回答正确" : "正确答案：" + escapeHtml(question.options[question.answer])) +
      '</strong><p>' + escapeHtml(question.explanation) + '</p></div>';
  }).join("") + '</div>' : "";
  return '<article class="action-card subject-' + subjectKey(task.subject) + '">' +
    '<div class="action-body"><div class="result-summary">' +
      '<div class="score-ring">' + result.score + '%</div><div><h2>' + result.correct + " / " + result.total + ' 题正确</h2>' +
      '<p>' + message + (nextReview ? " 下次：" + nextReview : "") + '</p></div></div>' +
      answers +
    '</div><footer class="action-footer"><button class="primary-button" data-action="next-task"><i data-lucide="arrow-right"></i>' +
      (day.tasks.every((item) => item.completed) ? "结束今天" : "继续下一项") + '</button></footer></article>';
}

function renderDoneCard(day) {
  const average = day.tasks.length
    ? Math.round(day.tasks.reduce((sum, task) => sum + Number(task.result?.score || 0), 0) / day.tasks.length)
    : 0;
  return '<article class="action-card"><div class="all-done"><div><span class="done-mark"><i data-lucide="check"></i></span>' +
    '<h2>今天到这里就够了</h2><p>完成 ' + day.tasks.length + ' 项，平均正确率 ' + average +
    '%。需要复习的内容已经自动安排。</p></div></div></article>';
}

function syncTimer(task) {
  clearInterval(timerHandle);
  if (!task || task.phase !== "learning" || !task.startedAt || !$("#studyTimer")) return;
  const update = () => {
    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(task.startedAt).getTime()) / 1000));
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    if ($("#studyTimer")) $("#studyTimer").textContent = minutes + ":" + seconds;
  };
  update();
  timerHandle = setInterval(update, 1000);
}

function submitQuiz(form) {
  const taskId = form.dataset.taskId;
  const day = Planner.ensureDay(store, todayKey);
  const task = day.tasks.find((item) => item.id === taskId);
  if (!task) return;
  const questions = Planner.questionsFor(task.knowledgeId, task.quizLimit);
  const data = new FormData(form);
  let result;
  if (questions.length) {
    const answers = questions.map((_, index) => Number(data.get("question-" + index)));
    if (answers.some((answer) => Number.isNaN(answer))) {
      showToast("请先完成全部题目");
      return;
    }
    const correct = answers.filter((answer, index) => answer === questions[index].answer).length;
    result = { correct, total: questions.length, answers, source: "built-in" };
  } else {
    const correct = Number(data.get("external-score"));
    if (Number.isNaN(correct)) {
      showToast("请选择正确题数");
      return;
    }
    result = { correct, total: 5, source: "self-reported" };
  }
  Planner.recordQuizResult(store, todayKey, taskId, result);
  lastResultTaskId = taskId;
  saveStore();
  renderToday();
}

function renderReview() {
  const due = Planner.duePoints(store, todayKey);
  $("#reviewSummary").textContent = due.length ? "今天有 " + due.length + " 个知识点到期" : "今天没有到期内容";
  $("#dueList").innerHTML = due.length ? due.map((point) => {
    const progress = store.progress[point.code];
    return '<div class="due-item"><div class="due-copy"><strong>' + escapeHtml(point.title) + '</strong><span>' +
      escapeHtml(subjectShort(point.subject)) + " · 上次 " + progress.lastScore + '% · ' + point.code +
      '</span></div><button class="secondary-button small-button" data-action="queue-review" data-code="' + point.code + '">加入今天</button></div>';
  }).join("") : '<div class="empty-list">今天没有到期复习。</div>';

  const history = [...store.history].reverse().slice(0, 12);
  $("#historyList").innerHTML = history.length ? history.map((item) => {
    const level = item.score < 40 ? " low" : item.score < 80 ? " medium" : "";
    return '<div class="history-item"><div><strong>' + escapeHtml(item.title) + '</strong><span>' +
      item.date + " · " + escapeHtml(subjectShort(item.subject)) + " · " + (item.kind === "review" ? "复习" : "新学") +
      '</span></div><strong class="score-chip' + level + '">' + item.score + '%</strong></div>';
  }).join("") : '<div class="empty-list">完成第一项小测后，这里会出现记录。</div>';
}

function renderDueBadge() {
  const count = Planner.duePoints(store, todayKey).length;
  $("#dueBadge").textContent = count;
  $("#dueBadge").classList.toggle("hidden", count === 0);
}

function renderProgress() {
  const stats = Planner.stats(store, todayKey);
  $("#metricGrid").innerHTML = [
    ["已开始", stats.started, "个知识点"],
    ["稳定掌握", stats.mastered, "需连续两次通过"],
    ["到期复习", stats.due, "项"],
    ["近期正确率", stats.average + "%", "最近 20 次"]
  ].map((metric) => '<article class="metric-card"><span>' + metric[0] + '</span><strong>' + metric[1] +
    '</strong><small>' + metric[2] + '</small></article>').join("");
  $("#activeDayCount").textContent = stats.activeDays + " 天";
  $("#weekTrack").innerHTML = stats.sevenDays.map((day) => {
    const date = new Date(day.key + "T12:00:00");
    const label = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date).replace("周", "");
    const height = day.completed ? Math.max(18, Math.min(100, day.completed * 34)) : 0;
    return '<div class="day-column' + (day.key === todayKey ? " today" : "") + '"><div class="bar-shell" title="' +
      day.completed + ' 项"><span style="height:' + height + '%"></span></div><label>' + label + '</label></div>';
  }).join("");
  $("#mapSummary").textContent = stats.started + " / " + stats.total;

  const subjects = ["全部", "高等数学", "英语", "计算机基础", "大学语文"];
  $("#subjectTabs").innerHTML = subjects.map((subject) => '<button class="' + (selectedSubject === subject ? "active" : "") +
    '" data-action="filter-subject" data-subject="' + subject + '">' + (subject === "全部" ? "全部" : subjectShort(subject)) + '</button>').join("");

  const modules = Planner.modules().filter((module) => selectedSubject === "全部" || module.subject === selectedSubject);
  $("#moduleList").innerHTML = modules.map((module) => {
    const started = module.points.filter((point) => Number(store.progress[point.code]?.attempts || 0) > 0).length;
    const mastered = module.points.filter((point) => Number(store.progress[point.code]?.passes || 0) >= 2).length;
    return '<details class="module-item"><summary><span class="module-code">' + module.id + '</span><div class="module-copy"><strong>' +
      escapeHtml(module.title) + '</strong><span>' + escapeHtml(subjectShort(module.subject)) + " · " + module.points.length +
      ' 个知识点</span></div><span class="module-rate">' + mastered + " / " + module.points.length + '</span></summary>' +
      '<ul class="point-list">' + module.points.map((point) => {
        const progress = store.progress[point.code];
        const state = progress?.passes >= 2 ? "mastered" : progress?.attempts ? "started" : "";
        return '<li class="' + state + '">' + point.code + " " + escapeHtml(point.title) + '</li>';
      }).join("") + '</ul></details>';
  }).join("");
  refreshIcons();
}

function setView(view) {
  if (!["today", "review", "progress"].includes(view)) return;
  activeView = view;
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

async function copySearch(query) {
  try {
    await navigator.clipboard.writeText(query);
    showToast("搜索词已复制");
  } catch {
    const input = document.createElement("textarea");
    input.value = query;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    showToast("搜索词已复制");
  }
}

function exportData() {
  store.preferences.lastBackupAt = new Date().toISOString();
  saveStore();
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "稳步学习-" + todayKey + ".json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $("#dataNote").textContent = "已于 " + new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) + " 导出备份。";
  showToast("学习记录已导出");
}

async function importData(file) {
  try {
    const raw = JSON.parse(await file.text());
    store = Planner.migrateStore(raw, todayKey);
    Planner.ensureDay(store, todayKey);
    saveStore();
    lastResultTaskId = null;
    render();
    showToast("学习记录已导入");
  } catch {
    showToast("文件无法识别，请选择应用导出的 JSON");
  }
}

function updateConnectionState() {
  const state = $("#connectionState");
  const online = navigator.onLine;
  state.classList.toggle("offline", !online);
  state.innerHTML = '<i data-lucide="' + (online ? "wifi" : "wifi-off") + '"></i><span>' + (online ? "在线" : "离线") + "</span>";
  refreshIcons();
}

async function triggerInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $$(".install-trigger").forEach((button) => button.classList.add("hidden"));
    return;
  }
  if ($("#installDialog").showModal) $("#installDialog").showModal();
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view-target]");
  if (viewButton) {
    setView(viewButton.dataset.viewTarget);
    return;
  }
  const modeButton = event.target.closest("[data-mode]");
  if (modeButton) {
    if (Planner.setDayMode(store, todayKey, modeButton.dataset.mode)) {
      saveStore();
      renderToday();
    }
    return;
  }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const type = action.dataset.action;
  if (type === "start-task") {
    Planner.startTask(store, todayKey, action.dataset.taskId);
    saveStore();
    renderToday();
  } else if (type === "start-quiz") {
    Planner.startQuiz(store, todayKey, action.dataset.taskId);
    saveStore();
    renderToday();
  } else if (type === "next-task") {
    lastResultTaskId = null;
    renderToday();
  } else if (type === "copy-search") {
    copySearch(action.dataset.query);
  } else if (type === "queue-review") {
    const added = Planner.queueReviewToday(store, todayKey, action.dataset.code);
    if (added) {
      saveStore();
      showToast("已加入今天的队列");
      renderReview();
    } else {
      showToast("今天的队列里已经有它");
    }
  } else if (type === "filter-subject") {
    selectedSubject = action.dataset.subject;
    renderProgress();
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "quizForm") return;
  event.preventDefault();
  submitQuiz(event.target);
});

$("#rescueMode").addEventListener("click", () => {
  if (Planner.setDayMode(store, todayKey, "rescue")) {
    saveStore();
    renderToday();
    showToast("今天只做 5 分钟");
  }
});
$("#exportData").addEventListener("click", exportData);
$("#importData").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importData(file);
  event.target.value = "";
});
$$(".install-trigger").forEach((button) => button.addEventListener("click", triggerInstall));
$("#closeInstallDialog").addEventListener("click", () => $("#installDialog").close());
$("#confirmInstallHelp").addEventListener("click", () => $("#installDialog").close());

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $$(".install-trigger").forEach((button) => button.classList.remove("hidden"));
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  $$(".install-trigger").forEach((button) => button.classList.add("hidden"));
  showToast("已安装到手机桌面");
});
window.addEventListener("online", updateConnectionState);
window.addEventListener("offline", updateConnectionState);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && activeView === "today") renderToday();
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

updateConnectionState();
render();
