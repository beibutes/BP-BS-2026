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
  const [bookings, visits, rsvps] = await Promise.all([
    window.BookingStore.getBookingsDetailed(),
    window.BookingStore.getVisits(),
    window.BookingStore.getRsvps ? window.BookingStore.getRsvps() : [],
  ]);

  renderStats(bookings, visits, rsvps);
  renderRsvps(rsvps);
  renderBookings(bookings);
  renderVisits(visits);
}

function renderStats(bookings, visits, rsvps) {
  const uniqueVisitors = new Set(visits.map((v) => v.visitor_id)).size;
  const totalItems = (window.WISHLIST || []).length;
  const lastVisit = visits.length ? fmtDate(visits[0].created_at) : "—";

  const coming = rsvps.filter((r) => r.coming);
  const declined = rsvps.filter((r) => !r.coming);
  const withPartner = coming.filter((r) => r.with_partner).length;
  const people = coming.length + withPartner; // каждый придёт = 1, +1 за вторую половинку
  const cards = [
    {
      label: "Придут гостей",
      value: people,
      hint: `${coming.length} подтвердили · из них ${withPartner} со 2-й половинкой`,
    },
    { label: "Не придут", value: declined.length, hint: 'ответили «не смогу»' },
    { label: "Уникальных гостей", value: uniqueVisitors, hint: "по устройствам/браузерам" },
    { label: "Всего заходов", value: visits.length, hint: "сессий на сайте" },
    { label: "Забронировано", value: `${bookings.length} / ${totalItems}`, hint: "позиций wish-листа" },
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

function renderRsvps(rsvps) {
  if (!rsvps.length) {
    $("#rsvp-table").innerHTML = '<p class="empty">Пока никто не подтвердил участие.</p>';
    return;
  }
  // Сначала те, кто придёт, затем отказы
  const sorted = [...rsvps].sort((a, b) => (a.coming === b.coming ? 0 : a.coming ? -1 : 1));
  const rows = sorted
    .map(
      (r, i) => `
    <tr class="${r.coming ? "" : "row-declined"}">
      <td>${i + 1}</td>
      <td><b>${r.name}</b></td>
      <td>${r.coming ? "✅ Придёт" : "✖ Не придёт"}</td>
      <td>${r.coming && r.with_partner ? "💑 Да" : "—"}</td>
      <td>${fmtDate(r.created_at)}</td>
    </tr>`
    )
    .join("");
  $("#rsvp-table").innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>Имя</th><th>Статус</th><th>Со 2-й половинкой</th><th>Когда ответил</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
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
