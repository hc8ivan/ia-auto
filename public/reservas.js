const STORAGE_KEY = "lt_admin_key";

const authPanel = document.getElementById("auth-panel");
const mainPanel = document.getElementById("main-panel");
const authError = document.getElementById("auth-error");
const adminKeyInput = document.getElementById("admin-key");
const btnSaveKey = document.getElementById("btn-save-key");
const monthLabel = document.getElementById("month-label");
const calGrid = document.getElementById("cal-grid");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const btnToday = document.getElementById("btn-today");
const detailPlaceholder = document.getElementById("detail-placeholder");
const detailContent = document.getElementById("detail-content");
const mailTestTo = document.getElementById("mail-test-to");
const btnMailTest = document.getElementById("btn-mail-test");
const mailTestStatus = document.getElementById("mail-test-status");

/** @type {Map<string, object[]>} */
let byDate = new Map();
/** @type {{ y: number, m: number }} mes 1–12 */
let view = { y: new Date().getFullYear(), m: new Date().getMonth() + 1 };
let selectedYmd = null;

function getKey() {
  return sessionStorage.getItem(STORAGE_KEY) ?? "";
}

function setError(msg) {
  if (!msg) {
    authError.hidden = true;
    authError.textContent = "";
    return;
  }
  authError.hidden = false;
  authError.textContent = msg;
}

function authHeaders() {
  const k = getKey();
  return {
    Accept: "application/json",
    "X-Admin-Key": k,
  };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYmd(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Primer día del mes: 0 = lunes … 6 = domingo */
function mondayIndex(y, m) {
  const js = new Date(y, m - 1, 1).getDay();
  return (js + 6) % 7;
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

/** @param {object[]} list */
function buildMap(list) {
  const m = new Map();
  for (const r of list) {
    const d = r.reservation_date;
    if (typeof d !== "string") continue;
    if (!m.has(d)) m.set(d, []);
    m.get(d).push(r);
  }
  return m;
}

async function fetchMonth() {
  const y = view.y;
  const m = view.m;
  const from = toYmd(y, m, 1);
  const last = daysInMonth(y, m);
  const to = toYmd(y, m, last);
  setError("");
  const res = await fetch(
    `/api/admin/reservations?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { headers: authHeaders() },
  );
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 503) {
    sessionStorage.removeItem(STORAGE_KEY);
    showAuth();
    setError(typeof data.error === "string" ? data.error : "Acceso denegado.");
    return;
  }
  if (!res.ok) {
    setError(typeof data.error === "string" ? data.error : `Error ${res.status}`);
    return;
  }
  byDate = buildMap(data.reservations ?? []);
  renderCalendar();
}

function monthTitle() {
  const d = new Date(view.y, view.m - 1, 1);
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function renderCalendar() {
  const title = monthTitle();
  monthLabel.textContent = title.charAt(0).toUpperCase() + title.slice(1);
  calGrid.replaceChildren();

  const y = view.y;
  const m = view.m;
  const firstPad = mondayIndex(y, m);
  const dim = daysInMonth(y, m);
  const prevDim = daysInMonth(y, m - 1 || 12);
  const totalCells = Math.ceil((firstPad + dim) / 7) * 7;

  const today = new Date();
  const isTodayYmd = (ymd) =>
    ymd ===
    toYmd(today.getFullYear(), today.getMonth() + 1, today.getDate());

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-cell";

    let dayNum;
    let ymd;
    let muted = false;

    if (i < firstPad) {
      dayNum = prevDim - firstPad + i + 1;
      muted = true;
      const pm = m === 1 ? 12 : m - 1;
      const py = m === 1 ? y - 1 : y;
      ymd = toYmd(py, pm, dayNum);
    } else if (i < firstPad + dim) {
      dayNum = i - firstPad + 1;
      ymd = toYmd(y, m, dayNum);
    } else {
      dayNum = i - firstPad - dim + 1;
      muted = true;
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      ymd = toYmd(ny, nm, dayNum);
    }

    if (muted) cell.classList.add("cal-cell--muted");

    const list = byDate.get(ymd) ?? [];
    if (list.length > 0 && !muted) {
      cell.classList.add("cal-cell--has");
      const count = document.createElement("span");
      count.className = "cal-cell-count";
      count.textContent =
        list.length === 1 ? "1 reserva" : `${list.length} reservas`;
      cell.appendChild(count);
    }

    const num = document.createElement("span");
    num.className = "cal-cell-num";
    num.textContent = String(dayNum);
    cell.insertBefore(num, cell.firstChild);

    if (!muted && isTodayYmd(ymd)) cell.classList.add("cal-cell--today");
    if (ymd === selectedYmd) cell.classList.add("cal-cell--selected");

    cell.addEventListener("click", () => {
      if (muted || list.length === 0) return;
      selectedYmd = ymd;
      renderCalendar();
      showDetail(ymd, list);
    });

    calGrid.appendChild(cell);
  }
}

function showDetail(ymd, list) {
  detailPlaceholder.hidden = true;
  detailContent.hidden = false;
  detailContent.replaceChildren();

  const h = document.createElement("h3");
  h.className = "detail-day-title";
  const [yy, mm, dd] = ymd.split("-");
  const pretty = new Date(
    Number(yy),
    Number(mm) - 1,
    Number(dd),
  ).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  h.textContent = pretty.charAt(0).toUpperCase() + pretty.slice(1);
  detailContent.appendChild(h);

  for (const r of list) {
    const card = document.createElement("div");
    card.className = "detail-card";
    const email = r.customer_email
      ? `<br>Email: ${escapeHtml(r.customer_email)}`
      : "";
    card.innerHTML = `
      <strong>${escapeHtml(r.start_time)}</strong> · ${r.party_size} pax · ${r.tables_used} mesa(s)
      <br>${escapeHtml(r.customer_name)} · ${escapeHtml(r.customer_phone)}
      ${email}
      <br><small style="opacity:.75">ID ${escapeHtml(r.id)}</small>
    `;
    detailContent.appendChild(card);
  }
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showAuth() {
  authPanel.hidden = false;
  mainPanel.hidden = true;
}

function showMain() {
  authPanel.hidden = true;
  mainPanel.hidden = false;
}

async function init() {
  if (!getKey()) {
    showAuth();
    return;
  }
  showMain();
  await fetchMonth();
}

btnSaveKey.addEventListener("click", () => {
  const k = adminKeyInput.value.trim();
  if (!k) {
    setError("Introduzca la clave.");
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, k);
  adminKeyInput.value = "";
  setError("");
  showMain();
  void fetchMonth();
});

btnPrev.addEventListener("click", () => {
  if (view.m === 1) {
    view.y -= 1;
    view.m = 12;
  } else {
    view.m -= 1;
  }
  selectedYmd = null;
  detailPlaceholder.hidden = false;
  detailContent.hidden = true;
  void fetchMonth();
});

btnNext.addEventListener("click", () => {
  if (view.m === 12) {
    view.y += 1;
    view.m = 1;
  } else {
    view.m += 1;
  }
  selectedYmd = null;
  detailPlaceholder.hidden = false;
  detailContent.hidden = true;
  void fetchMonth();
});

btnToday.addEventListener("click", () => {
  const t = new Date();
  view.y = t.getFullYear();
  view.m = t.getMonth() + 1;
  selectedYmd = null;
  detailPlaceholder.hidden = false;
  detailContent.hidden = true;
  void fetchMonth();
});

btnMailTest.addEventListener("click", async () => {
  const to = mailTestTo.value.trim();
  mailTestStatus.textContent = "";
  mailTestStatus.classList.remove("is-ok", "is-err");
  if (!to) {
    mailTestStatus.classList.add("is-err");
    mailTestStatus.textContent = "Indique un correo.";
    return;
  }
  btnMailTest.disabled = true;
  try {
    const res = await fetch("/api/admin/mail/test", {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      mailTestStatus.classList.add("is-ok");
      mailTestStatus.textContent = "Enviado. Revise la bandeja (y spam).";
    } else {
      mailTestStatus.classList.add("is-err");
      mailTestStatus.textContent =
        typeof data.error === "string" ? data.error : `Error ${res.status}`;
    }
  } catch {
    mailTestStatus.classList.add("is-err");
    mailTestStatus.textContent = "Sin conexión.";
  } finally {
    btnMailTest.disabled = false;
  }
});

void init();
