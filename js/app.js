// ── Параметры события ──────────────────────────────────────────────
const EVENT_DATE = new Date("2026-10-09T18:00:00+05:00"); // Астана, UTC+5

// ── Обратный отсчёт ────────────────────────────────────────────────
function pad(n) {
  return String(n).padStart(2, "0");
}

function tickCountdown() {
  const now = new Date();
  let diff = Math.floor((EVENT_DATE - now) / 1000);

  const elDays = document.getElementById("cd-days");
  const elHours = document.getElementById("cd-hours");
  const elMin = document.getElementById("cd-min");
  const elSec = document.getElementById("cd-sec");

  if (diff <= 0) {
    document.getElementById("countdown").innerHTML =
      '<p class="cd-started">🎉 Праздник уже начался!</p>';
    return;
  }

  const days = Math.floor(diff / 86400);
  diff -= days * 86400;
  const hours = Math.floor(diff / 3600);
  diff -= hours * 3600;
  const min = Math.floor(diff / 60);
  const sec = diff - min * 60;

  elDays.textContent = days;
  elHours.textContent = pad(hours);
  elMin.textContent = pad(min);
  elSec.textContent = pad(sec);
}

// ── Wish-list ──────────────────────────────────────────────────────
function formatPrice([min, max]) {
  const fmt = (n) => n.toLocaleString("ru-RU");
  return `${fmt(min)} – ${fmt(max)} ₸`;
}

function placeholderSVG(emoji) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='420'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='%23ffe1ec'/><stop offset='1' stop-color='%23c9b3ff'/>
    </linearGradient></defs>
    <rect width='640' height='420' fill='url(%23g)'/>
    <text x='320' y='240' font-size='160' text-anchor='middle'>${emoji}</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + svg.replace(/\n\s*/g, "");
}

let bookings = {};
let myItems = [];

// ── Состояние фильтров wish-листа ──────────────────────────────────
let activeTier = "all"; // "all" | ключ тира
let freeOnly = false;   // показывать только не забронированные

function renderFilters() {
  const bar = document.getElementById("wl-filters");
  if (!bar) return;
  const tiers = window.WISHLIST_TIERS || [];
  const tabs = [{ key: "all", label: "Все" }, ...tiers.map((t) => ({ key: t.key, label: t.label }))];
  bar.innerHTML = `
    <div class="wl-tabs">
      ${tabs
        .map(
          (t) =>
            `<button class="wl-tab ${t.key === activeTier ? "is-active" : ""}" data-tier="${t.key}">${t.label}</button>`
        )
        .join("")}
    </div>
    <label class="wl-toggle">
      <input type="checkbox" id="wl-free-only" ${freeOnly ? "checked" : ""}>
      <span>Только свободные</span>
    </label>`;

  bar.querySelectorAll(".wl-tab").forEach((b) =>
    b.addEventListener("click", () => {
      activeTier = b.dataset.tier;
      renderFilters();
      renderWishlist();
    })
  );
  const chk = bar.querySelector("#wl-free-only");
  if (chk) chk.addEventListener("change", (e) => {
    freeOnly = e.target.checked;
    renderWishlist();
  });
}

function cardTemplate(item) {
  const isReserved = Boolean(bookings[item.id]);
  const isMine = myItems.includes(item.id);
  const fallback = placeholderSVG(item.emoji);

  let footer;
  if (!isReserved) {
    footer = `<button class="btn" data-action="reserve" data-id="${item.id}">Забронировать</button>`;
  } else if (isMine) {
    footer = `<p class="reserved-note">✓ Ваша бронь</p>
              <button class="btn btn-ghost" data-action="cancel-own" data-id="${item.id}">Снять мою бронь</button>`;
  } else {
    footer = `<p class="reserved-note">✓ Уже забронировано</p>`;
  }

  const imgSrc = item.img || fallback;
  const isProduct = item.img && item.img.indexOf("img/products/") === 0;
  return `
  <article class="card ${isReserved ? "is-reserved" : ""} ${isMine ? "is-mine" : ""}" data-id="${item.id}">
    <div class="card-img ${isProduct ? "card-img--contain" : ""}">
      <img src="${imgSrc}" alt="${item.title}"
           loading="lazy"
           onerror="this.onerror=null;this.src='${fallback}'">
      ${item.top ? '<span class="top-badge">⭐ Выбор именинника</span>' : ""}
      ${isReserved ? '<span class="badge">Забронировано</span>' : ""}
    </div>
    <div class="card-body">
      <h3>${item.title}</h3>
      ${item.desc ? `<p class="card-desc">${item.desc}</p>` : '<p class="card-desc"></p>'}
      <p class="price">${item.priceText || ""}</p>
      ${item.url ? `<a class="card-link" href="${item.url}" target="_blank" rel="noopener">Открыть на сайте →</a>` : ""}
      ${footer}
    </div>
  </article>`;
}

function renderWishlist() {
  const container = document.getElementById("wishlist");
  const tiers = (window.WISHLIST_TIERS || [{ key: null, label: "", range: "" }]).filter(
    (t) => activeTier === "all" || t.key === activeTier
  );
  const html = tiers
    .map((t) => {
      let items = window.WISHLIST.filter((i) => i.tier === t.key);
      if (freeOnly) items = items.filter((i) => !bookings[i.id]);
      if (!items.length) return "";
      return `
        <div class="tier">
          <div class="tier-head">
            <h3>${t.label}</h3>
            <span class="tier-range">${t.range}</span>
          </div>
          <div class="grid">${items.map(cardTemplate).join("")}</div>
        </div>`;
    })
    .join("");
  container.innerHTML =
    html || `<p class="wl-empty">В этом блоке нет свободных позиций 🙂</p>`;
}

async function refresh() {
  const store = window.BookingStore;
  const [b, mine] = await Promise.all([
    store.getAll(),
    store.getMyItems ? store.getMyItems(getVisitorId()) : [],
  ]);
  bookings = b;
  myItems = mine;
  renderWishlist();
}

async function onGridClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "reserve") {
    const store = window.BookingStore;
    // Если гость уже подтвердил участие — берём имя оттуда, не спрашиваем заново.
    const rsvp = store.rsvpGet ? await store.rsvpGet(getVisitorId()) : null;
    let name;
    if (rsvp && rsvp.name) {
      if (!confirm(`Забронировать как «${rsvp.name}»?`)) return;
      name = rsvp.name;
    } else {
      const input = prompt("Ваше имя (его увидит только именинник):");
      if (!input || !input.trim()) return;
      name = input.trim();
    }
    const res = await store.reserve(id, name, getVisitorId());
    if (!res.ok) {
      alert("Эту позицию только что забронировали. Выберите другую 🙂");
    }
    await refresh();
  }

  if (action === "cancel-own") {
    if (!confirm("Снять вашу бронь с этой позиции?")) return;
    const ok = await window.BookingStore.cancelOwn(id, getVisitorId());
    if (!ok) {
      alert("Не удалось снять бронь — её ставил другой гость.");
    }
    await refresh();
  }
}

// ── RSVP «Я приду» ────────────────────────────────────────────────
async function renderRsvp() {
  const box = document.getElementById("rsvp");
  if (!box) return;
  const store = window.BookingStore;
  const r = store.rsvpGet ? await store.rsvpGet(getVisitorId()) : null;

  const changeBtn = `<button class="btn btn-ghost" id="rsvp-cancel">Изменить ответ</button>`;
  const onChange = () => {
    document.getElementById("rsvp-cancel").addEventListener("click", async () => {
      await store.rsvpUnset(getVisitorId());
      renderRsvp();
    });
  };

  if (r && r.name && r.coming) {
    // Придёт
    const partnerNote = r.with_partner
      ? ' <span class="rsvp-partner">+ вторая половинка</span>'
      : "";
    box.innerHTML = `
      <p class="rsvp-status">Уважаемый(ая) <b>${r.name}</b>${partnerNote}, спасибо, что подтвердили участие. Буду ждать Вас!</p>
      <a class="rsvp-wishlink" href="#wishlist">
        Загляните в мой Wish-лист
        <span class="rsvp-arrow">↓</span>
      </a>
      ${changeBtn}`;
    onChange();
  } else if (r && r.name && !r.coming) {
    // Не придёт
    box.innerHTML = `
      <p class="rsvp-status">Жаль, что не сможете прийти, <b>${r.name}</b>. 🙏</p>
      ${changeBtn}`;
    onChange();
  } else {
    // Ещё не ответил
    box.innerHTML = `
      <p class="rsvp-q">Придёте на мероприятие?</p>
      <div class="rsvp-btns">
        <button class="btn" id="rsvp-partner">💑 Приду со второй половинкой</button>
        <button class="btn btn-ghost" id="rsvp-yes">✋ Приду один(а)</button>
        <button class="btn btn-ghost rsvp-no" id="rsvp-no">✖ Не смогу прийти</button>
      </div>`;

    const respond = async (withPartner, coming) => {
      const n = prompt("Как вас записать? Имя и фамилия:");
      if (!n || !n.trim()) return;
      await store.rsvpSet(getVisitorId(), n.trim(), withPartner, coming);
      renderRsvp();
    };
    document.getElementById("rsvp-partner").addEventListener("click", () => respond(true, true));
    document.getElementById("rsvp-yes").addEventListener("click", () => respond(false, true));
    document.getElementById("rsvp-no").addEventListener("click", () => respond(false, false));
  }
}

// ── «Добавить в календарь» ─────────────────────────────────────────
function initCalendar() {
  const btn = document.getElementById("cal-btn");
  const menu = document.getElementById("cal-menu");
  const g = document.getElementById("cal-google");
  if (!btn || !menu) return;

  if (g) {
    g.href =
      "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent("День рождение Бейбут Есенбаев") +
      "&dates=20261009T130000Z/20261009T170000Z" +
      "&details=" + encodeURIComponent(
        "Отпразднуем вместе! Приглашение: https://beibutes.github.io/BP-BS-2026/"
      ) +
      "&location=" + encodeURIComponent("Ресторан Svoy, ул. Жумабаева, 24, Астана");
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) {
      menu.hidden = true;
    }
  });
}

// ── Учёт посещений (один раз за сессию браузера) ──────────────────
function getVisitorId() {
  let vid = localStorage.getItem("birthday_visitor_id");
  if (!vid) {
    vid =
      (crypto.randomUUID && crypto.randomUUID()) ||
      "v_" + Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem("birthday_visitor_id", vid);
  }
  return vid;
}

function logVisitOnce() {
  if (sessionStorage.getItem("birthday_visit_logged")) return;
  sessionStorage.setItem("birthday_visit_logged", "1");
  if (window.BookingStore.logVisit) {
    window.BookingStore.logVisit(getVisitorId(), navigator.userAgent);
  }
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  tickCountdown();
  setInterval(tickCountdown, 1000);

  document.getElementById("wishlist").addEventListener("click", onGridClick);
  renderFilters();
  refresh();
  renderRsvp();
  initCalendar();
  logVisitOnce();

  // Реальное время: подхватываем брони других гостей (Supabase)
  // или из других вкладок (localStorage) — единый метод onChange.
  if (window.BookingStore.onChange) {
    window.BookingStore.onChange(refresh);
  }
});
