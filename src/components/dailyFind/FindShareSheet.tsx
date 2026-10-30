import { useEffect, useRef, useState } from "react";
import { Check, Link2, Loader2, MessageCircle, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { useClubAssets } from "@/hooks/useClubAssets";
import { Button } from "@/components/ui/button";
import { ChatBottomSheet } from "@/components/chat/ChatBottomSheet";
import type { Channel } from "@/components/chat/types";
import {
  buildFindShareMessage,
  buildFindShareUrl,
  type DailyFind,
} from "@/lib/dailyFind";
import { memberData } from "@/lib/memberData";
import { QUERY_TIMEOUT_MS, withTimeout } from "@/lib/asyncGuards";
import { useDropSheetViewport } from "./useDropSheetViewport";
import "./dropSheets.css";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  find: DailyFind;
}

export function FindShareSheet({ open, onOpenChange, find }: Props) {
  const { user } = useAuth();
  const { club, isClubAdmin } = useClub();
  const { isInstalled } = useClubAssets();
  const chatInstalled = isInstalled("chat");
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [channelError, setChannelError] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const sendLock = useRef(false);
  const deliveryId = useRef<string | null>(null);
  useDropSheetViewport(open);

  useEffect(() => {
    deliveryId.current = null;
    setError("");
  }, [find.id, selected]);
  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setError("");
    if (!chatInstalled || !club?.id) return;
    let cancelled = false;
    setLoading(true);
    setChannelError(false);
    void memberData(
      supabase
        .from("channels")
        .select("*")
        .eq("club_id", club.id)
        .order("position"),
      "Load share channels",
    )
      .then((data) => {
        if (cancelled) return;
        const available = (data as Channel[]).filter(
          (channel) =>
            !channel.archived_at &&
            (channel.channel_type !== "admin_only" || isClubAdmin) &&
            (channel.post_permission === "all" || isClubAdmin),
        );
        let preferred = "";
        try {
          preferred = localStorage.getItem("last_chat_channel_id") || "";
        } catch {
          /* Optional device preference. */
        }
        setChannels(available);
        setSelected((current) =>
          available.some((channel) => channel.id === current)
            ? current
            : available.find((channel) => channel.id === preferred)?.id ||
              available.find((channel) => channel.is_default)?.id ||
              available[0]?.id ||
              null,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setChannels([]);
          setSelected(null);
          setChannelError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, chatInstalled, club?.id, isClubAdmin, attempt]);

  const url = buildFindShareUrl(find.id);
  const toChat = async () => {
    if (!user || !club || !selected || sendLock.current) return;
    const channelId = selected;
    sendLock.current = true;
    setSending(true);
    setError("");
    try {
      const id = deliveryId.current || newMessageId();
      deliveryId.current = id;
      let created = true;
      const result = await withTimeout(
        supabase
          .from("messages")
          .insert({
            id,
            club_id: club.id,
            channel_id: channelId,
            user_id: user.id,
            content: buildFindShareMessage(find),
          })
          .select("id, channel_id, user_id, content")
          .single(),
        QUERY_TIMEOUT_MS,
        "Share Drop to Chat",
      );
      let data = result.data;
      if (result.error?.code === "23505") {
        // A retry after a lost acknowledgement confirms the same message.
        created = false;
        data = await memberData(
          supabase
            .from("messages")
            .select("id, channel_id, user_id, content")
            .eq("id", id)
            .eq("user_id", user.id)
            .eq("channel_id", channelId)
            .maybeSingle(),
          "Confirm shared Drop",
        );
      } else if (result.error) throw result.error;
      if (!data) throw new Error("Message unavailable");
      if (created)
        void supabase.functions
          .invoke("send-push-notification", { body: { record: data } })
          .catch(() => {});
      onOpenChange(false);
      navigate(
        `/chat?channel=${encodeURIComponent(channelId)}&message=${encodeURIComponent(data.id)}`,
      );
    } catch {
      setError("Couldn’t send to Chat. Try again.");
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  };

  const copyLink = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
    } catch {
      setError("Couldn’t copy the link. Try your device’s Share option.");
    }
  };
  const elsewhere = async () => {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: find.title,
        text: `The Drop: ${find.title}`,
        url,
      });
    } catch (shareError) {
      if (!(
        shareError instanceof DOMException && shareError.name === "AbortError"
      ))
        setError("Couldn’t open sharing. You can copy the link instead.");
    }
  };

  return (
    <ChatBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!sendLock.current) onOpenChange(next);
      }}
      title="Share Drop"
      description={find.title}
      mobileOnly={false}
      className="drop-page drop-sheet drop-social-sheet sm:left-1/2 sm:right-auto sm:w-[420px] sm:-translate-x-1/2"
    >
      <div className="space-y-4 px-1">
        {chatInstalled && (
          <section aria-label="Share to club Chat" className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <MessageCircle className="h-4 w-4" /> Send to your club
            </p>
            {loading ? (
              <div
                className="flex min-h-20 items-center justify-center"
                role="status"
                aria-label="Loading Chat channels"
              >
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : channelError ? (
              <div className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
                <p>Chat channels couldn’t load.</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-11"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Try again
                </Button>
              </div>
            ) : channels.length ? (
              <select
                aria-label="Drop chat channel"
                className="drop-share-channel"
                disabled={sending}
                value={selected || ""}
                onChange={(event) => setSelected(event.target.value)}
              >
                {channels.map((channel) => (
                  <option value={channel.id} key={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
                No channels are available for posting.
              </p>
            )}
            <Button
              type="button"
              onClick={toChat}
              disabled={!selected || sending || loading || channelError}
              className="drop-primary h-12 w-full"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <MessageCircle className="h-4 w-4" /> Send to Chat
                </>
              )}
            </Button>
          </section>
        )}
        <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-3">
          <Button
            type="button"
            variant="outline"
            className="h-12"
            disabled={sending}
            onClick={copyLink}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12"
            disabled={sending}
            onClick={elsewhere}
          >
            <Share2 className="h-4 w-4" /> Share…
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </ChatBottomSheet>
  );
}

function newMessageId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
