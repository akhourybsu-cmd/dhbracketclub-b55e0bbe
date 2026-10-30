// Isolated Drop backend, derived from the shared chat transport. No live writes.
const profiles = [
  { id: "member", display_name: "Alex", avatar_url: null },
  { id: "jordan", display_name: "Jordan", avatar_url: null },
  { id: "sammy", display_name: "Sam", avatar_url: null },
  { id: "morgan", display_name: "Morgan", avatar_url: null },
];
const now = Date.now();
const iso = (minutes = 0) => new Date(now - minutes * 60_000).toISOString();
const channel = (id: string, name: string, extra = {}) => ({
  id,
  name,
  club_id: "club",
  description: null,
  icon: null,
  category_id: "clubhouse",
  position: 0,
  is_default: false,
  channel_type: "general",
  post_permission: "all",
  archived_at: null,
  ...extra,
});
const messages = Array.from({ length: 82 }, (_, n) => ({
  id: `message-${String(n).padStart(3, "0")}`,
  channel_id: "general",
  user_id: n % 5 === 0 ? "member" : n % 3 === 0 ? "sammy" : "jordan",
  content: [
    "Who’s in for the watch party on Sunday?",
    "I’m in. I’ll bring something for the grill.",
    "Perfect. First game at 1, let’s meet at noon.",
    "**Locked in.** This is going to be a good one.",
    "That last round was unreal 😂",
  ][n % 5],
  parent_message_id: null,
  is_pinned: n === 74,
  created_at: iso((82 - n) * 4),
  edited_at: null,
  reply_to_id: n === 79 ? "message-078" : null,
}));
messages.push({
  id: "sports-message",
  channel_id: "sports",
  user_id: "sammy",
  content: "@Alex who are you taking tonight?",
  parent_message_id: null,
  is_pinned: false,
  created_at: iso(2),
  edited_at: null,
  reply_to_id: null,
});
messages.push({
  id: "news-message",
  channel_id: "news",
  user_id: "morgan",
  content: "The next club draft opens Friday. Get your picks ready.",
  parent_message_id: null,
  is_pinned: true,
  created_at: iso(20),
  edited_at: null,
  reply_to_id: null,
});
const tables: Record<string, any[]> = {
  profiles,
  channels: [
    channel("general", "general", {
      description: "The club, between games.",
      is_default: true,
      icon: "💬",
    }),
    channel("sports", "sports", { position: 1, icon: "🏀" }),
    channel("news", "announcements", {
      position: 2,
      channel_type: "announcements",
      post_permission: "admins",
    }),
    channel("weekend", "weekend-plans", {
      category_id: "off-clock",
      icon: "📍",
      description: "Make something happen.",
    }),
    channel("empty", "recommendations", {
      category_id: "off-clock",
      position: 1,
    }),
  ],
  channel_categories: [
    { id: "clubhouse", name: "Clubhouse", position: 0 },
    { id: "off-clock", name: "Off the clock", position: 1 },
  ],
  club_members: profiles.map((p) => ({
    user_id: p.id,
    club_id: "club",
    role: "member",
  })),
  messages,
  message_reactions: [
    {
      id: "reaction-1",
      message_id: "message-079",
      user_id: "sammy",
      emoji: "🔥",
    },
    {
      id: "reaction-2",
      message_id: "message-079",
      user_id: "member",
      emoji: "🔥",
    },
  ],
  channel_read_states: [
    {
      id: "read-general",
      channel_id: "general",
      user_id: "member",
      last_read_at: iso(35),
    },
  ],
  notifications: [],
  notification_preferences: [],
  channel_notification_prefs: [],
  message_link_previews: [],
  dh_feat_accounts: [],
};
type Handler = { type: string; opts: any; callback: (p: any) => void };
const presenceStates: Record<string, Record<string, unknown[]>> = {};
const listeners = new Set<{
  handlers: Handler[];
  name: string;
  status?: (status: string) => void;
}>();
export const qa = {
  tables,
  writes: [] as any[],
  queries: [] as any[],
  failTables: ((window as any).__chatFailTables || []) as string[],
  failPreviews: Boolean((window as any).__chatFailPreviews),
  failSend: false,
  failPost: false,
  failReact: false,
  failComment: false,
  failFeed: Boolean((window as any).__dropFailFeed),
  failUpload: false,
  delayReactions: 0,
  delayMessages: 0,
  presence(name: string, state: Record<string, unknown[]>) {
    presenceStates[name] = state;
    for (const listener of listeners)
      if (listener.name === name)
        listener.handlers
          .filter((h) => h.type === "presence")
          .forEach((h) => h.callback({}));
  },
  status(name: string, status: string) {
    for (const listener of listeners)
      if (listener.name === name) listener.status?.(status);
  },
  emit(table: string, event: string, row: any) {
    if (
      event === "INSERT" &&
      !(tables[table] || []).some((r) => r.id === row.id)
    )
      (tables[table] ||= []).push(row);
    for (const sub of listeners)
      for (const h of sub.handlers)
        if (
          h.type === "postgres_changes" &&
          h.opts.table === table &&
          (h.opts.event === event || h.opts.event === "*")
        ) {
          if (h.opts.filter) {
            const [key, , value] = h.opts.filter.split(/[.=]/);
            if (row[key] !== value) continue;
          }
          h.callback(
            event === "DELETE" ? { old: row, new: {} } : { new: row, old: {} },
          );
        }
  },
};
Object.assign(window, { dropQa: qa });
function from(table: string) {
  let filters: Array<(r: any) => boolean> = [],
    sorts: Array<{ key: string; ascending: boolean }> = [],
    limit = Infinity,
    single = false,
    verb = "select",
    body: any,
    cols = "*",
    conflict: string[] = [];
  const builder: any = {
    select(value = "*") {
      cols = value;
      return builder;
    },
    abortSignal() {
      return builder;
    },
    contains(key: string, values: any[]) {
      filters.push((row) =>
        values.every((value) => (row[key] || []).includes(value)),
      );
      return builder;
    },
    eq(key: string, value: any) {
      filters.push((r) => r[key] === value);
      return builder;
    },
    neq(key: string, value: any) {
      filters.push((r) => r[key] !== value);
      return builder;
    },
    in(key: string, values: any[]) {
      filters.push((r) => values.includes(r[key]));
      return builder;
    },
    is(key: string, value: any) {
      filters.push((r) => (r[key] ?? null) === value);
      return builder;
    },
    lt(key: string, value: any) {
      filters.push((r) => r[key] < value);
      return builder;
    },
    lte(key: string, value: any) {
      filters.push((r) => r[key] <= value);
      return builder;
    },
    gt(key: string, value: any) {
      filters.push((r) => r[key] > value);
      return builder;
    },
    gte(key: string, value: any) {
      filters.push((r) => r[key] >= value);
      return builder;
    },
    ilike(key: string, value: string) {
      filters.push((r) =>
        String(r[key] || "")
          .toLowerCase()
          .includes(value.replace(/%/g, "").toLowerCase()),
      );
      return builder;
    },
    order(key: string, opts = { ascending: true }) {
      sorts.push({ key, ascending: opts.ascending });
      return builder;
    },
    limit(n: number) {
      limit = n;
      return builder;
    },
    range(_start: number, end: number) {
      limit = end + 1;
      return builder;
    },
    maybeSingle() {
      single = true;
      return builder;
    },
    single() {
      single = true;
      return builder;
    },
    update(value: any) {
      verb = "update";
      body = value;
      return builder;
    },
    delete() {
      verb = "delete";
      return builder;
    },
    insert(value: any) {
      verb = "insert";
      body = value;
      return builder;
    },
    upsert(value: any, options: any = {}) {
      verb = "upsert";
      body = value;
      conflict = (options.onConflict || "id").split(",");
      return builder;
    },
    or(value: string) {
      const term = value.match(/title\.ilike\.%([^%]*)%/);
      if (term)
        filters.push((row) =>
          [row.title, row.note].some((text) =>
            String(text || "")
              .toLowerCase()
              .includes(term[1].toLowerCase()),
          ),
        );
      const parts = value.match(/created_at\.(lt|gt)\.([^,)]+)/),
        id = value.match(/id\.(lt|gt)\.([^,)]+)/);
      if (parts)
        filters.push(
          (r) =>
            (parts[1] === "lt"
              ? r.created_at < parts[2]
              : r.created_at > parts[2]) ||
            (r.created_at === parts[2] &&
              id &&
              (id[1] === "lt" ? r.id < id[2] : r.id > id[2])),
        );
      return builder;
    },
    then(resolve: any, reject: any) {
      return run().then(resolve, reject);
    },
  };
  async function run() {
    qa.queries.push({ table, verb, cols });
    if (table === "message_reactions" && qa.delayReactions)
      await new Promise((r) => setTimeout(r, qa.delayReactions));
    if (table === "messages" && qa.delayMessages)
      await new Promise((r) => setTimeout(r, qa.delayMessages));
    if (
      qa.failTables.includes(table) ||
      (qa.failFeed && table === "daily_finds" && verb === "select") ||
      (qa.failPost && table === "daily_finds" && verb === "insert") ||
      (qa.failReact && table === "daily_find_reactions") ||
      (qa.failComment &&
        table === "daily_find_comments" &&
        verb === "insert") ||
      (qa.failPreviews &&
        table === "messages" &&
        cols
          .replace(/\s/g, "")
          .startsWith("channel_id,content,created_at,user_id")) ||
      (table === "messages" && verb === "insert" && qa.failSend)
    )
      return {
        data: null,
        error: { message: "Connection interrupted. Please try again." },
      };
    let rows = (tables[table] || []).filter((r) =>
      filters.every((filter) => filter(r)),
    );
    if (verb !== "select") {
      qa.writes.push({ table, verb, body: structuredClone(body) });
      if (verb === "upsert") {
        rows = (Array.isArray(body) ? body : [body]).map((value) => {
          const existing = (tables[table] || []).find((row) =>
            conflict.every((key) => row[key] === value[key]),
          );
          if (existing) {
            Object.assign(existing, value);
            return existing;
          }
          const row = { id: crypto.randomUUID(), ...value };
          (tables[table] ||= []).push(row);
          return row;
        });
      } else if (verb === "insert") {
        rows = (Array.isArray(body) ? body : [body]).map((r) => ({
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          parent_message_id: null,
          is_pinned: false,
          edited_at: null,
          ...r,
        }));
        (tables[table] ||= []).push(...rows);
      } else if (verb === "update") rows.forEach((r) => Object.assign(r, body));
      else
        tables[table] = (tables[table] || []).filter((r) => !rows.includes(r));
    }
    rows = [...rows]
      .sort((a, b) => {
        for (const s of sorts) {
          const d = String(a[s.key] ?? "").localeCompare(
            String(b[s.key] ?? ""),
          );
          if (d) return s.ascending ? d : -d;
        }
        return 0;
      })
      .slice(0, limit);
    if (table === "messages")
      rows = rows.map((r) => ({
        ...r,
        profiles: profiles.find((p) => p.id === r.user_id),
      }));
    if (table === "daily_finds")
      rows = rows.map((row) => ({
        ...row,
        profiles: profiles.find((profile) => profile.id === row.user_id),
        reactions: (tables.daily_find_reactions || []).filter(
          (reaction) => reaction.find_id === row.id,
        ),
        comments: [
          {
            count: (tables.daily_find_comments || []).filter(
              (comment) => comment.find_id === row.id,
            ).length,
          },
        ],
      }));
    if (table === "daily_find_comments")
      rows = rows.map((row) => ({
        ...row,
        profiles: profiles.find((profile) => profile.id === row.user_id),
      }));
    return {
      data: single ? (rows[0] ?? null) : structuredClone(rows),
      error: null,
      count: rows.length,
    };
  }
  return builder;
}
export const supabase = {
  from,
  rpc: async (name: string) => ({
    data:
      name === "dh_presence_directory"
        ? profiles
        : name === "dh_feats_summary"
          ? { score: 0, unlocked: 0 }
          : [],
    error: null,
  }),
  functions: { invoke: async () => ({ data: null, error: null }) },
  storage: {
    from: () => ({
      upload: async (path: string) => {
        qa.writes.push({ table: "storage", path });
        return {
          data: { path },
          error: qa.failUpload ? { message: "Upload interrupted" } : null,
        };
      },
      createSignedUrl: async () => ({ data: null, error: null }),
    }),
  },
  channel: (name: string) => {
    const sub: {
      name: string;
      handlers: Handler[];
      status?: (status: string) => void;
    } = { name, handlers: [] };
    listeners.add(sub);
    const api: any = {
      on(type: string, opts: any, callback: any) {
        sub.handlers.push({ type, opts, callback });
        return api;
      },
      subscribe(cb: any) {
        sub.status = cb;
        queueMicrotask(() => {
          cb?.("SUBSCRIBED");
          sub.handlers
            .filter((h) => h.type === "presence")
            .forEach((h) => h.callback({}));
        });
        return api;
      },
      track: async () => {},
      presenceState: () =>
        presenceStates[name] ||
        (name.startsWith("typing-")
          ? {}
          : {
              member: [{ user_id: "member" }],
              jordan: [{ user_id: "jordan" }],
            }),
      unsubscribe: async () => {},
      __sub: sub,
    };
    return api;
  },
  removeChannel: (channel: any) => {
    listeners.delete(channel.__sub);
    return Promise.resolve();
  },
};

const dropId = (number: number) =>
  "10000000-0000-4000-8000-" + String(number).padStart(12, "0");
tables.daily_finds = Array.from({ length: 65 }, (_, index) => ({
  id: dropId(65 - index),
  club_id: "club",
  user_id: index % 3 === 0 ? "member" : index % 2 ? "jordan" : "sammy",
  find_date: new Date(now - Math.floor(index / 3) * 60000)
    .toISOString()
    .slice(0, 10),
  created_at: new Date(now - Math.floor(index / 3) * 60000).toISOString(),
  updated_at: new Date(now).toISOString(),
  kind: index < 3 ? "article" : index === 3 ? "photo" : "learned",
  title: [
    "A little something for the weekend",
    "This made my morning",
    "Worth watching together",
    "Out on the trail",
    "A good idea worth sharing",
  ][index % 5],
  note:
    index === 0
      ? "One for the group chat. What do you think?"
      : index === 4
        ? "Keep it simple. Find a good spot, bring good company, and make a little time."
        : null,
  url:
    index === 0
      ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      : index === 1
        ? "https://www.youtube.com/shorts/aqz-KE-bpKQ"
        : index === 2
          ? location.origin + "/__drop-video.mp4"
          : null,
  image_path: index === 3 ? "club/member/photo.jpg" : null,
  tags: index % 5 === 0 ? ["weekend"] : [],
}));
tables.daily_find_reactions = [
  { id: dropId(201), find_id: dropId(65), emoji: "❤️", user_id: "jordan" },
];
tables.daily_find_comments = [
  {
    id: dropId(301),
    find_id: dropId(65),
    user_id: "sammy",
    body: "Absolutely in.",
    created_at: new Date(now).toISOString(),
  },
];
(supabase.functions as any).invoke = async (name: string) => ({
  data:
    name === "fetch-link-preview"
      ? {
          title: "A clip worth sharing",
          description: "A quick watch for the club.",
          image_url: location.origin + "/__drop-photo.svg",
          site_name: "Club links",
        }
      : null,
  error: null,
});
const originalStorage = supabase.storage.from;
(supabase.storage as any).from = () => ({
  ...originalStorage(),
  createSignedUrl: async () => ({
    data: { signedUrl: location.origin + "/__drop-photo.svg" },
    error: null,
  }),
});
