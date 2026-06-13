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
  { match: ["книги"], id: "books", emoji: "📚", title: "Книги о здоровье и долголетии",
    desc: "Outlive (П. Аттиа), Lifespan (Д. Синклер), Super Human (Д. Эспри).", img: IMG("photo-1512820790803-83ca734da794") },
  { match: ["withings", "весы"], id: "scale", emoji: "⚖️", title: "Умные весы Withings Body+",
    desc: "Вес, состав тела и динамика показателей в приложении.", img: IMG("photo-1576091160399-112ba8d25d1d") },
  { match: ["theragun mini"], id: "theragun-mini", emoji: "💆", title: "Theragun Mini (Therabody)",
    desc: "Компактный перкуссионный массажёр для мышц.", img: IMG("photo-1620916297397-a4a5402a3c6c") },
  { match: ["ultrahuman"], id: "ultrahuman-cgm", emoji: "🩸", title: "Ultrahuman M1 CGM",
    desc: "Непрерывный мониторинг глюкозы и метаболизма.", img: IMG("photo-1571019614242-c5c5dee9f50b") },
  { match: ["maggo", "зарядка", "qi2"], id: "charger-3in1", emoji: "🔌", title: "Зарядка 3-в-1 Qi2 (MagGo)",
    desc: "Одновременная зарядка iPhone, Apple Watch и AirPods.", img: IMG("photo-1556228578-8c89e6adf883") },
  { match: ["eight sleep"], id: "eight-sleep", emoji: "🛏️", title: "Eight Sleep Pod 5",
    desc: "Умный топпер с терморегуляцией и трекингом сна.", img: IMG("photo-1540555700478-4be289fbecef") },
  { match: ["theragun pro"], id: "theragun-pro", emoji: "💪", title: "Theragun Pro Plus (5-в-1)",
    desc: "Профессиональный массажёр для глубокого восстановления.", img: IMG("photo-1610465299993-e6675c9f9efa") },
  { match: ["joovv", "красного света"], id: "joovv", emoji: "🔴", title: "Панель красного света Joovv",
    desc: "Красный/инфракрасный свет для восстановления и кожи.", img: IMG("photo-1600334129128-685c5582fd35") },
  { match: ["normatec"], id: "normatec", emoji: "🦵", title: "Hyperice Normatec 3",
    desc: "Компрессионные сапоги для восстановления ног.", img: IMG("photo-1518611012118-696072aa579a") },
  { match: ["higherdose", "сауна"], id: "sauna-blanket", emoji: "🧖", title: "Сауна-одеяло HigherDOSE",
    desc: "Инфракрасное сауна-одеяло для детокса и релакса.", img: IMG("photo-1544716278-ca5e3f4abd8c") },
  { match: ["apple watch"], id: "apple-watch-ultra", emoji: "⌚️", title: "Apple Watch Ultra 2",
    desc: "ECG, GPS, автономность, связь — нативный Apple.", img: IMG("photo-1546868871-7041f2a55e12") },
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
const section = md.slice(md.indexOf("## Подобранный список"));
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
