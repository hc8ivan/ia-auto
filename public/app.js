const SESSION_KEY = "la-terraz-assistant-session";

const messagesEl = document.getElementById("messages");
const emptyEl = document.getElementById("empty");
const formEl = document.getElementById("form");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send");
const statusEl = document.getElementById("status");
const typingEl = document.getElementById("typing");
const counterEl = document.getElementById("counter");

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

function hideEmptyIfNeeded() {
  if (emptyEl && emptyEl.isConnected) {
    emptyEl.remove();
  }
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

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setTyping(visible) {
  typingEl.hidden = !visible;
  if (visible) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.classList.toggle("foot-note--error", Boolean(isError));
}

function updateCounter() {
  const n = inputEl.value.length;
  counterEl.textContent = `${n} / ${MAX_LEN}`;
}

async function hydrateSession() {
  if (!sessionId) return;

  try {
    const res = await fetch(`/api/chat/session/${sessionId}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSession(null);
      if (res.status !== 404) {
        setStatus(
          typeof data.error === "string" ? data.error : "No se pudo recuperar la conversación.",
          true,
        );
      }
      return;
    }

    if (!Array.isArray(data.messages)) {
      setSession(null);
      return;
    }

    setSession(data.sessionId ?? sessionId);
    for (const m of data.messages) {
      if (m.role === "user" || m.role === "assistant") {
        appendMessage(m.role, m.content);
      }
    }
  } catch {
    setStatus("Sin conexión al recuperar el historial.", true);
  }
}

async function sendMessage(text) {
  const body = sessionId
    ? { message: text, sessionId }
    : { message: text };

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }
  if (typeof data.reply !== "string") {
    throw new Error("Respuesta inválida del servidor.");
  }
  if (typeof data.sessionId === "string") {
    setSession(data.sessionId);
  }
  return data.reply;
}

inputEl.addEventListener("input", updateCounter);
updateCounter();

void hydrateSession();

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido.";
    setStatus(msg, true);
  } finally {
    setTyping(false);
    sendBtn.removeAttribute("aria-busy");
    sendBtn.disabled = false;
    inputEl.focus();
  }
});
