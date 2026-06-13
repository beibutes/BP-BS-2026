// Хранилище броней. Два режима:
//  • Supabase  — общая бронь для всех гостей в реальном времени (если задан CONFIG).
//  • localStorage — демо в одном браузере (fallback, если Supabase не настроен).
// Интерфейс одинаковый: getAll() / reserve(id, name) / cancel(id) + onChange(cb).

const STORAGE_KEY = "birthday_bookings_v1";
const VISITS_KEY = "birthday_visits_v1";
const TABLE = "bookings";
const VISITS_TABLE = "visits";

// ── Режим localStorage (демо) ──────────────────────────────────────
const LocalStore = {
  mode: "local",
  async getAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  },
  async reserve(itemId, name) {
    const all = await this.getAll();
    if (all[itemId]) return { ok: false, by: all[itemId] };
    all[itemId] = name;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return { ok: true };
  },
  async cancel(itemId) {
    const all = await this.getAll();
    delete all[itemId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return { ok: true };
  },
  onChange(cb) {
    // синхронизация между вкладками одного браузера
    window.addEventListener("storage", cb);
  },
  // — методы для админки/учёта (демо-режим) —
  async logVisit(visitorId, ua) {
    const list = JSON.parse(localStorage.getItem(VISITS_KEY) || "[]");
    list.push({ visitor_id: visitorId, user_agent: ua, created_at: new Date().toISOString() });
    localStorage.setItem(VISITS_KEY, JSON.stringify(list));
  },
  async getVisits() {
    return JSON.parse(localStorage.getItem(VISITS_KEY) || "[]");
  },
  async getBookingsDetailed() {
    const all = await this.getAll();
    return Object.entries(all).map(([item_id, name]) => ({
      item_id,
      name,
      created_at: null,
    }));
  },
};

// ── Режим Supabase (общая бронь) ───────────────────────────────────
function makeSupabaseStore() {
  const sb = window.supabase.createClient(
    window.CONFIG.SUPABASE_URL,
    window.CONFIG.SUPABASE_ANON_KEY
  );

  return {
    mode: "supabase",
    async getAll() {
      // Публичная страница получает только факт брони (item_id), без имён.
      const { data, error } = await sb.from(TABLE).select("item_id");
      if (error) {
        console.error("Supabase getAll:", error.message);
        return {};
      }
      const map = {};
      data.forEach((r) => (map[r.item_id] = true));
      return map;
    },
    async reserve(itemId, name) {
      // item_id — PRIMARY KEY, поэтому вставка атомарна:
      // второй гость на ту же позицию получит ошибку дубликата.
      const { error } = await sb
        .from(TABLE)
        .insert({ item_id: itemId, name });
      if (error) return { ok: false, by: null }; // скорее всего уже занято
      return { ok: true };
    },
    async cancel(itemId) {
      const { error } = await sb.from(TABLE).delete().eq("item_id", itemId);
      if (error) console.error("Supabase cancel:", error.message);
      return { ok: !error };
    },
    onChange(cb) {
      sb.channel("bookings-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: TABLE },
          cb
        )
        .subscribe();
    },
    // — методы для админки/учёта —
    async logVisit(visitorId, ua) {
      const { error } = await sb
        .from(VISITS_TABLE)
        .insert({ visitor_id: visitorId, user_agent: ua });
      if (error) console.error("Supabase logVisit:", error.message);
    },
    async getVisits() {
      const { data, error } = await sb
        .from(VISITS_TABLE)
        .select("visitor_id,user_agent,created_at")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Supabase getVisits:", error.message);
        return [];
      }
      return data;
    },
    async getBookingsDetailed() {
      const { data, error } = await sb
        .from(TABLE)
        .select("item_id,name,created_at")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Supabase getBookingsDetailed:", error.message);
        return [];
      }
      return data;
    },
  };
}

// ── Выбор активного хранилища ──────────────────────────────────────
function pickStore() {
  const c = window.CONFIG || {};
  const ready =
    c.SUPABASE_URL &&
    c.SUPABASE_ANON_KEY &&
    window.supabase &&
    typeof window.supabase.createClient === "function";
  if (ready) {
    try {
      return makeSupabaseStore();
    } catch (e) {
      console.error("Не удалось инициализировать Supabase, fallback на local:", e);
    }
  }
  return LocalStore;
}

window.BookingStore = pickStore();
