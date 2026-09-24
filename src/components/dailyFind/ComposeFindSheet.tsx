import { useEffect, useRef, useState } from 'react';
import { BookOpen, Camera, ImagePlus, Lightbulb, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChatBottomSheet } from '@/components/chat/ChatBottomSheet';
import { useCreateFind } from '@/hooks/useDailyFinds';
import { FIND_KINDS, normalizeTags, type FindKind } from '@/lib/dailyFind';
import { cn } from '@/lib/utils';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (id: string) => void }

export function ComposeFindSheet({ open, onOpenChange, onCreated }: Props) {
  const [kind, setKind] = useState<FindKind>('learned');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const create = useCreateFind();

  useEffect(() => {
    if (!image) { setPreview(null); return; }
    const u = URL.createObjectURL(image);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [image]);

  const reset = () => { setKind('learned'); setTitle(''); setNote(''); setUrl(''); setTags(''); setImage(null); };
  const prompt = FIND_KINDS.find(k => k.value === kind)?.prompt ?? 'What is worth saving today?';
  const KIND_ICON = { learned: Lightbulb, article: BookOpen, photo: Camera } as const;
  const urlOk = !url.trim() || /^https?:\/\/\S+\.\S+/.test(url.trim());
  const canSave = title.trim().length > 0 && urlOk && (kind !== 'photo' || !!image) && !create.isPending;

  const submit = () => {
    if (!canSave) return;
    create.mutate({ kind, title, note, url, tags: normalizeTags(tags), image }, {
       onSuccess: ({ id }) => { toast.success("Today's Drop is in"); reset(); onOpenChange(false); onCreated?.(id); },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <ChatBottomSheet open={open} onOpenChange={onOpenChange} title="Add Today's Drop" description="Leave one thing worth saving in the club collection." mobileOnly={false} className="drop-page drop-sheet sm:left-1/2 sm:right-auto sm:w-[480px] sm:-translate-x-1/2">
      <div className="space-y-3 px-1">
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-border/40 bg-muted/30 p-1" role="radiogroup" aria-label="Drop type">
          {FIND_KINDS.map(k => {
            const Icon = KIND_ICON[k.value];
            return (
            <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} onClick={() => setKind(k.value)}
              className={cn('flex h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-all', kind === k.value ? 'bg-background text-[hsl(var(--drop-accent))] shadow-sm' : 'text-muted-foreground')}>
              <Icon className="h-4 w-4" /> {k.label}
            </button>
          )})}
        </div>

        <Input value={title} onChange={e => setTitle(e.target.value.slice(0, 160))} placeholder={prompt} className="h-12 text-base font-semibold" autoFocus />
        <Textarea value={note} onChange={e => setNote(e.target.value.slice(0, 2000))} placeholder="Quick note (optional)" rows={3} />
        {kind !== 'photo' && (
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="Link (optional) — https://…" inputMode="url"
            className={cn(!urlOk && 'border-destructive')} />
        )}

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { setImage(e.target.files?.[0] ?? null); e.target.value = ''; }} />
        {preview ? (
          <div className="relative overflow-hidden rounded-xl">
            <img src={preview} alt="" className="max-h-60 w-full object-cover" />
            <button type="button" onClick={() => setImage(null)} aria-label="Remove photo" className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/90">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="h-12 w-full border-dashed">
             <ImagePlus /> {kind === 'photo' ? 'Add photo or screenshot' : 'Add image (optional)'}
          </Button>
        )}

        <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="Tags — science, history, food" />

        <Button type="button" onClick={submit} disabled={!canSave} className="h-12 w-full text-base font-bold">
           {create.isPending ? <Loader2 className="animate-spin" /> : <><span className="drop-mini-mark">D</span> Place in collection</>}
        </Button>
      </div>
    </ChatBottomSheet>
  );
}
