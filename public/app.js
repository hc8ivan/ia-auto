const SESSION_KEY = "la-terraz-assistant-session";
const THEME_KEY = "lt-theme";

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
    applyShareMeta(site);
  } catch {
    document.getElementById("chip-lunch").textContent = "—";
    document.getElementById("chip-dinner").textContent = "—";
    document.getElementById("chip-tables").textContent = "—";
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
    el.textContent = `La Terraza: ${t}`;
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

themeToggleBtn?.addEventListener("click", toggleTheme);
newChatBtn?.addEventListener("click", () => resetConversation());

inputEl.addEventListener("input", updateCounter);
updateCounter();

inputEl.addEventListener("keydown", (e) => {
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
