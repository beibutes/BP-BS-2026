// ── Вход через Supabase Auth ───────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const auth = window.BookingStore.client && window.BookingStore.client.auth;

// Карта id → название позиции wish-листа
const TITLES = {};
(window.WISHLIST || []).forEach((i) => (TITLES[i.id] = i.title));

function showDashboard() {
  $("#login").hidden = true;
  $("#dashboard").hidden = false;
  loadData();
}

async function checkAuth() {
  if (!auth) {
    $("#login-error").textContent = "Supabase не настроен.";
    return;
  }
  const { data } = await auth.getSession();
  if (data.session) showDashboard();
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#login-form button[type=submit]");
  const err = $("#login-error");
  err.textContent = "";

  if (!auth) {
    err.textContent = "Ошибка: Supabase не загрузился. Обновите страницу.";
    return;
  }
  const email = $("#email").value.trim();
  const pass = $("#pass").value;
  if (!email || !pass) {
    err.textContent = "Введите email и пароль.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Вход…";
  try {
    const { error } = await auth.signInWithPassword({ email, password: pass });
    if (error) {
      err.textContent = "Не удалось войти: " + (error.message || "проверьте данные");
    } else {
      showDashboard();
    }
  } catch (ex) {
    err.textContent = "Сбой входа: " + (ex && ex.message ? ex.message : ex);
  } finally {
    btn.disabled = false;
    btn.textContent = "Войти";
  }
});

$("#logout").addEventListener("click", async () => {
  await auth.signOut();
  location.reload();
});

$("#refresh").addEventListener("click", loadData);

// ── Форматирование ─────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(id) {
  return id ? id.slice(0, 8) : "—";
}

function deviceFromUA(ua) {
  if (!ua) return "—";
  if (/mobile|iphone|android/i.test(ua)) return "📱 Телефон";
  if (/ipad|tablet/i.test(ua)) return "📱 Планшет";
  return "💻 Компьютер";
}

// ── Загрузка и рендер данных ───────────────────────────────────────
async function loadData() {
  const [bookings, visits] = await Promise.all([
    window.BookingStore.getBookingsDetailed(),
    window.BookingStore.getVisits(),
  ]);

  renderStats(bookings, visits);
  renderBookings(bookings);
  renderVisits(visits);
}

function renderStats(bookings, visits) {
  const uniqueVisitors = new Set(visits.map((v) => v.visitor_id)).size;
  const totalItems = (window.WISHLIST || []).length;
  const lastVisit = visits.length ? fmtDate(visits[0].created_at) : "—";

  const cards = [
    { label: "Уникальных гостей", value: uniqueVisitors, hint: "по устройствам/браузерам" },
    { label: "Всего заходов", value: visits.length, hint: "сессий на сайте" },
    { label: "Забронировано", value: `${bookings.length} / ${totalItems}`, hint: "позиций wish-листа" },
    { label: "Последний заход", value: lastVisit, hint: "" },
  ];

  $("#stats").innerHTML = cards
    .map(
      (c) => `
    <div class="stat-card">
      <div class="stat-value">${c.value}</div>
      <div class="stat-label">${c.label}</div>
      ${c.hint ? `<div class="stat-hint">${c.hint}</div>` : ""}
    </div>`
    )
    .join("");
}

function renderBookings(bookings) {
  if (!bookings.length) {
    $("#bookings-table").innerHTML = '<p class="empty">Пока никто ничего не забронировал.</p>';
    return;
  }
  const rows = bookings
    .map(
      (b) => `
    <tr>
      <td>${TITLES[b.item_id] || b.item_id}</td>
      <td><b>${b.name || "—"}</b></td>
      <td>${fmtDate(b.created_at)}</td>
      <td><button class="btn-mini" data-cancel="${b.item_id}">Снять бронь</button></td>
    </tr>`
    )
    .join("");

  $("#bookings-table").innerHTML = `
    <table class="data-table">
      <thead><tr><th>Позиция</th><th>Кто забронировал</th><th>Когда</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  $("#bookings-table")
    .querySelectorAll("[data-cancel]")
    .forEach((btn) =>
      btn.addEventListener("click", async () => {
        const id = btn.dataset.cancel;
        if (confirm(`Снять бронь с позиции «${TITLES[id] || id}»?`)) {
          await window.BookingStore.cancel(id);
          loadData();
        }
      })
    );
}

function renderVisits(visits) {
  if (!visits.length) {
    $("#visits-table").innerHTML = '<p class="empty">Заходов пока нет.</p>';
    return;
  }
  const rows = visits
    .slice(0, 200)
    .map(
      (v) => `
    <tr>
      <td>${fmtDate(v.created_at)}</td>
      <td><code>${shortId(v.visitor_id)}</code></td>
      <td>${deviceFromUA(v.user_agent)}</td>
    </tr>`
    )
    .join("");

  $("#visits-table").innerHTML = `
    <table class="data-table">
      <thead><tr><th>Когда зашли</th><th>Гость (ID)</th><th>Устройство</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="empty">Показаны последние ${Math.min(visits.length, 200)} из ${visits.length}.</p>`;
}

checkAuth();
