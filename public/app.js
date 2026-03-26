const SESSION_KEY = "reserva-flow-session";
const THEME_KEY = "lt-theme";
const APP_NAME = "ReservaFlow";

const messagesEl = document.getElementById("messages");
const messagesSkeletonEl = document.getElementById("messages-skeleton");
const emptyTemplate = document.getElementById("tpl-empty");
const formEl = document.getElementById("form");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send");
const statusEl = document.getElementById("status");
const typingEl = document.getElementById("typing");
const counterEl = document.getElementById("counter");
const themeToggleBtn = document.getElementById("theme-toggle");
const newChatBtn = document.getElementById("btn-new-chat");
const quickDateEl = document.getElementById("quick-date");
const quickPartyEl = document.getElementById("quick-party");
const quickRefreshEl = document.getElementById("quick-refresh");
const quickSlotsEl = document.getElementById("quick-slots");
const quickToggleBtn = document.getElementById("btn-quick-toggle");
const quickDrawerEl = document.getElementById("quick-drawer");
const quickBackdropEl = document.getElementById("quick-backdrop");
const quickCloseBtn = document.getElementById("btn-quick-close");
const heroNameEl = document.getElementById("hero-name");
const typingLabelEl = document.getElementById("typing-label");

const MAX_LEN = 2000;

/** @type {string | null} */
let sessionId = localStorage.getItem(SESSION_KEY);

function setSession(nextId) {
  sessionId = nextId;
  if (nextId) {
    localStorage.setItem(SESSION_KEY, nextId);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function syncMetaTheme() {
  const el = document.getElementById("meta-theme-color");
  if (!el) return;
  el.content =
    document.documentElement.dataset.theme === "light" ? "#f2efe8" : "#0a0b0d";
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    document.documentElement.dataset.theme = stored;
  } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    document.documentElement.dataset.theme = "light";
  } else {
    document.documentElement.dataset.theme = "dark";
  }
  syncMetaTheme();
}

function toggleTheme() {
  const next =
    document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  syncMetaTheme();
}

function applyScheduleToChips(data) {
  if (!data || typeof data !== "object") return;
  const days = Array.isArray(data.days) ? data.days : [];
  const day = days[0];
  const cap =
    data.capacity && typeof data.capacity === "object" ? data.capacity : null;
  const lunchEl = document.getElementById("chip-lunch");
  const dinnerEl = document.getElementById("chip-dinner");
  const tablesEl = document.getElementById("chip-tables");
  if (tablesEl && cap && typeof cap.tables === "number") {
    tablesEl.textContent = `${cap.tables} mesas`;
  }
  if (!day || typeof day !== "object") return;
  if (day.status === "closed") {
    if (lunchEl) lunchEl.textContent = "Cerrado hoy";
    if (dinnerEl) dinnerEl.textContent = "—";
  } else {
    if (lunchEl) lunchEl.textContent = day.lunch || "—";
    if (dinnerEl) dinnerEl.textContent = day.dinner || "—";
  }
}

/**
 * @param {{ publicBaseUrl?: string | null } | null | undefined} site
 */
function applyShareMeta(site) {
  const baseRaw = site?.publicBaseUrl?.trim() || window.location.origin;
  const base = baseRaw.replace(/\/$/, "");
  const ogUrl = document.getElementById("meta-og-url");
  const ogImage = document.getElementById("meta-og-image");
  ogUrl?.setAttribute("content", `${base}/`);
  ogImage?.setAttribute("content", `${base}/favicon.svg`);
}

async function loadScheduleForHero() {
  try {
    const res = await fetch("/api/schedule?days=1", {
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return;
    applyScheduleToChips(data);
    const site =
      data.site && typeof data.site === "object" ? data.site : null;
    if (heroNameEl) {
      heroNameEl.textContent =
        typeof site?.name === "string" && site.name.trim().length > 0
          ? site.name.trim()
          : APP_NAME;
    }
    if (typingLabelEl) {
      typingLabelEl.textContent = `${heroNameEl?.textContent || APP_NAME} está escribiendo`;
    }
    applyShareMeta(site);
  } catch {
    document.getElementById("chip-lunch").textContent = "—";
    document.getElementById("chip-dinner").textContent = "—";
    document.getElementById("chip-tables").textContent = "—";
    if (heroNameEl) heroNameEl.textContent = APP_NAME;
    if (typingLabelEl) typingLabelEl.textContent = `${APP_NAME} está escribiendo`;
    applyShareMeta(null);
  }
}

function mountEmptyState() {
  if (!emptyTemplate) return;
  const frag = emptyTemplate.content.cloneNode(true);
  const root = frag.querySelector("[data-empty-root]");
  if (root) {
    root.id = "empty";
    messagesEl.appendChild(root);
  }
}

function resetConversation() {
  setSession(null);
  messagesEl.replaceChildren();
  mountEmptyState();
  setStatus("");
  inputEl.focus();
}

function hideEmptyIfNeeded() {
  const el = document.getElementById("empty");
  if (el?.isConnected) {
    el.remove();
  }
}

/**
 * @param {string} text
 */
function announceForA11y(text) {
  const el = document.getElementById("a11y-announcer");
  if (!el) return;
  const t = text.length > 280 ? `${text.slice(0, 280)}…` : text;
  el.textContent = "";
  requestAnimationFrame(() => {
    el.textContent = `${heroNameEl?.textContent || APP_NAME}: ${t}`;
  });
}

function appendMessage(role, text) {
  hideEmptyIfNeeded();

  const row = document.createElement("div");
  row.className = `row row--${role === "user" ? "user" : "bot"}`;

  const avatar = document.createElement("span");
  avatar.className = `avatar avatar--${role === "user" ? "user" : "bot"}`;
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "user" ? "Tú" : "LT";

  const bubble = document.createElement("div");
  bubble.className = `bubble bubble--${role === "user" ? "user" : "bot"}`;
  bubble.textContent = text;
  if (role === "bot") {
    bubble.setAttribute("role", "article");
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);

  messagesEl.scrollTop = messagesEl.scrollHeight;

  if (role === "bot") {
    announceForA11y(text);
  }
}

function setTyping(visible) {
  typingEl.hidden = !visible;
  if (visible) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

/**
 * @param {string} text
 * @param {boolean} isError
 */
function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.classList.toggle("foot-note--error", Boolean(isError));
}

function updateCounter() {
  const n = inputEl.value.length;
  counterEl.textContent = `${n} / ${MAX_LEN}`;
}

function setQuickDrawer(open) {
  if (!quickDrawerEl || !quickBackdropEl || !quickToggleBtn) return;
  quickDrawerEl.hidden = !open;
  quickBackdropEl.hidden = !open;
  quickToggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
}

function todayYmdLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tableIcons(freeTables, totalTables) {
  const visible = Math.max(0, Math.min(8, Number(freeTables) || 0));
  const icons = "🍽️".repeat(visible);
  const extra = (Number(freeTables) || 0) > 8 ? ` +${(Number(freeTables) || 0) - 8}` : "";
  return `${icons}${extra} / ${totalTables}`;
}

function slotButtonLabel(slot, mealLabel) {
  return `
    <span>${slot.time}</span>
    <span class="quick-slot__meal">${mealLabel}</span>
    <span class="quick-slot__tables">${tableIcons(slot.freeTables, slot.totalTables)}</span>
  `;
}

async function loadQuickAvailability() {
  const date = quickDateEl?.value;
  if (!date || !quickSlotsEl) return;
  quickSlotsEl.innerHTML = '<p class="quick-reserve__empty">Consultando huecos…</p>';
  try {
    const res = await fetch(`/api/availability?date=${encodeURIComponent(date)}`, {
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.closed) {
      quickSlotsEl.innerHTML = '<p class="quick-reserve__empty">Sin disponibilidad para ese día.</p>';
      return;
    }
    const all = [];
    if (Array.isArray(data?.slots?.lunch)) {
      for (const s of data.slots.lunch) all.push({ ...s, meal: "Comida" });
    }
    if (Array.isArray(data?.slots?.dinner)) {
      for (const s of data.slots.dinner) all.push({ ...s, meal: "Cena" });
    }
    const party = Number(quickPartyEl?.value || "4");
    const seatsPerTable = Number(data?.seatsPerTable || 4);
    const tablesNeeded = Math.max(1, Math.ceil(party / Math.max(1, seatsPerTable)));
    const open = all
      .filter((s) => (Number(s.freeTables) || 0) >= tablesNeeded)
      .slice(0, 10);
    if (open.length === 0) {
      quickSlotsEl.innerHTML = `<p class="quick-reserve__empty">No hay huecos para ${party} personas (necesitan ${tablesNeeded} mesa(s)).</p>`;
      return;
    }
    quickSlotsEl.replaceChildren();
    const hint = document.createElement("p");
    hint.className = "quick-reserve__empty";
    hint.textContent = `Para ${party} personas se requieren ${tablesNeeded} mesa(s).`;
    quickSlotsEl.appendChild(hint);
    for (const slot of open) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quick-slot";
      btn.innerHTML = slotButtonLabel(slot, slot.meal);
      btn.addEventListener("click", () => {
        inputEl.value = `Quiero reservar para ${party} personas el ${date} a las ${slot.time}. Mi nombre es `;
        updateCounter();
        inputEl.focus();
        setQuickDrawer(false);
      });
      quickSlotsEl.appendChild(btn);
    }
  } catch {
    quickSlotsEl.innerHTML = '<p class="quick-reserve__empty">No se pudo cargar disponibilidad.</p>';
  }
}

/**
 * @param {string} url
 * @param {RequestInit} options
 */
async function fetchWithSlowHint(url, options) {
  let slowTimer = window.setTimeout(() => {
    setStatus(
      "El servidor está despertando; en hosting gratuito puede tardar un minuto la primera vez.",
      false,
    );
  }, 5500);
  try {
    return await fetch(url, options);
  } finally {
    window.clearTimeout(slowTimer);
  }
}

async function hydrateSession() {
  if (!sessionId) return;

  if (messagesSkeletonEl) messagesSkeletonEl.hidden = false;
  const clearSlow = () => setStatus("", false);
  try {
    const res = await fetchWithSlowHint(`/api/chat/session/${sessionId}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      clearSlow();
      setSession(null);
      if (res.status !== 404) {
        setStatus(
          typeof data.error === "string"
            ? data.error
            : "No se pudo recuperar la conversación.",
          true,
        );
      }
      return;
    }

    if (!Array.isArray(data.messages)) {
      clearSlow();
      setSession(null);
      return;
    }

    setSession(data.sessionId ?? sessionId);
    for (const m of data.messages) {
      if (m.role === "user" || m.role === "assistant") {
        appendMessage(m.role, m.content);
      }
    }
    clearSlow();
  } catch {
    clearSlow();
    setStatus("Sin conexión al recuperar el historial.", true);
  } finally {
    if (messagesSkeletonEl) messagesSkeletonEl.hidden = true;
  }
}

/**
 * @param {string} text
 */
async function sendMessage(text) {
  const body = sessionId
    ? { message: text, sessionId }
    : { message: text };

  const res = await fetchWithSlowHint("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : "Demasiadas peticiones. Inténtelo en unos minutos.",
      );
    }
    throw new Error(
      typeof data.error === "string" ? data.error : `Error ${res.status}`,
    );
  }
  if (typeof data.reply !== "string") {
    throw new Error("Respuesta inválida del servidor.");
  }
  if (typeof data.sessionId === "string") {
    setSession(data.sessionId);
  }
  return data.reply;
}

initTheme();
applyShareMeta(null);
void loadScheduleForHero();
void hydrateSession();
if (quickDateEl) {
  quickDateEl.value = todayYmdLocal();
  void loadQuickAvailability();
}

themeToggleBtn?.addEventListener("click", toggleTheme);
newChatBtn?.addEventListener("click", () => resetConversation());
quickRefreshEl?.addEventListener("click", () => {
  void loadQuickAvailability();
});
quickToggleBtn?.addEventListener("click", () => {
  const willOpen = quickDrawerEl?.hidden ?? true;
  setQuickDrawer(willOpen);
});
quickCloseBtn?.addEventListener("click", () => setQuickDrawer(false));
quickBackdropEl?.addEventListener("click", () => setQuickDrawer(false));
quickDateEl?.addEventListener("change", () => {
  void loadQuickAvailability();
});
quickPartyEl?.addEventListener("change", () => {
  void loadQuickAvailability();
});

inputEl.addEventListener("input", updateCounter);
updateCounter();

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    setQuickDrawer(false);
  }
  if (e.key !== "Enter" || e.shiftKey) return;
  if (e.isComposing) return;
  e.preventDefault();
  if (sendBtn.disabled) return;
  formEl.requestSubmit();
});

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;

  setStatus("");
  appendMessage("user", text);
  inputEl.value = "";
  updateCounter();

  sendBtn.disabled = true;
  sendBtn.setAttribute("aria-busy", "true");
  setTyping(true);

  try {
    const reply = await sendMessage(text);
    appendMessage("bot", reply);
    setStatus("", false);
    void loadQuickAvailability();
  } catch (err) {
    let msg = err instanceof Error ? err.message : "Error desconocido.";
    if (
      err instanceof TypeError &&
      String(err.message).toLowerCase().includes("fetch")
    ) {
      msg = "Sin conexión con el servidor. Compruebe su red o inténtelo más tarde.";
    }
    setStatus(msg, true);
  } finally {
    setTyping(false);
    sendBtn.removeAttribute("aria-busy");
    sendBtn.disabled = false;
    inputEl.focus();
  }
});
