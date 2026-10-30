import { useEffect, useRef, useState } from "react";
import { Hash, ImagePlus, Link2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChatBottomSheet } from "@/components/chat/ChatBottomSheet";
import { useCreateFind } from "@/hooks/useDailyFinds";
import { normalizeTags } from "@/lib/dailyFind";
import { cn } from "@/lib/utils";
import { isSafeUrl } from "@/lib/linkParser";
import { validateImageFile } from "@/lib/uploadValidation";
import {
  composeDropContent,
  dropCaptionOverflow,
  pastedDropUrl,
} from "./composeDraft";
import { useDropSheetViewport } from "./useDropSheetViewport";
import "./dropSheets.css";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (id: string) => void;
  initial?: { title: string; url: string; note: string } | null;
}

export function ComposeFindSheet({
  open,
  onOpenChange,
  onCreated,
  initial,
}: Props) {
  const [caption, setCaption] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const seededInitial = useRef<Props["initial"]>();
  const submitLock = useRef(false);
  const create = useCreateFind();
  useDropSheetViewport(open);

  useEffect(() => {
    if (!open || !initial || seededInitial.current === initial) return;
    seededInitial.current = initial;
    setCaption(
      [initial.title, initial.note].filter(Boolean).join("\n").slice(0, 2161),
    );
    setUrl(initial.url);
    setShowLink(!!initial.url);
    setError("");
  }, [open, initial]);

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(image);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  const trimmedUrl = url.trim();
  const captionOverflow = dropCaptionOverflow(caption);
  const urlOk =
    !trimmedUrl || (/^https?:\/\//i.test(trimmedUrl) && isSafeUrl(trimmedUrl));
  const canSave =
    (!!caption.trim() || !!trimmedUrl || !!image) &&
    urlOk &&
    captionOverflow === 0 &&
    !create.isPending &&
    !submitting;
  const submit = () => {
    if (!canSave || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError("");
    const content = composeDropContent(caption, trimmedUrl, !!image);
    create.mutate(
      { ...content, url: trimmedUrl, tags: normalizeTags(tags), image },
      {
        onSuccess: ({ id }) => {
          toast.success("Shared with your club");
          setCaption("");
          setUrl("");
          setTags("");
          setImage(null);
          setShowLink(false);
          setShowTags(false);
          seededInitial.current = null;
          onOpenChange(false);
          onCreated?.(id);
        },
        onError: () =>
          setError("Couldn’t share this Drop. Your draft is ready to retry."),
        onSettled: () => {
          submitLock.current = false;
          setSubmitting(false);
        },
      },
    );
  };
  const busy = submitting || create.isPending;

  return (
    <ChatBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!submitLock.current) onOpenChange(next);
      }}
      title="New Drop"
      description="Share something with your club."
      mobileOnly={false}
      className="drop-page drop-sheet drop-social-sheet sm:left-1/2 sm:right-auto sm:w-[480px] sm:-translate-x-1/2"
    >
      <div className="space-y-3 px-1">
        <Textarea
          aria-label="Your Drop"
          disabled={busy}
          value={caption}
          onChange={(event) => {
            setCaption(event.target.value.slice(0, 2161));
            setError("");
          }}
          placeholder="What’s worth sharing?"
          rows={4}
          className="drop-compose-caption text-base"
          onPaste={(event) => {
            const pasted = pastedDropUrl(
              event.clipboardData.getData("text/plain"),
            );
            if (!pasted || trimmedUrl) return;
            event.preventDefault();
            setUrl(pasted);
            setShowLink(true);
            setError("");
          }}
        />
        {preview && (
          <div className="relative overflow-hidden rounded-xl border border-border/40">
            <img
              src={preview}
              alt="Photo ready to share"
              className="drop-compose-photo"
            />
            <button
              type="button"
              onClick={() => setImage(null)}
              aria-label="Remove photo"
              disabled={busy}
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {showLink && (
          <div className="flex items-center gap-2">
            <Input
              disabled={busy}
              ref={linkRef}
              aria-label="Drop link"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setError("");
              }}
              placeholder="Paste a link"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              className={cn(
                "h-11 flex-1 text-base",
                !urlOk && "border-destructive",
              )}
            />
            <button
              type="button"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-lg hover:bg-muted"
              onClick={() => {
                setUrl("");
                setShowLink(false);
              }}
              aria-label="Remove link"
              disabled={busy}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {!urlOk && (
          <p role="alert" className="text-sm text-destructive">
            Use a complete http or https link.
          </p>
        )}
        {captionOverflow > 0 && (
          <p role="alert" className="text-sm text-destructive">
            Trim {captionOverflow} characters before sharing.
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          aria-label="Choose Drop photo"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const result = validateImageFile(file, {
              maxBytes: 10 * 1024 * 1024,
              label: "Photo",
            });
            if (!result.ok) {
              setError(result.error || "Choose a supported photo under 10 MB.");
              return;
            }
            setImage(file);
            setError("");
          }}
        />
        <div className="drop-compose-tools border-t border-border/40 pt-2">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            aria-pressed={showLink}
            onClick={() => {
              setShowLink(true);
              window.setTimeout(() => linkRef.current?.focus(), 0);
            }}
          >
            <Link2 className="h-4 w-4" /> Link
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" /> {image ? "Change photo" : "Photo"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            aria-pressed={showTags}
            onClick={() => setShowTags((current) => !current)}
          >
            <Hash className="h-4 w-4" /> Tags
          </Button>
        </div>
        {showTags && (
          <Input
            disabled={busy}
            aria-label="Drop tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Add up to 5 tags"
            className="h-11 text-base"
          />
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <div className="drop-compose-publish">
          <Button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className="drop-primary h-12 w-full text-base font-bold"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sharing…
              </>
            ) : (
              "Share Drop"
            )}
          </Button>
        </div>
      </div>
    </ChatBottomSheet>
  );
}
