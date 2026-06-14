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
const LOCAL = (f) => `img/products/${f}`; // точное фото товара (скачано с офиц. сайта)

// Каталог: сопоставление позиций из источника с id, описанием, эмодзи и фото.
// match — ключевые слова (любое совпадение в названии). Новые позиции без
// совпадения попадут в список с заглушкой-эмодзи (нужно будет добавить фото).
// img: LOCAL(...) — точное фото товара с офиц. сайта; IMG(...) — представительское (Unsplash).
// url — официальная страница товара.
const CATALOG = [
  { match: ["outlive"], id: "book-outlive", emoji: "📕", title: "«Outlive»",
    desc: "Peter Attia — наука о долголетии и здоровье.",
    img: LOCAL("book-outlive.jpg"), url: "https://peterattiamd.com/outlive/" },
  { match: ["why we sleep"], id: "book-why-we-sleep", emoji: "📘", title: "«Why We Sleep»",
    desc: "Matthew Walker — почему сон критичен для здоровья.",
    img: LOCAL("book-why-we-sleep.jpg"), url: "https://www.simonandschuster.com/books/Why-We-Sleep/Matthew-Walker/9781501144325" },
  { match: ["deep medicine"], id: "book-deep-medicine", emoji: "📗", title: "«Deep Medicine»",
    desc: "Eric Topol — как ИИ меняет медицину.",
    img: LOCAL("book-deep-medicine.jpg"), url: "https://www.basicbooks.com/titles/eric-topol/deep-medicine/9781541644632/" },
  { match: ["co-intelligence"], id: "book-co-intelligence", emoji: "📙", title: "«Co-Intelligence»",
    desc: "Ethan Mollick — как работать вместе с ИИ.",
    img: LOCAL("book-co-intelligence.jpg"), url: "https://www.penguinrandomhouse.com/books/741805/co-intelligence-by-ethan-mollick/" },
  { match: ["code breaker"], id: "book-code-breaker", emoji: "📒", title: "«The Code Breaker»",
    desc: "Walter Isaacson — Дженнифер Даудна, CRISPR и биотех.",
    img: LOCAL("book-code-breaker.jpg"), url: "https://www.simonandschuster.com/books/The-Code-Breaker/Walter-Isaacson/9781982115852" },
  { match: ["7 powers"], id: "book-7-powers", emoji: "📔", title: "«7 Powers»",
    desc: "Hamilton Helmer — фундамент бизнес-стратегии.",
    img: LOCAL("book-7-powers.jpg"), url: "https://7powers.com/" },
  { match: ["canyon", "endurace"], id: "canyon-endurace", emoji: "🚲", title: "Canyon Endurace CF 8",
    desc: "Шоссейный велосипед: карбон, Shimano 105 Di2.",
    img: LOCAL("canyon-endurace.jpg"), url: "https://www.canyon.com/en-us/road-bikes/endurance-bikes/endurace/" },
  { match: ["bambu"], id: "bambu-p1s", emoji: "🖨️", title: "Bambu Lab P1S",
    desc: "3D-принтер: многоцветная печать, Combo с AMS.",
    img: LOCAL("bambu-p1s.jpg"), url: "https://bambulab.com/en/p1" },
  { match: ["plaud"], id: "plaud-notepin", emoji: "🎙️", title: "Plaud NotePin S",
    desc: "ИИ-нотетейкер: транскрипция встреч и GPT-саммари.",
    img: LOCAL("plaud-notepin.png"), url: "https://www.plaud.ai/products/notepin" },
  { match: ["remarkable"], id: "remarkable", emoji: "📝", title: "reMarkable Paper Pro",
    desc: "E-ink планшет для заметок и чтения без отвлечений.",
    img: LOCAL("remarkable.jpg"), url: "https://remarkable.com/store/remarkable-paper/pro" },
  { match: ["наушники", "bose", "sony"], id: "headphones", emoji: "🎧", title: "Sony WH-1000XM6",
    desc: "Накладные наушники с шумоподавлением — для перелётов.",
    img: IMG("photo-1505740420928-5e560c06d30e"), url: "https://electronics.sony.com/audio/headphones/headband/p/wh1000xm6-b" },
  { match: ["withings", "body scan"], id: "withings-scan", emoji: "⚖️", title: "Withings Body Scan",
    desc: "Умные весы: состав тела и ЭКГ.",
    img: LOCAL("withings-scan.jpg"), url: "https://www.withings.com/us/en/body-scan" },
  { match: ["dji", "osmo"], id: "dji-camera", emoji: "🎥", title: "DJI Osmo Pocket 3",
    desc: "Карманная камера со стабилизацией для путешествий.",
    img: LOCAL("dji-camera.png"), url: "https://www.dji.com/osmo-pocket-3" },
  { match: ["шахмат"], id: "smart-chess", emoji: "♟️", title: "GoChess (умные шахматы)",
    desc: "Умная доска: ходит сама и помогает учиться игре.",
    img: LOCAL("gochess.jpg"), url: "https://www.getgochess.com" },
  { match: ["eight sleep"], id: "eight-sleep", emoji: "🛏️", title: "Eight Sleep Pod 5",
    desc: "Умный топпер с терморегуляцией и трекингом сна.",
    img: LOCAL("eight-sleep.jpg"), url: "https://www.eightsleep.com/pod/" },
  { match: ["e-bike", "specialized", "vanmoof"], id: "ebike", emoji: "🚲", title: "Specialized Turbo Vado (e-bike)",
    desc: "Электровелосипед премиум-класса.",
    img: IMG("photo-1571068316344-75bc76f77890"), url: "https://www.specialized.com/us/en/c/e-bikes/turbo-vado" },
  { match: ["nvidia", "dgx"], id: "dgx-spark", emoji: "🧠", title: "NVIDIA DGX Spark",
    desc: "Персональный ИИ-суперкомпьютер для локальных LLM.",
    img: LOCAL("dgx-spark.jpg"), url: "https://www.nvidia.com/en-us/products/workstations/dgx-spark/" },
  { match: ["tonal", "tempo", "тренажёр"], id: "home-gym", emoji: "🏋️", title: "Tonal (силовой тренажёр)",
    desc: "Умный домашний силовой тренажёр.",
    img: IMG("photo-1534438327276-14e5300c3a48"), url: "https://www.tonal.com" },
  { match: ["rimowa", "bellroy", "чемодан"], id: "luggage", emoji: "🧳", title: "Чемодан Rimowa",
    desc: "Премиальный чемодан для поездок.",
    img: IMG("photo-1553062407-98eeb64c6a62"), url: "https://www.rimowa.com" },
  { match: ["винный", "холодильник"], id: "wine-fridge", emoji: "🍷", title: "Винный шкаф Caso WineDuett 12",
    desc: "Двухзонный, 12 бутылок, настольный.",
    img: LOCAL("wine-fridge.jpg"), url: "https://www.caso-design.de/en/produkte/weinkuehlschraenke/" },
  { match: ["виски", "хрустальн", "riedel", "waterford", "nude"], id: "whisky-set", emoji: "🥃", title: "Хрустальный набор для виски",
    desc: "Графин и бокалы Waterford Markham, хрусталь.",
    img: LOCAL("whisky-set.jpg"), url: "https://www.waterford.com/" },
  { match: ["airpods max"], id: "airpods-max", emoji: "🎧", title: "AirPods Max",
    desc: "Накладные наушники Apple с шумоподавлением (USB-C).",
    img: LOCAL("airpods-max.png"), url: "https://www.apple.com/airpods-max/" },
  { match: ["паровой шкаф", "styler", "airdresser"], id: "steam-closet", emoji: "🧥", title: "Паровой шкаф LG Styler / Samsung AirDresser",
    desc: "Уход за костюмами без химчистки.",
    img: LOCAL("airdresser.jpg"), url: "https://www.samsung.com/us/home-appliances/airdresser/" },
];

const TIERS = [
  { key: "budget", test: /доступн/i, label: "Доступный", range: "до ~100 000 ₸" },
  { key: "mid", test: /средн/i, label: "Средний", range: "~100 000 – 300 000 ₸" },
  { key: "premium", test: /премиум/i, label: "Премиум", range: "от 300 000 ₸" },
];

function fmtNum(n) {
  return Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ");
}

function multOf(tok) {
  if (/млн/i.test(tok)) return 1e6;
  if (/тыс|к/i.test(tok)) return 1e3;
  return null;
}
function numOf(tok) {
  return parseFloat(tok.replace(/[~$₸\s]/g, "").replace(/млн|тыс|к/gi, "").replace(",", "."));
}
function formatPrice(raw) {
  let s = raw.trim();
  if (s.includes("→")) s = s.split("→").pop().trim(); // берём значение в ₸
  s = s.replace(/\(.*?\)/g, "").replace(/\.$/, "").trim();
  const from = /^от[\s~]/i.test(s);
  s = s.replace(/^от\s*/i, "").trim();
  const parts = s.split(/[–-]/).map((x) => x.trim()).filter(Boolean);
  // множитель у каждого числа свой; если нет — наследуем последний явный (для «8–25к»)
  const mults = parts.map(multOf);
  const lastMult = [...mults].reverse().find((m) => m != null) || 1;
  const nums = parts
    .map((p, i) => {
      const n = numOf(p);
      return isNaN(n) ? null : n * (mults[i] != null ? mults[i] : lastMult);
    })
    .filter((x) => x != null);
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
    url: cat ? cat.url || "" : "",
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
