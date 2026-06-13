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

  return `
  <article class="card ${isReserved ? "is-reserved" : ""} ${isMine ? "is-mine" : ""}" data-id="${item.id}">
    <div class="card-img">
      <img src="${item.img}" alt="${item.title}"
           loading="lazy"
           onerror="this.onerror=null;this.src='${fallback}'">
      ${isReserved ? '<span class="badge">Забронировано</span>' : ""}
    </div>
    <div class="card-body">
      <h3>${item.title}</h3>
      <p class="card-desc">${item.desc}</p>
      <p class="price">${formatPrice(item.price)}</p>
      ${footer}
    </div>
  </article>`;
}

function renderWishlist() {
  const grid = document.getElementById("wishlist");
  grid.innerHTML = window.WISHLIST.map(cardTemplate).join("");
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

  if (r && r.name) {
    const partnerNote = r.with_partner
      ? ' <span class="rsvp-partner">+ вторая половинка</span>'
      : "";
    box.innerHTML = `
      <p class="rsvp-status">🎉 Спасибо! Вы подтвердили участие как <b>${r.name}</b>${partnerNote}</p>
      <a class="rsvp-wishlink" href="#wishlist">
        Загляните в мой Wish-лист
        <span class="rsvp-arrow">↓</span>
      </a>
      <button class="btn btn-ghost" id="rsvp-cancel">Отменить участие</button>`;
    document.getElementById("rsvp-cancel").addEventListener("click", async () => {
      await store.rsvpUnset(getVisitorId());
      renderRsvp();
    });
  } else {
    box.innerHTML = `
      <p class="rsvp-q">Придёте на мероприятие?</p>
      <div class="rsvp-btns">
        <button class="btn" id="rsvp-partner">💑 Приду со второй половинкой</button>
        <button class="btn btn-ghost" id="rsvp-yes">✋ Приду один(а)</button>
      </div>`;

    const confirm = async (withPartner) => {
      const n = prompt("Как вас записать? Имя и фамилия:");
      if (!n || !n.trim()) return;
      await store.rsvpSet(getVisitorId(), n.trim(), withPartner);
      renderRsvp();
    };
    document.getElementById("rsvp-partner").addEventListener("click", () => confirm(true));
    document.getElementById("rsvp-yes").addEventListener("click", () => confirm(false));
  }
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
  refresh();
  renderRsvp();
  logVisitOnce();

  // Реальное время: подхватываем брони других гостей (Supabase)
  // или из других вкладок (localStorage) — единый метод onChange.
  if (window.BookingStore.onChange) {
    window.BookingStore.onChange(refresh);
  }
});
