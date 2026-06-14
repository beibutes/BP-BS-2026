// Применяет SQL-миграцию к Postgres (Supabase) по строке подключения.
// Запуск (строку подключения возьми в Supabase → Project Settings → Database → Connection string → URI):
//   cd projects/den-rozhdeniya-svoy-2026
//   npm i pg
//   SUPABASE_DB_URL='postgresql://postgres:PASSWORD@db.lrtroervczvkxkzrxspu.supabase.co:5432/postgres' \
//     node tools/apply-migration.mjs data/migration-v5.sql
//
// Секрет в файлы не пишется и не коммитится — только в переменную окружения сессии.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("✖ Не задан SUPABASE_DB_URL. См. инструкцию вверху файла.");
  process.exit(1);
}

const file = process.argv[2] || "data/migration-v5.sql";
const sqlPath = resolve(__dirname, "..", file);
const sql = readFileSync(sqlPath, "utf8");

let pg;
try {
  pg = await import("pg");
} catch {
  console.error("✖ Нет пакета pg. Установи: npm i pg");
  process.exit(1);
}

const client = new pg.default.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`→ Применяю ${file} …`);
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("✓ Миграция применена.");

  // Проверка: появилась ли колонка partner_name и новая сигнатура rsvp_set.
  const col = await client.query(
    "select 1 from information_schema.columns where table_schema='public' and table_name='rsvps' and column_name='partner_name'"
  );
  console.log(col.rowCount ? "✓ Колонка rsvps.partner_name на месте." : "⚠ Колонка partner_name не найдена.");
} catch (e) {
  try { await client.query("rollback"); } catch {}
  console.error("✖ Ошибка миграции:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
