import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

// ── Write in-app notification rows (durable inbox, independent of push).
// Best-effort: never let an inbox write failure break push delivery. ──
type NotifRow = {
  user_id: string;
  club_id?: string | null;
  type: string;
  title: string;
  body?: string | null;
  url?: string | null;
  actor_user_id?: string | null;
};
async function insertNotifications(supabase: any, rows: NotifRow[]) {
  if (!rows.length) return;
  try {
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) console.error("notifications insert failed:", error.message);
  } catch (e) {
    console.error("notifications insert failed:", e);
  }
}

// ── Club-wide recipients: every member of the given club, or of every club the
// caller belongs to when no club_id is supplied. Used when a caller broadcasts
// (poll opened, celebrations, week open) without naming recipients. ──
async function clubBroadcastRecipients(
  supabase: any,
  clubId: string | null,
  callerId: string | null,
  isCron: boolean,
  isAdmin: boolean,
): Promise<{ userIds: string[]; clubId: string | null }> {
  let targetClub = clubId;

  if (!isCron && !isAdmin) {
    // A member may only broadcast inside clubs they belong to.
    const { data: mine } = await supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", callerId);
    const myClubs = new Set((mine || []).map((r: any) => r.club_id));
    if (myClubs.size === 0) return { userIds: [], clubId: null };
    if (targetClub && !myClubs.has(targetClub)) return { userIds: [], clubId: null };
    if (!targetClub && myClubs.size === 1) targetClub = [...myClubs][0] as string;
    if (!targetClub) return { userIds: [], clubId: null };
  }

  let query = supabase.from("club_members").select("user_id, club_id");
  if (targetClub) query = query.eq("club_id", targetClub);
  const { data: members } = await query;
  const userIds = [...new Set((members || []).map((m: any) => m.user_id).filter(Boolean))] as string[];
  return { userIds, clubId: targetClub };
}


// ── Send push to subscriptions, cleaning up expired ones ──
async function deliverPush(
  subscriptions: any[],
  payload: string,
  supabase: any,
): Promise<{ sent: number; expired: number; vapidMismatch: boolean }> {
  const expiredEndpoints: string[] = [];
  let sent = 0;
  let vapidMismatch = false;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;
    } catch (e: any) {
      const sc = typeof e?.statusCode === "number" ? e.statusCode : undefined;
      console.error("Push send error:", sc, e?.body);
      if (sc === 410 || sc === 404) expiredEndpoints.push(sub.endpoint);
      if (sc === 403) vapidMismatch = true;
    }
  }

  if (expiredEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
  }

  return { sent, expired: expiredEndpoints.length, vapidMismatch };
}

// ── THROTTLE CHECK: returns set of user_ids that were recently notified ──
async function getThrottledUsers(
  supabase: any,
  channelId: string,
  userIds: string[],
  windowSeconds = 60,
): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { data } = await supabase
    .from("push_throttle")
    .select("user_id")
    .eq("channel_id", channelId)
    .in("user_id", userIds)
    .gt("last_sent_at", cutoff);
  return new Set((data || []).map((r: any) => r.user_id));
}

// ── Update throttle timestamps ──
async function updateThrottle(supabase: any, channelId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const now = new Date().toISOString();
  const rows = userIds.map((uid) => ({ user_id: uid, channel_id: channelId, last_sent_at: now }));
  await supabase.from("push_throttle").upsert(rows, { onConflict: "user_id,channel_id" });
}

// ── ACTIVE VIEWER CHECK: users who read the channel in last 30s ──
async function getActiveViewers(
  supabase: any,
  channelId: string,
  userIds: string[],
): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - 30_000).toISOString();
  const { data } = await supabase
    .from("channel_read_states")
    .select("user_id")
    .eq("channel_id", channelId)
    .in("user_id", userIds)
    .gt("last_read_at", cutoff);
  return new Set((data || []).map((r: any) => r.user_id));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any = {};
    if (req.method !== "GET") {
      try { body = await req.json(); } catch { body = {}; }
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");

    // ── GET VAPID public key (intentionally public — needed before login to subscribe) ──
    if (req.method === "GET" || body?.action === "get_vapid_public_key") {
      if (!vapidPublicKey) return jsonResponse({ error: "VAPID public key is not configured" }, 500);
      return jsonResponse({ vapidPublicKey });
    }

    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing required push configuration" }, 500);
    }

    webpush.setVapidDetails("https://dryhorse.app", vapidPublicKey, vapidPrivateKey);
    const supabase = getSupabase();

    // ── Auth gate for any send/test action ──
    const authHeader = req.headers.get("Authorization");
    const cronSecret = req.headers.get("x-cron-secret") || "";
    const expectedCron = Deno.env.get("CRON_SHARED_SECRET") || "";
    const isCron = !!(expectedCron && cronSecret === expectedCron);

    let callerId: string | null = null;
    let isAdmin = false;
    if (!isCron) {
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      const { createClient: createUserClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
      const userClient = createUserClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
      callerId = user.id;
      const { data: adminRow } = await userClient.rpc("is_app_admin", { _user_id: user.id });
      isAdmin = !!adminRow;
    }

    // ══════════════════════════════════════════
    // ── TEST NOTIFICATION ──
    // ══════════════════════════════════════════
    if (body.test && body.user_id) {
      // Users can only test against themselves; admins/cron may target anyone.
      if (!isCron && !isAdmin && body.user_id !== callerId) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth, user_id")
        .eq("user_id", body.user_id);

      if (!subscriptions || subscriptions.length === 0) {
        return jsonResponse({ error: "No push subscription found. Make sure notifications are enabled." }, 404);
      }

      const testPayload = JSON.stringify({
        title: "🔔 Test Notification",
        body: "Push notifications are working!",
        data: { url: "/profile" },
        icon: "/pwa-icon-512.png",
      });

      const result = await deliverPush(subscriptions, testPayload, supabase);

      if (result.sent === 0) {
        return jsonResponse({
          sent: 0,
          expired: result.expired,
          error: result.vapidMismatch
            ? "Subscription key mismatch detected. Turn Push Notifications off and on, then try again."
            : "No notifications were delivered. Please re-enable Push Notifications and try again.",
          code: result.vapidMismatch ? "VAPID_MISMATCH" : "DELIVERY_FAILED",
        });
      }

      return jsonResponse({ sent: result.sent, expired: result.expired });
    }

    // ══════════════════════════════════════════
    // ── PERSONAL / TARGETED NOTIFICATIONS ──
    //   See ALLOWED_TYPES below for the full list of supported types.
    //   single recipient: target_user_id
    //   multi recipient:  target_user_ids[]   (deduped, sender excluded)
    // ══════════════════════════════════════════
    const ALLOWED_TYPES = new Set([
      "poll", "event", "draft", "lockbox", "thread_reply", "reaction",
      "portfolio_wars", "pickem", "rankings", "posts", "lore",
      "celebrations", "narrative", "brackets", "nexus", "runedelve", "readshift", "system",
    ]);

    if (body.type && ALLOWED_TYPES.has(body.type)) {
      const {
        type,
        title,
        message,
        url,
        tag: customTag,
        sender_user_id,
        target_user_id,
        target_user_ids,
        club_id,
      } = body;

      // Intended recipients (deduped, sender excluded) — computed from the
      // request, NOT from who has a push subscription, so the in-app inbox
      // reaches users who denied push too.
      let recipientIds: string[] = [];
      if (Array.isArray(target_user_ids) && target_user_ids.length > 0) {
        recipientIds = [...new Set(
          target_user_ids.filter((u: any) => typeof u === "string" && u && u !== sender_user_id)
        )];
      } else if (target_user_id) {
        if (!(sender_user_id && target_user_id === sender_user_id)) recipientIds = [target_user_id];
      }
      if (recipientIds.length === 0) {
        return jsonResponse({ sent: 0, filtered: 0, reason: "no_recipients" });
      }

      const userIds = recipientIds;
      // Map type -> notification_preferences column.
      const prefColumn =
        type === "poll" ? "polls" :
        type === "event" ? "events" :
        type === "lockbox" ? "lockbox" :
        type === "thread_reply" || type === "reaction" ? "chat_messages" :
        type === "portfolio_wars" ? "portfolio_wars" :
        type === "pickem" ? "pickem" :
        type === "rankings" ? "rankings" :
        type === "posts" ? "posts" :
        type === "lore" ? "lore" :
        type === "celebrations" ? "celebrations" :
        type === "narrative" ? "narrative" :
        type === "brackets" ? "brackets" :
        type === "nexus" ? "nexus" :
        type === "runedelve" ? "runedelve" :
        type === "readshift" ? "readshift" :
        type === "system" ? "system" :
        "drafts";

      const { data: prefRows } = await supabase
        .from("notification_preferences")
        .select(`user_id, ${prefColumn}`)
        .in("user_id", userIds);

      const disabledUsers = new Set(
        (prefRows || []).filter((p: any) => p[prefColumn] === false).map((p: any) => p.user_id),
      );

      // Recipients who haven't disabled this type — they get an inbox row
      // regardless of push subscription status.
      const enabled = userIds.filter((u: string) => !disabledUsers.has(u));
      if (enabled.length === 0) return jsonResponse({ sent: 0, filtered: userIds.length });

      await insertNotifications(supabase, enabled.map((uid: string) => ({
        user_id: uid,
        club_id: typeof club_id === "string" ? club_id : null,
        type,
        title: title || `New ${type}`,
        body: message || null,
        url: url || null,
        actor_user_id: sender_user_id || null,
      })));

      // Push delivery to the subset of enabled recipients that have subscriptions.
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth, user_id")
        .in("user_id", enabled);

      if (!subscriptions || subscriptions.length === 0) {
        return jsonResponse({ sent: 0, notified: enabled.length });
      }

      const payload = JSON.stringify({
        title: title || `New ${type}`,
        body: message || "",
        // Custom tag lets callers coalesce per-message bursts (e.g.
        // `dh-react-<msgId>` so 5 reactions on the same message become
        // one grouped notification via the SW's existing tag-grouping).
        tag: customTag || `dh-${type}`,
        data: { url: url || "/" },
        icon: "/pwa-icon-512.png",
      });

      const result = await deliverPush(subscriptions, payload, supabase);
      return jsonResponse({ sent: result.sent, expired: result.expired, notified: enabled.length });
    }

    // ══════════════════════════════════════════
    // ── CHAT MESSAGE NOTIFICATION ──
    // ══════════════════════════════════════════
    const record = body.record;
    if (!record?.id || !record?.channel_id || !record?.user_id || !record?.content) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const [{ data: sender }, { data: channel }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", record.user_id).single(),
      supabase.from("channels").select("name, club_id").eq("id", record.channel_id).single(),
    ]);

    const senderName = sender?.display_name || "Someone";
    const channelName = channel?.name || "chat";
    const preview = record.content.length > 80 ? record.content.slice(0, 80) + "…" : record.content;

    // Parse @mentions
    const mentionRe = /@([\w\s]+?)(?=\s@|\s|$)/g;
    const mentionedNames: string[] = [];
    let mentionMatch: RegExpExecArray | null;
    while ((mentionMatch = mentionRe.exec(record.content)) !== null) {
      mentionedNames.push(mentionMatch[1].trim().toLowerCase());
    }

    let mentionedUserIds = new Set<string>();
    if (mentionedNames.length > 0) {
      const { data: mentionedProfiles } = await supabase.from("profiles").select("id, display_name");
      if (mentionedProfiles) {
        for (const p of mentionedProfiles) {
          if (mentionedNames.includes(p.display_name.toLowerCase())) {
            mentionedUserIds.add(p.id);
          }
        }
      }
    }

    // A reply pings its referenced author like a mention (Discord-style): a
    // "replied to you" push that bypasses throttle/active-viewer and is gated
    // by the mentions preference. Snapshot true @-mentions first so the two
    // cases can be worded differently, then fold the reply author in so the
    // generic channel push excludes them (no double-notify).
    const textMentionIds = new Set(mentionedUserIds);
    const replyToAuthorId = typeof record.reply_to_author_id === "string" ? record.reply_to_author_id : undefined;
    if (replyToAuthorId && replyToAuthorId !== record.user_id) mentionedUserIds.add(replyToAuthorId);

    // ── In-app inbox for the *personal* chat notifications (mentions + reply).
    // Regular channel messages are intentionally NOT inbox'd (too noisy). This
    // runs over the intended recipients regardless of push subscription, gated
    // by the same mentions preference + channel mute the push path uses.
    {
      const personalTargets = [...new Set([...textMentionIds, ...(replyToAuthorId ? [replyToAuthorId] : [])])]
        .filter((u) => u && u !== record.user_id);
      if (personalTargets.length > 0) {
        const [{ data: pPrefs }, { data: pChan }] = await Promise.all([
          supabase.from("notification_preferences").select("user_id, mentions").in("user_id", personalTargets),
          supabase.from("channel_notification_prefs").select("user_id, mode").eq("channel_id", record.channel_id).in("user_id", personalTargets),
        ]);
        const mentionsOff = new Set((pPrefs || []).filter((p: any) => p.mentions === false).map((p: any) => p.user_id));
        const mutedFor = new Set((pChan || []).filter((p: any) => p.mode === "muted").map((p: any) => p.user_id));
        const inboxUrl = `/chat?channel=${record.channel_id}&message=${record.id}`;
        const rows = personalTargets
          .filter((u) => !mentionsOff.has(u) && !mutedFor.has(u))
          .map((u) => {
            const isReplyOnly = replyToAuthorId === u && !textMentionIds.has(u);
            return {
              user_id: u,
              club_id: (channel as any)?.club_id ?? null,
              type: isReplyOnly ? "reply" : "mention",
              title: isReplyOnly
                ? `${senderName} replied to you`
                : `${senderName} mentioned you in #${channelName}`,
              body: preview,
              url: inboxUrl,
              actor_user_id: record.user_id,
            };
          });
        await insertNotifications(supabase, rows);
      }
    }

    // Get all subscriptions except sender
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .neq("user_id", record.user_id);

    if (!subscriptions || subscriptions.length === 0) return jsonResponse({ sent: 0 });

    const allUserIds = [...new Set(subscriptions.map((s: any) => s.user_id))];

    // Check chat_messages + mentions preferences
    const { data: prefRows } = await supabase
      .from("notification_preferences")
      .select("user_id, chat_messages, mentions")
      .in("user_id", allUserIds);

    const chatDisabledUsers = new Set(
      (prefRows || []).filter((p: any) => p.chat_messages === false).map((p: any) => p.user_id),
    );
    const mentionsDisabledUsers = new Set(
      (prefRows || []).filter((p: any) => p.mentions === false).map((p: any) => p.user_id),
    );

    // Per-channel notification preference (overrides global chat_messages when set)
    const { data: channelPrefRows } = await supabase
      .from("channel_notification_prefs")
      .select("user_id, mode")
      .eq("channel_id", record.channel_id)
      .in("user_id", allUserIds);

    const channelModeByUser = new Map<string, string>();
    (channelPrefRows || []).forEach((r: any) => channelModeByUser.set(r.user_id, r.mode));

    // Active viewer suppression
    const activeViewers = await getActiveViewers(supabase, record.channel_id, allUserIds);

    // Throttle check (only for non-mentioned users)
    const throttledUsers = await getThrottledUsers(supabase, record.channel_id, allUserIds);

    // Filter subscriptions
    const filteredSubscriptions = subscriptions.filter((s: any) => {
      const uid = s.user_id;
      const isMentioned = mentionedUserIds.has(uid);
      const channelMode = channelModeByUser.get(uid); // 'all' | 'mentions' | 'muted' | undefined

      // Hard mute: skip everything from this channel
      if (channelMode === "muted") return false;

      // Channel set to mentions-only: only send if user is mentioned
      if (channelMode === "mentions" && !isMentioned) return false;

      // If mentioned but mentions preference is off, skip
      if (isMentioned && mentionsDisabledUsers.has(uid)) return false;

      // If mentioned (and mentions pref is on), always send (bypass throttle, active viewer, chat pref)
      if (isMentioned) return true;

      // Skip active viewers
      if (activeViewers.has(uid)) return false;

      // Skip if chat_messages disabled (global)
      if (chatDisabledUsers.has(uid)) return false;

      // Skip if throttled
      if (throttledUsers.has(uid)) return false;

      return true;
    });

    if (filteredSubscriptions.length === 0) {
      return jsonResponse({ sent: 0, filtered: subscriptions.length });
    }

    // Build separate payloads for @-mentioned / reply-target / regular users.
    const mentionSubs = filteredSubscriptions.filter((s: any) => textMentionIds.has(s.user_id));
    const replySubs = filteredSubscriptions.filter((s: any) => replyToAuthorId && s.user_id === replyToAuthorId && !textMentionIds.has(s.user_id));
    const regularSubs = filteredSubscriptions.filter((s: any) => !mentionedUserIds.has(s.user_id));

    let totalSent = 0;
    let totalExpired = 0;

    // Mention notifications — always show actual message
    if (mentionSubs.length > 0) {
      const mentionPayload = JSON.stringify({
        title: `${senderName} mentioned you in #${channelName}`,
        body: preview,
        tag: `dh-mention-${record.channel_id}`,
        data: { url: `/chat?channel=${record.channel_id}` },
        icon: "/pwa-icon-512.png",
      });
      const r = await deliverPush(mentionSubs, mentionPayload, supabase);
      totalSent += r.sent;
      totalExpired += r.expired;
    }

    // Reply notifications — the referenced author, worded as a reply
    if (replySubs.length > 0) {
      const replyPayload = JSON.stringify({
        title: `${senderName} replied to you`,
        body: preview,
        tag: `dh-reply-${record.channel_id}`,
        data: { url: `/chat?channel=${record.channel_id}` },
        icon: "/pwa-icon-512.png",
      });
      const r = await deliverPush(replySubs, replyPayload, supabase);
      totalSent += r.sent;
      totalExpired += r.expired;
    }

    // Regular chat notifications
    if (regularSubs.length > 0) {
      const chatPayload = JSON.stringify({
        title: `${senderName} in #${channelName}`,
        body: preview,
        tag: `dh-channel-${record.channel_id}`,
        data: { url: `/chat?channel=${record.channel_id}` },
        icon: "/pwa-icon-512.png",
      });
      const r = await deliverPush(regularSubs, chatPayload, supabase);
      totalSent += r.sent;
      totalExpired += r.expired;
    }

    // Update throttle for users who received regular (non-mention) pushes
    const sentRegularUserIds = [...new Set(regularSubs.map((s: any) => s.user_id))];
    await updateThrottle(supabase, record.channel_id, sentRegularUserIds);

    return jsonResponse({ sent: totalSent, expired: totalExpired });
  } catch (error: any) {
    console.error("Push notification error:", error);
    return jsonResponse({ error: error?.message ?? "Unknown error" }, 500);
  }
});
