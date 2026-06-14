// Генератор wish-листа из файла-источника предпочтений.
// Источник:  memory/user-gift-preferences.md  (секция «## Подобранный список»)
// Результат: data/wishlist.js
// Запуск:    node tools/build-wishlist.mjs
// При изменении источника — перезапустить, список пересоберётся.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../../../memory/user-gift-preferences.md");
const OUT = resolve(__dirname, "../data/wishlist.js");
const IMG = (id) => `https://images.unsplash.com/${id}?w=640&q=80`;

// Каталог: сопоставление позиций из источника с id, описанием, эмодзи и фото.
// match — ключевые слова (любое совпадение в названии). Новые позиции без
// совпадения попадут в список с заглушкой-эмодзи (нужно будет добавить фото).
const CATALOG = [
  { match: ["книги"], id: "books", emoji: "📚", title: "Книги (нон-фикшн)",
    desc: "Outlive, Why We Sleep, Deep Medicine, Co-Intelligence, The Code Breaker, 7 Powers.", img: IMG("photo-1512820790803-83ca734da794") },
  { match: ["plaud"], id: "plaud-notepin", emoji: "🎙️", title: "Plaud NotePin S",
    desc: "ИИ-нотетейкер: транскрипция встреч и GPT-саммари.", img: IMG("photo-1590602847861-f357a9332bbc") },
  { match: ["remarkable"], id: "remarkable", emoji: "📝", title: "reMarkable Paper Pro",
    desc: "E-ink планшет для заметок и чтения без отвлечений.", img: IMG("photo-1531297484001-80022131f5a1") },
  { match: ["наушники", "bose", "sony"], id: "headphones", emoji: "🎧", title: "Наушники Bose QC Ultra / Sony XM6",
    desc: "Беспроводные с шумоподавлением — идеально для перелётов.", img: IMG("photo-1505740420928-5e560c06d30e") },
  { match: ["withings", "body scan"], id: "withings-scan", emoji: "⚖️", title: "Withings Body Scan",
    desc: "Умные весы: состав тела и ЭКГ.", img: IMG("photo-1576091160399-112ba8d25d1d") },
  { match: ["dji", "osmo"], id: "dji-camera", emoji: "🚁", title: "DJI Mini / Osmo Pocket",
    desc: "Дрон и карманная камера для съёмки в путешествиях.", img: IMG("photo-1473968512647-3e447244af8f") },
  { match: ["шахмат"], id: "smart-chess", emoji: "♟️", title: "Умные шахматы Phantom / GoChess",
    desc: "Доска, которая ходит сама и помогает учиться.", img: IMG("photo-1528819622765-d6bcf132f793") },
  { match: ["eight sleep"], id: "eight-sleep", emoji: "🛏️", title: "Eight Sleep Pod 5",
    desc: "Умный топпер с терморегуляцией и трекингом сна.", img: IMG("photo-1540555700478-4be289fbecef") },
  { match: ["e-bike", "specialized", "vanmoof"], id: "ebike", emoji: "🚲", title: "Премиум e-bike Specialized / VanMoof",
    desc: "Электровелосипед премиум-класса.", img: IMG("photo-1571068316344-75bc76f77890") },
  { match: ["nvidia", "dgx"], id: "dgx-spark", emoji: "🧠", title: "NVIDIA DGX Spark",
    desc: "Персональный ИИ-суперкомпьютер для локальных LLM.", img: IMG("photo-1591488320449-011701bb6704") },
  { match: ["tonal", "tempo", "тренажёр"], id: "home-gym", emoji: "🏋️", title: "Силовой тренажёр Tonal / Tempo",
    desc: "Умный домашний силовой тренажёр.", img: IMG("photo-1534438327276-14e5300c3a48") },
  { match: ["rimowa", "bellroy", "чемодан"], id: "luggage", emoji: "🧳", title: "Чемодан Rimowa / рюкзак Bellroy",
    desc: "Премиальный чемодан или рюкзак для поездок.", img: IMG("photo-1553062407-98eeb64c6a62") },
  { match: ["винный", "холодильник"], id: "wine-fridge", emoji: "🍷", title: "Винный холодильник + бутылка",
    desc: "Винный шкаф и коллекционная бутылка.", img: IMG("photo-1510812431401-41d2bd2722f3") },
];

const TIERS = [
  { key: "budget", test: /доступн/i, label: "Доступный", range: "до ~100 000 ₸" },
  { key: "mid", test: /средн/i, label: "Средний", range: "~100 000 – 300 000 ₸" },
  { key: "premium", test: /премиум/i, label: "Премиум", range: "от 300 000 ₸" },
];

function fmtNum(n) {
  return Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ");
}

function formatPrice(raw) {
  let s = raw.trim();
  if (s.includes("→")) s = s.split("→").pop().trim(); // берём значение в ₸
  s = s.replace(/\(.*?\)/g, "").replace(/\.$/, "").trim();
  const from = /^от[\s~]/i.test(s);
  s = s.replace(/^от\s*/i, "").replace(/[~$₸]/g, "").trim();
  let mult = 1;
  if (/млн/i.test(s)) mult = 1e6;
  else if (/к/i.test(s)) mult = 1e3;
  s = s.replace(/млн|тыс|к/gi, "").trim();
  const nums = s.split(/[–-]/).map((x) => parseFloat(x.replace(",", ".")) * mult).filter((x) => !isNaN(x));
  if (!nums.length) return raw.trim();
  const body = nums.length > 1 ? `${fmtNum(nums[0])} – ${fmtNum(nums[1])}` : fmtNum(nums[0]);
  return (from ? "от " : "") + body + " ₸";
}

function slug(name) {
  const map = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
  return name.toLowerCase().split("").map((c) => map[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "item";
}

// ── Парсинг источника ──────────────────────────────────────────────
const md = readFileSync(SRC, "utf8");
// Секция со списком: заголовок «## ... список ...» (любая формулировка).
const headMatch = md.match(/^##[^\n]*спис[^\n]*$/im);
const section = headMatch ? md.slice(md.indexOf(headMatch[0])) : md;
const lines = section.split("\n");

const items = [];
const usedTiers = new Set();
let curTier = null;

for (const line of lines) {
  const tierMatch = line.match(/\*\*([^*]*тир[^*]*)\*\*/i);
  if (tierMatch) {
    const t = TIERS.find((x) => x.test.test(tierMatch[1]));
    if (t) curTier = t;
    continue;
  }
  const itemMatch = line.match(/^\s*\d+\.\s+(.+?)\s*$/);
  if (!itemMatch || !curTier) continue;

  let text = itemMatch[1];
  // Разделитель «название — цена»: первое « — » вне скобок
  // (внутри скобок тире может встречаться в самом названии/описании).
  let depth = 0, sep = -1;
  for (let i = 0; i < text.length - 2; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && text.slice(i, i + 3) === " — ") { sep = i; break; }
  }
  if (sep === -1) continue;
  let name = text.slice(0, sep).trim();
  const priceRaw = text.slice(sep + 3).trim();

  const top = name.startsWith("⭐");
  name = name.replace(/^⭐\s*/, "").trim();

  const cat = CATALOG.find((c) => c.match.some((k) => name.toLowerCase().includes(k)));
  const cleanName = name.replace(/\s*\(.*?\)\s*/g, " ").trim();

  items.push({
    id: cat ? cat.id : slug(cleanName),
    title: cat ? cat.title : cleanName,
    desc: cat ? cat.desc : "",
    priceText: formatPrice(priceRaw),
    tier: curTier.key,
    top,
    emoji: cat ? cat.emoji : "🎁",
    img: cat ? cat.img : "",
  });
  usedTiers.add(curTier.key);
  if (!cat) console.warn("⚠ нет фото для позиции:", name);
}

const tiersOut = TIERS.filter((t) => usedTiers.has(t.key)).map((t) => ({ key: t.key, label: t.label, range: t.range }));

const out =
  "// АВТОГЕНЕРАЦИЯ — не редактировать вручную.\n" +
  "// Источник: memory/user-gift-preferences.md · Сборка: node tools/build-wishlist.mjs\n" +
  "window.WISHLIST_TIERS = " + JSON.stringify(tiersOut, null, 2) + ";\n\n" +
  "window.WISHLIST = " + JSON.stringify(items, null, 2) + ";\n";

writeFileSync(OUT, out);
console.log(`✓ Собрано позиций: ${items.length}, тиров: ${tiersOut.length}`);
console.log(`✓ Записано: ${OUT}`);
