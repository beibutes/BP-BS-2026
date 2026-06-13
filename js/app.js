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

function cardTemplate(item) {
  const reservedBy = bookings[item.id];
  const isReserved = Boolean(reservedBy);
  const fallback = placeholderSVG(item.emoji);

  return `
  <article class="card ${isReserved ? "is-reserved" : ""}" data-id="${item.id}">
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
      ${
        isReserved
          ? `<p class="reserved-note">✓ Уже забронировано</p>`
          : `<button class="btn" data-action="reserve" data-id="${item.id}">Забронировать</button>`
      }
    </div>
  </article>`;
}

function renderWishlist() {
  const grid = document.getElementById("wishlist");
  grid.innerHTML = window.WISHLIST.map(cardTemplate).join("");
}

async function refresh() {
  bookings = await window.BookingStore.getAll();
  renderWishlist();
}

async function onGridClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "reserve") {
    const name = prompt("Ваше имя (его увидит только именинник):");
    if (!name || !name.trim()) return;
    const res = await window.BookingStore.reserve(id, name.trim());
    if (!res.ok) {
      alert("Эту позицию только что забронировали. Выберите другую 🙂");
    }
    await refresh();
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
  logVisitOnce();

  // Реальное время: подхватываем брони других гостей (Supabase)
  // или из других вкладок (localStorage) — единый метод onChange.
  if (window.BookingStore.onChange) {
    window.BookingStore.onChange(refresh);
  }
});
