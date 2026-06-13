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
  async reserve(itemId, name, ownerId) {
    const all = await this.getAll();
    if (all[itemId]) return { ok: false, by: all[itemId] };
    all[itemId] = name;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    const owners = JSON.parse(localStorage.getItem("birthday_owners") || "{}");
    owners[itemId] = ownerId;
    localStorage.setItem("birthday_owners", JSON.stringify(owners));
    return { ok: true };
  },
  async cancel(itemId) {
    const all = await this.getAll();
    delete all[itemId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return { ok: true };
  },
  async cancelOwn(itemId, ownerId) {
    const owners = JSON.parse(localStorage.getItem("birthday_owners") || "{}");
    if (owners[itemId] !== ownerId) return false;
    await this.cancel(itemId);
    delete owners[itemId];
    localStorage.setItem("birthday_owners", JSON.stringify(owners));
    return true;
  },
  async getMyItems(ownerId) {
    const owners = JSON.parse(localStorage.getItem("birthday_owners") || "{}");
    return Object.keys(owners).filter((k) => owners[k] === ownerId);
  },
  async rsvpSet(visitorId, name) {
    localStorage.setItem("birthday_rsvp", JSON.stringify({ visitorId, name }));
    return true;
  },
  async rsvpUnset() {
    localStorage.removeItem("birthday_rsvp");
    return true;
  },
  async rsvpGet() {
    const r = JSON.parse(localStorage.getItem("birthday_rsvp") || "null");
    return r ? r.name : null;
  },
  async getRsvps() {
    const r = JSON.parse(localStorage.getItem("birthday_rsvp") || "null");
    return r ? [{ name: r.name, created_at: new Date().toISOString() }] : [];
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
    client: sb, // доступ к auth для админки
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
    async reserve(itemId, name, ownerId) {
      // Атомарная бронь: факт + имя + владелец (visitor_id). false, если занято.
      const { data, error } = await sb.rpc("reserve_item", {
        p_item_id: itemId,
        p_name: name,
        p_owner_id: ownerId,
      });
      if (error) {
        console.error("Supabase reserve:", error.message);
        return { ok: false };
      }
      return { ok: data === true };
    },
    async cancelOwn(itemId, ownerId) {
      const { data, error } = await sb.rpc("cancel_own", {
        p_item_id: itemId,
        p_owner_id: ownerId,
      });
      if (error) {
        console.error("Supabase cancelOwn:", error.message);
        return false;
      }
      return data === true;
    },
    async getMyItems(ownerId) {
      const { data, error } = await sb.rpc("my_items", { p_owner_id: ownerId });
      if (error) {
        console.error("Supabase getMyItems:", error.message);
        return [];
      }
      return data || [];
    },
    async rsvpSet(visitorId, name) {
      const { error } = await sb.rpc("rsvp_set", {
        p_visitor_id: visitorId,
        p_name: name,
      });
      if (error) console.error("Supabase rsvpSet:", error.message);
      return !error;
    },
    async rsvpUnset(visitorId) {
      const { error } = await sb.rpc("rsvp_unset", { p_visitor_id: visitorId });
      if (error) console.error("Supabase rsvpUnset:", error.message);
      return !error;
    },
    async rsvpGet(visitorId) {
      const { data, error } = await sb.rpc("rsvp_get", { p_visitor_id: visitorId });
      if (error) {
        console.error("Supabase rsvpGet:", error.message);
        return null;
      }
      return data || null;
    },
    async getRsvps() {
      const { data, error } = await sb
        .from("rsvps")
        .select("name,created_at")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Supabase getRsvps:", error.message);
        return [];
      }
      return data;
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
      // Имена — из закрытой таблицы (видны только админу), время — из bookings.
      const [namesRes, bookingsRes] = await Promise.all([
        sb.from("booking_names").select("item_id,name"),
        sb.from(TABLE).select("item_id,created_at"),
      ]);
      if (namesRes.error || bookingsRes.error) {
        console.error(
          "Supabase getBookingsDetailed:",
          (namesRes.error || bookingsRes.error).message
        );
        return [];
      }
      const nameMap = {};
      namesRes.data.forEach((r) => (nameMap[r.item_id] = r.name));
      return bookingsRes.data
        .map((b) => ({
          item_id: b.item_id,
          name: nameMap[b.item_id] || "—",
          created_at: b.created_at,
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
