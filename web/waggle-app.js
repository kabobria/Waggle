/**
 * Waggle app controller — shared by the web build and the Electron desktop
 * build (loaded as a plain script, no bundler). Talks to WaggleStorage for
 * persistence, WaggleCountdown for timing, and WaggleAudio for alerts.
 */

const RING_CIRCUMFERENCE = 678.58; // 2 * PI * 108, matches styles.css

const DEFAULT_SETTINGS = {
  prepSeconds: 30,
  speakSeconds: 120,
  categoryEnabled: Object.fromEntries(
    Object.keys(WAGGLE_TOPICS).map((cat) => [cat, true])
  )
};

let settings = { ...DEFAULT_SETTINGS, categoryEnabled: { ...DEFAULT_SETTINGS.categoryEnabled } };
let currentScreen = "home";
let participantIdCounter = 0;

const solo = {
  topic: null,
  phase: "setup", // setup | prep | prepDone | speak | done
  rating: null, // "up" | "down" | null
  timer: null
};

const group = {
  participants: [],
  order: [],
  currentIndex: 0,
  round: 1,
  active: false,
  currentTopic: null,
  turnPhase: "pre", // pre | prep | prepDone | speak
  stats: {}, // { [participantId]: { up, down } } cumulative across the whole session
  roundStats: {}, // { [participantId]: { up, down } } current round only
  timer: null
};

const TROPHY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>';

// ---------- DOM refs ----------

const el = (id) => document.getElementById(id);

const btnSettings = el("btn-settings");
const btnSolo = el("btn-solo");
const btnGroup = el("btn-group");

const soloSetup = el("solo-setup");
const soloCategoriesEl = el("solo-categories");
const soloSelectAllBtn = el("solo-select-all");
const soloClearAllBtn = el("solo-clear-all");
const soloNoCategoriesHint = el("solo-no-categories-hint");
const soloTopicText = el("solo-topic-text");
const soloGenerateBtn = el("solo-generate");
const soloStartBtn = el("solo-start");
const soloTimerView = el("solo-timer-view");
const soloPhaseLabel = el("solo-phase-label");
const soloRingProgress = el("solo-ring-progress");
const soloTimeEl = el("solo-time");
const soloTopicReminder = el("solo-topic-reminder");
const soloPauseBtn = el("solo-pause");
const soloResetBtn = el("solo-reset");
const soloEndBtn = el("solo-end");
const soloPrepDoneView = el("solo-prep-done-view");
const soloPrepDoneTopic = el("solo-prep-done-topic");
const soloBeginSpeakBtn = el("solo-begin-speak");
const soloPrepDoneEndBtn = el("solo-prep-done-end");
const soloDoneView = el("solo-done-view");
const soloDoneTopic = el("solo-done-topic");
const soloRateUpBtn = el("solo-rate-up");
const soloRateDownBtn = el("solo-rate-down");
const soloAgainBtn = el("solo-again");

const groupCategoriesEl = el("group-categories");
const groupSelectAllBtn = el("group-select-all");
const groupClearAllBtn = el("group-clear-all");
const groupAddForm = el("group-add-form");
const groupNameInput = el("group-name-input");
const participantListEl = el("group-participant-list");
const groupEmptyHint = el("group-empty-hint");
const groupNoCategoriesHint = el("group-no-categories-hint");
const groupStartBtn = el("group-start");
const groupSetup = el("group-setup");
const groupSessionView = el("group-session-view");
const groupUpNowBlock = el("group-up-now-block");
const groupCurrentName = el("group-current-name");
const groupPreTurn = el("group-pre-turn");
const groupTopicText = el("group-topic-text");
const groupTurnStartBtn = el("group-turn-start");
const groupSkipBtn = el("group-skip");
const groupPrepDoneView = el("group-prep-done-view");
const groupPrepDoneTopic = el("group-prep-done-topic");
const groupBeginSpeakBtn = el("group-begin-speak");
const groupTimerView = el("group-timer-view");
const groupPhaseLabel = el("group-phase-label");
const groupRingProgress = el("group-ring-progress");
const groupTimeEl = el("group-time");
const groupTopicReminder = el("group-topic-reminder");
const groupPauseBtn = el("group-pause");
const groupResetBtn = el("group-reset");
const groupNextView = el("group-next-view");
const groupTurnDoneName = el("group-turn-done-name");
const groupRateUpBtn = el("group-rate-up");
const groupRateDownBtn = el("group-rate-down");
const groupRateUpCountEl = el("group-rate-up-count");
const groupRateDownCountEl = el("group-rate-down-count");
const groupNextBtn = el("group-next");
const groupRoundEndView = el("group-round-end-view");
const groupRoundLabel = el("group-round-label");
const groupRoundWinnerIcon = el("group-round-winner-icon");
const groupRoundWinnerName = el("group-round-winner-name");
const groupRoundLeaderboard = el("group-round-leaderboard");
const groupAgainBtn = el("group-again");
const groupEndBtn = el("group-end");
const groupSummaryView = el("group-summary-view");
const groupSummaryWinnerIcon = el("group-summary-winner-icon");
const groupSummaryWinnerName = el("group-summary-winner-name");
const groupSummaryLeaderboard = el("group-summary-leaderboard");
const groupSummaryDoneBtn = el("group-summary-done");

const prepMinInput = el("settings-prep-min");
const prepSecInput = el("settings-prep-sec");
const speakMinInput = el("settings-speak-min");
const speakSecInput = el("settings-speak-sec");
const settingsCategoriesEl = el("settings-categories");

const modalScrim = el("confirm-modal");
const modalTitleEl = el("confirm-title");
const modalBodyEl = el("confirm-body");
const confirmOkBtn = el("confirm-ok");
const confirmCancelBtn = el("confirm-cancel");

const ROW_ICONS = {
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"></path><path d="M5 12l7-7 7 7"></path></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"></path><path d="M19 12l-7 7-7-7"></path></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>'
};
const ROW_LABELS = { up: "Move up", down: "Move down", trash: "Remove" };

// ---------- Helpers ----------

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
}

function getEnabledCategories() {
  return Object.keys(WAGGLE_TOPICS).filter((cat) => settings.categoryEnabled[cat]);
}

function pickRandomTopic(excludeText) {
  const cats = getEnabledCategories();
  let pool = [];
  cats.forEach((cat) => {
    WAGGLE_TOPICS[cat].forEach((topic) => pool.push(topic));
  });
  if (excludeText && pool.length > 1) {
    pool = pool.filter((t) => t !== excludeText);
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function persistSettings() {
  WaggleStorage.save(settings);
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => {
    const isActive = s.id === "screen-" + name;
    s.classList.toggle("active", isActive);
    s.toggleAttribute("inert", !isActive);
    s.setAttribute("aria-hidden", String(!isActive));
  });
  currentScreen = name;
}

function goHome() {
  showScreen("home");
}

function confirmAction({ title, body, confirmLabel = "Leave" }) {
  return new Promise((resolve) => {
    modalTitleEl.textContent = title;
    modalBodyEl.textContent = body;
    confirmOkBtn.textContent = confirmLabel;
    modalScrim.hidden = false;
    confirmCancelBtn.focus();

    function cleanup(result) {
      modalScrim.hidden = true;
      confirmOkBtn.removeEventListener("click", onOk);
      confirmCancelBtn.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    }
    function onOk() {
      cleanup(true);
    }
    function onCancel() {
      cleanup(false);
    }
    function onKeydown(e) {
      if (e.key === "Escape") cleanup(false);
    }

    confirmOkBtn.addEventListener("click", onOk);
    confirmCancelBtn.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKeydown);
  });
}

function isSoloSessionActive() {
  return solo.phase === "prep" || solo.phase === "prepDone" || solo.phase === "speak";
}

function isGroupSessionActive() {
  return group.active;
}

async function handleBack() {
  if (currentScreen === "solo" && isSoloSessionActive()) {
    const ok = await confirmAction({
      title: "Leave Solo?",
      body: "Your timer is running. Going back will end it."
    });
    if (!ok) return;
    endSoloTimer();
  }
  if (currentScreen === "group") {
    if (isGroupSessionActive()) {
      const ok = await confirmAction({
        title: "Leave this session?",
        body: "Your group session is in progress. Going back will end it."
      });
      if (!ok) return;
      abandonGroupSession();
    } else if (!groupSummaryView.hidden) {
      // Session already ended, just viewing results — nothing to lose, no confirmation needed.
      finishGroupSession();
    }
  }
  goHome();
}

// ---------- Category rendering (shared state, used by Solo + Settings) ----------

function renderChipsInto(container) {
  container.innerHTML = "";
  Object.keys(WAGGLE_TOPICS).forEach((cat) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.setAttribute("aria-pressed", String(!!settings.categoryEnabled[cat]));
    chip.textContent = cat;
    chip.addEventListener("click", () => {
      settings.categoryEnabled[cat] = !settings.categoryEnabled[cat];
      persistSettings();
      refreshAllCategoryUI();
    });
    container.appendChild(chip);
  });
}

function renderCategoryChips() {
  renderChipsInto(soloCategoriesEl);
  renderChipsInto(groupCategoriesEl);
}

function renderSettingsCategories() {
  settingsCategoriesEl.innerHTML = "";
  Object.entries(WAGGLE_TOPICS).forEach(([cat, topics]) => {
    const row = document.createElement("div");
    row.className = "category-row";

    const header = document.createElement("div");
    header.className = "category-row__header";

    const name = document.createElement("span");
    name.className = "category-row__name";
    name.textContent = cat;

    const count = document.createElement("span");
    count.className = "category-row__count";
    count.textContent = topics.length + " topics";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "toggle";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", String(!!settings.categoryEnabled[cat]));
    toggle.setAttribute("aria-label", "Toggle " + cat);
    toggle.addEventListener("click", () => {
      settings.categoryEnabled[cat] = !settings.categoryEnabled[cat];
      persistSettings();
      refreshAllCategoryUI();
    });

    header.append(name, count, toggle);

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.className = "text-btn";
    summary.textContent = "View topics";
    const list = document.createElement("p");
    list.className = "category-row__topics";
    list.textContent = topics.join(" • ");
    details.append(summary, list);

    row.append(header, details);
    settingsCategoriesEl.appendChild(row);
  });
}

function updateSoloAvailability() {
  const enabled = getEnabledCategories().length > 0;
  soloGenerateBtn.disabled = !enabled;
  soloNoCategoriesHint.hidden = enabled;
}

function updateGroupAvailability() {
  const hasParticipants = group.participants.length > 0;
  const hasCategories = getEnabledCategories().length > 0;
  groupStartBtn.disabled = !(hasParticipants && hasCategories);
  groupNoCategoriesHint.hidden = hasCategories;
}

function refreshAllCategoryUI() {
  renderCategoryChips();
  renderSettingsCategories();
  updateSoloAvailability();
  updateGroupAvailability();
}

// ---------- Settings: duration inputs ----------

function secondsToParts(totalSeconds) {
  return { min: Math.floor(totalSeconds / 60), sec: totalSeconds % 60 };
}

function clampNum(value, min, max) {
  let v = parseInt(value, 10);
  if (Number.isNaN(v)) v = min;
  return Math.min(max, Math.max(min, v));
}

function syncDurationInputs() {
  const prep = secondsToParts(settings.prepSeconds);
  const speak = secondsToParts(settings.speakSeconds);
  prepMinInput.value = prep.min;
  prepSecInput.value = prep.sec;
  speakMinInput.value = speak.min;
  speakSecInput.value = speak.sec;
}

function onDurationInputChange() {
  const prepMin = clampNum(prepMinInput.value, 0, 59);
  const prepSec = clampNum(prepSecInput.value, 0, 59);
  const speakMin = clampNum(speakMinInput.value, 0, 59);
  const speakSec = clampNum(speakSecInput.value, 0, 59);

  settings.prepSeconds = Math.max(0, prepMin * 60 + prepSec);
  settings.speakSeconds = Math.max(5, speakMin * 60 + speakSec);

  persistSettings();
  syncDurationInputs();
}

// ---------- Solo mode ----------

function updateSoloRing(remaining, total) {
  soloTimeEl.textContent = formatTime(remaining);
  const ratio = total > 0 ? remaining / total : 0;
  soloRingProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - ratio));
}

function onSoloTimerComplete() {
  if (solo.phase === "prep") {
    WaggleAudio.playPrepEnd();
    showSoloPrepDone();
  } else if (solo.phase === "speak") {
    WaggleAudio.playSpeakEnd();
    showSoloDone();
  }
}

function showSoloPrepDone() {
  solo.phase = "prepDone";
  soloTimerView.hidden = true;
  soloPrepDoneView.hidden = false;
  soloPrepDoneTopic.textContent = solo.topic;
}

function beginSoloSpeakPhase() {
  WaggleAudio.unlock();
  solo.phase = "speak";
  soloPrepDoneView.hidden = true;
  soloTimerView.hidden = false;
  soloPhaseLabel.textContent = "Speak now";
  soloPauseBtn.textContent = "Pause";
  solo.timer.configure(settings.speakSeconds);
  solo.timer.start();
}

function generateSoloTopic() {
  const topic = pickRandomTopic(solo.topic);
  if (!topic) return;
  solo.topic = topic;
  soloTopicText.textContent = topic;
  soloGenerateBtn.textContent = "Generate another";
  soloStartBtn.hidden = false;
}

function startSoloFlow() {
  if (!solo.topic) return;
  WaggleAudio.unlock();
  soloSetup.hidden = true;
  soloDoneView.hidden = true;
  soloTimerView.hidden = false;
  soloPauseBtn.textContent = "Pause";

  if (settings.prepSeconds > 0) {
    solo.phase = "prep";
    soloPhaseLabel.textContent = "Get ready";
    solo.timer.configure(settings.prepSeconds);
  } else {
    solo.phase = "speak";
    soloPhaseLabel.textContent = "Speak now";
    solo.timer.configure(settings.speakSeconds);
  }
  soloTopicReminder.textContent = solo.topic;
  solo.timer.start();
}

function pauseResumeSolo() {
  if (solo.timer.state === "running") {
    solo.timer.pause();
    soloPauseBtn.textContent = "Resume";
  } else if (solo.timer.state === "paused") {
    solo.timer.resume();
    soloPauseBtn.textContent = "Pause";
  }
}

function resetSoloTimer() {
  const total = solo.phase === "speak" ? settings.speakSeconds : settings.prepSeconds;
  solo.timer.reset(total);
  solo.timer.start();
  soloPauseBtn.textContent = "Pause";
}

function showSoloDone() {
  solo.phase = "done";
  soloTimerView.hidden = true;
  soloDoneView.hidden = false;
  soloDoneTopic.textContent = solo.topic;
  resetSoloRating();
}

function resetSoloRating() {
  solo.rating = null;
  soloRateUpBtn.setAttribute("aria-pressed", "false");
  soloRateDownBtn.setAttribute("aria-pressed", "false");
}

function setSoloRating(value) {
  solo.rating = solo.rating === value ? null : value;
  soloRateUpBtn.setAttribute("aria-pressed", String(solo.rating === "up"));
  soloRateDownBtn.setAttribute("aria-pressed", String(solo.rating === "down"));
}

function endSoloTimer() {
  if (solo.timer) solo.timer.stop();
  solo.phase = "setup";
  soloTimerView.hidden = true;
  soloPrepDoneView.hidden = true;
  soloDoneView.hidden = true;
  soloSetup.hidden = false;
}

function soloBackToSetup() {
  solo.phase = "setup";
  solo.topic = null;
  soloPrepDoneView.hidden = true;
  soloDoneView.hidden = true;
  soloTimerView.hidden = true;
  soloSetup.hidden = false;
  soloTopicText.textContent = "Generate a topic to get started.";
  soloGenerateBtn.textContent = "Generate topic";
  soloStartBtn.hidden = true;
}

// ---------- Group mode: participants ----------

function makeRowIconBtn(kind, onClick, danger) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "row-icon-btn" + (danger ? " row-icon-btn--danger" : "");
  btn.innerHTML = ROW_ICONS[kind];
  btn.setAttribute("aria-label", ROW_LABELS[kind]);
  btn.addEventListener("click", onClick);
  return btn;
}

function renderParticipantList() {
  participantListEl.innerHTML = "";
  group.participants.forEach((p, idx) => {
    const li = document.createElement("li");
    li.className = "participant-row";

    const name = document.createElement("span");
    name.className = "participant-row__name";
    name.textContent = p.name;

    const actions = document.createElement("div");
    actions.className = "participant-row__actions";

    const upBtn = makeRowIconBtn("up", () => moveParticipant(p.id, -1));
    upBtn.disabled = idx === 0;
    const downBtn = makeRowIconBtn("down", () => moveParticipant(p.id, 1));
    downBtn.disabled = idx === group.participants.length - 1;
    const removeBtn = makeRowIconBtn("trash", () => removeParticipant(p.id), true);

    actions.append(upBtn, downBtn, removeBtn);
    li.append(name, actions);
    participantListEl.appendChild(li);
  });
  groupEmptyHint.hidden = group.participants.length > 0;
}

function addParticipant(rawName) {
  const name = rawName.trim();
  if (!name) return;
  group.participants.push({ id: ++participantIdCounter, name });
  renderParticipantList();
  updateGroupAvailability();
}

function removeParticipant(id) {
  group.participants = group.participants.filter((p) => p.id !== id);
  renderParticipantList();
  updateGroupAvailability();
}

function moveParticipant(id, direction) {
  const idx = group.participants.findIndex((p) => p.id === id);
  const newIdx = idx + direction;
  if (idx === -1 || newIdx < 0 || newIdx >= group.participants.length) return;
  const [item] = group.participants.splice(idx, 1);
  group.participants.splice(newIdx, 0, item);
  renderParticipantList();
}

// ---------- Group mode: ranking ----------

function ensureStatsEntry(store, id) {
  if (!store[id]) store[id] = { up: 0, down: 0 };
  return store[id];
}

function resetRoundStats() {
  group.roundStats = {};
  group.order.forEach((p) => ensureStatsEntry(group.roundStats, p.id));
}

function buildLeaderboard(roster, statsStore) {
  return roster
    .map((p, idx) => {
      const s = statsStore[p.id] || { up: 0, down: 0 };
      return { id: p.id, name: p.name, up: s.up, down: s.down, net: s.up - s.down, idx };
    })
    .sort((a, b) => b.net - a.net || b.up - a.up || a.idx - b.idx);
}

// Names of whoever is tied for the top score, or null if everyone is tied (no clear leader).
function leaderNames(entries) {
  if (entries.length === 0) return null;
  if (entries.length === 1) return entries[0].name;
  const topScore = entries[0].net;
  const leaders = entries.filter((e) => e.net === topScore);
  if (leaders.length === entries.length) return null;
  return leaders.map((e) => e.name).join(" & ");
}

function renderLeaderboard(container, entries) {
  container.innerHTML = "";
  if (entries.length === 0) return;
  const topScore = entries[0].net;
  entries.forEach((entry, i) => {
    const isLeader = entry.net === topScore;
    const row = document.createElement("div");
    row.className = "leaderboard-row" + (isLeader ? " leaderboard-row--leader" : "");
    row.setAttribute("role", "listitem");

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    if (isLeader) {
      rank.innerHTML = TROPHY_ICON;
    } else {
      rank.textContent = String(i + 1);
    }

    const info = document.createElement("div");
    info.className = "leaderboard-info";
    const name = document.createElement("span");
    name.className = "leaderboard-name";
    name.textContent = entry.name;
    const detail = document.createElement("span");
    detail.className = "leaderboard-detail";
    detail.textContent = entry.up + " up · " + entry.down + " down";
    info.append(name, detail);

    const score = document.createElement("span");
    score.className = "leaderboard-score";
    score.textContent = (entry.net > 0 ? "+" : "") + entry.net;

    row.append(rank, info, score);
    container.appendChild(row);
  });
}

// ---------- Group mode: session ----------

function showGroupSubview(name) {
  groupPreTurn.hidden = name !== "pre";
  groupPrepDoneView.hidden = name !== "prepDone";
  groupTimerView.hidden = name !== "timer";
  groupNextView.hidden = name !== "next";
  groupRoundEndView.hidden = name !== "roundEnd";
  groupSummaryView.hidden = name !== "summary";
  groupUpNowBlock.hidden = name === "roundEnd" || name === "summary";
}

function showRoundEnd() {
  groupRoundLabel.textContent = "Round " + group.round + " complete";

  const roundEntries = buildLeaderboard(group.order, group.roundStats);
  const roundWinnerNames = leaderNames(roundEntries);
  groupRoundWinnerIcon.hidden = !roundWinnerNames;
  groupRoundWinnerName.textContent = roundWinnerNames
    ? roundWinnerNames + " won this round"
    : "This round was a tie";

  const overallEntries = buildLeaderboard(group.order, group.stats);
  renderLeaderboard(groupRoundLeaderboard, overallEntries);

  showGroupSubview("roundEnd");
}

function beginTurn() {
  if (group.currentIndex >= group.order.length) {
    showRoundEnd();
    return;
  }
  const participant = group.order[group.currentIndex];
  groupCurrentName.textContent = participant.name;
  group.currentTopic = pickRandomTopic();
  groupTopicText.textContent =
    group.currentTopic || "No topics available. Enable a category in Settings.";
  groupTurnStartBtn.disabled = !group.currentTopic;
  showGroupSubview("pre");
}

function updateGroupRing(remaining, total) {
  groupTimeEl.textContent = formatTime(remaining);
  const ratio = total > 0 ? remaining / total : 0;
  groupRingProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - ratio));
}

function onGroupTimerComplete() {
  if (group.turnPhase === "prep") {
    WaggleAudio.playPrepEnd();
    group.turnPhase = "prepDone";
    groupPrepDoneTopic.textContent = group.currentTopic;
    showGroupSubview("prepDone");
  } else if (group.turnPhase === "speak") {
    WaggleAudio.playSpeakEnd();
    const participant = group.order[group.currentIndex];
    groupTurnDoneName.textContent = participant.name + " is done.";
    showCurrentRatingCounts();
    showGroupSubview("next");
  }
}

function beginGroupSpeakPhase() {
  WaggleAudio.unlock();
  group.turnPhase = "speak";
  groupPhaseLabel.textContent = "Speak now";
  showGroupSubview("timer");
  groupPauseBtn.textContent = "Pause";
  group.timer.configure(settings.speakSeconds);
  group.timer.start();
}

function showCurrentRatingCounts() {
  const id = group.order[group.currentIndex].id;
  const s = ensureStatsEntry(group.roundStats, id);
  groupRateUpCountEl.textContent = String(s.up);
  groupRateDownCountEl.textContent = String(s.down);
}

function startGroupTurnTimer() {
  WaggleAudio.unlock();
  showGroupSubview("timer");
  groupPauseBtn.textContent = "Pause";
  groupTopicReminder.textContent = group.currentTopic;

  if (settings.prepSeconds > 0) {
    group.turnPhase = "prep";
    groupPhaseLabel.textContent = "Get ready";
    group.timer.configure(settings.prepSeconds);
  } else {
    group.turnPhase = "speak";
    groupPhaseLabel.textContent = "Speak now";
    group.timer.configure(settings.speakSeconds);
  }
  group.timer.start();
}

function pauseResumeGroup() {
  if (group.timer.state === "running") {
    group.timer.pause();
    groupPauseBtn.textContent = "Resume";
  } else if (group.timer.state === "paused") {
    group.timer.resume();
    groupPauseBtn.textContent = "Pause";
  }
}

function resetGroupTimer() {
  const total = group.turnPhase === "speak" ? settings.speakSeconds : settings.prepSeconds;
  group.timer.reset(total);
  group.timer.start();
  groupPauseBtn.textContent = "Pause";
}

function skipCurrentParticipant() {
  group.currentIndex += 1;
  beginTurn();
}

function advanceParticipant() {
  group.currentIndex += 1;
  beginTurn();
}

function startAnotherRound() {
  group.round += 1;
  group.currentIndex = 0;
  resetRoundStats();
  beginTurn();
}

function startGroupSession() {
  group.order = group.participants.slice();
  group.currentIndex = 0;
  group.round = 1;
  group.active = true;
  group.stats = {};
  group.order.forEach((p) => ensureStatsEntry(group.stats, p.id));
  resetRoundStats();
  groupSetup.hidden = true;
  groupSessionView.hidden = false;
  beginTurn();
}

function endGroupSession() {
  if (group.timer) group.timer.stop();
  group.active = false;
  showFinalSummary();
}

function showFinalSummary() {
  const entries = buildLeaderboard(group.order, group.stats);
  const winnerNames = leaderNames(entries);
  groupSummaryWinnerIcon.hidden = !winnerNames;
  groupSummaryWinnerName.textContent = winnerNames ? winnerNames + " had the most" : "Nobody edged out — it's a tie";
  renderLeaderboard(groupSummaryLeaderboard, entries);
  showGroupSubview("summary");
}

// Returns Group to its setup screen (same roster, ready for a new session).
// Used by the summary screen's "Done" button and by the silent back-navigation
// path once a session has already ended (no confirmation needed there).
function finishGroupSession() {
  group.currentIndex = 0;
  group.round = 1;
  groupSessionView.hidden = true;
  groupSetup.hidden = false;
  updateGroupAvailability();
}

function abandonGroupSession() {
  if (group.timer) group.timer.stop();
  group.active = false;
  finishGroupSession();
}

// ---------- Wiring ----------

function wireEvents() {
  btnSettings.addEventListener("click", () => showScreen("settings"));
  btnSolo.addEventListener("click", () => showScreen("solo"));
  btnGroup.addEventListener("click", () => showScreen("group"));
  document.querySelectorAll('[data-back="home"]').forEach((btn) =>
    btn.addEventListener("click", handleBack)
  );

  // Solo
  soloSelectAllBtn.addEventListener("click", () => {
    Object.keys(WAGGLE_TOPICS).forEach((c) => (settings.categoryEnabled[c] = true));
    persistSettings();
    refreshAllCategoryUI();
  });
  soloClearAllBtn.addEventListener("click", () => {
    Object.keys(WAGGLE_TOPICS).forEach((c) => (settings.categoryEnabled[c] = false));
    persistSettings();
    refreshAllCategoryUI();
  });
  soloGenerateBtn.addEventListener("click", generateSoloTopic);
  soloStartBtn.addEventListener("click", startSoloFlow);
  soloPauseBtn.addEventListener("click", pauseResumeSolo);
  soloResetBtn.addEventListener("click", resetSoloTimer);
  soloEndBtn.addEventListener("click", endSoloTimer);
  soloBeginSpeakBtn.addEventListener("click", beginSoloSpeakPhase);
  soloPrepDoneEndBtn.addEventListener("click", endSoloTimer);
  soloRateUpBtn.addEventListener("click", () => setSoloRating("up"));
  soloRateDownBtn.addEventListener("click", () => setSoloRating("down"));
  soloAgainBtn.addEventListener("click", soloBackToSetup);

  // Group setup
  groupSelectAllBtn.addEventListener("click", () => {
    Object.keys(WAGGLE_TOPICS).forEach((c) => (settings.categoryEnabled[c] = true));
    persistSettings();
    refreshAllCategoryUI();
  });
  groupClearAllBtn.addEventListener("click", () => {
    Object.keys(WAGGLE_TOPICS).forEach((c) => (settings.categoryEnabled[c] = false));
    persistSettings();
    refreshAllCategoryUI();
  });
  groupAddForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addParticipant(groupNameInput.value);
    groupNameInput.value = "";
    groupNameInput.focus();
  });
  groupStartBtn.addEventListener("click", startGroupSession);

  // Group session
  groupTurnStartBtn.addEventListener("click", startGroupTurnTimer);
  groupSkipBtn.addEventListener("click", skipCurrentParticipant);
  groupBeginSpeakBtn.addEventListener("click", beginGroupSpeakPhase);
  groupPauseBtn.addEventListener("click", pauseResumeGroup);
  groupResetBtn.addEventListener("click", resetGroupTimer);
  groupRateUpBtn.addEventListener("click", () => {
    const id = group.order[group.currentIndex].id;
    ensureStatsEntry(group.roundStats, id).up += 1;
    ensureStatsEntry(group.stats, id).up += 1;
    groupRateUpCountEl.textContent = String(group.roundStats[id].up);
  });
  groupRateDownBtn.addEventListener("click", () => {
    const id = group.order[group.currentIndex].id;
    ensureStatsEntry(group.roundStats, id).down += 1;
    ensureStatsEntry(group.stats, id).down += 1;
    groupRateDownCountEl.textContent = String(group.roundStats[id].down);
  });
  groupNextBtn.addEventListener("click", advanceParticipant);
  groupAgainBtn.addEventListener("click", startAnotherRound);
  groupEndBtn.addEventListener("click", endGroupSession);
  groupSummaryDoneBtn.addEventListener("click", finishGroupSession);

  // Settings
  [prepMinInput, prepSecInput, speakMinInput, speakSecInput].forEach((input) =>
    input.addEventListener("change", onDurationInputChange)
  );
}

async function init() {
  const loaded = await WaggleStorage.load(DEFAULT_SETTINGS);
  settings = {
    ...DEFAULT_SETTINGS,
    ...loaded,
    categoryEnabled: { ...DEFAULT_SETTINGS.categoryEnabled, ...(loaded.categoryEnabled || {}) }
  };

  solo.timer = new WaggleCountdown({ onTick: updateSoloRing, onComplete: onSoloTimerComplete });
  group.timer = new WaggleCountdown({ onTick: updateGroupRing, onComplete: onGroupTimerComplete });

  syncDurationInputs();
  refreshAllCategoryUI();
  renderParticipantList();
  updateGroupAvailability();
  wireEvents();
  showScreen("home");
}

document.addEventListener("DOMContentLoaded", init);
