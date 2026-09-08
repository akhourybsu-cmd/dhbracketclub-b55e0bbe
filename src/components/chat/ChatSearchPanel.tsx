import { Hash, Loader2, Search, SearchX, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { UserAvatar } from './UserAvatar';
import type { Channel, Message } from './types';
import { chatMessagePreview } from '@/lib/chatExperience';

export type ChatSearchScope = 'channel' | 'all';

interface ChatSearchPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  scope: ChatSearchScope;
  onScopeChange: (scope: ChatSearchScope) => void;
  currentChannel: Channel;
  channels: Channel[];
  results: Message[];
  loading: boolean;
  onSelectResult: (message: Message) => void;
  onClose: () => void;
}

function HighlightedSnippet({ content, query }: { content: string; query: string }) {
  const preview = chatMessagePreview(content, 220);
  const needle = query.trim();
  if (!needle) return <>{preview}</>;
  const index = preview.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) return <>{preview}</>;
  return (
    <>
      {preview.slice(0, index)}
      <mark className="rounded-sm bg-primary/20 px-0.5 text-foreground">{preview.slice(index, index + needle.length)}</mark>
      {preview.slice(index + needle.length)}
    </>
  );
}

export function ChatSearchPanel({
  query,
  onQueryChange,
  scope,
  onScopeChange,
  currentChannel,
  channels,
  results,
  loading,
  onSelectResult,
  onClose,
}: ChatSearchPanelProps) {
  const channelNames = new Map(channels.map(channel => [channel.id, channel.name]));
  const ready = query.trim().length >= 2;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Search chat messages">
      <div className="border-b border-border/15 px-3 py-3 sm:px-5">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
              <Input
                value={query}
                onChange={event => onQueryChange(event.target.value)}
                placeholder="Search messages"
                aria-label="Search messages"
                autoFocus
                className="chat-mobile-input h-11 rounded-xl border-border/25 bg-muted/25 pl-10 pr-10 text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => onQueryChange('')}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-muted/40"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground"
              aria-label="Close search"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-2 flex items-center gap-1 rounded-xl bg-muted/15 p-1" role="group" aria-label="Search scope">
            {([
              ['channel', `#${currentChannel.name}`],
              ['all', 'All channels'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onScopeChange(value)}
                className={cn(
                  'min-h-9 flex-1 rounded-lg px-3 text-[11px] font-bold transition-colors',
                  scope === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/65 hover:text-foreground/85',
                )}
                aria-pressed={scope === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
        <div className="mx-auto w-full max-w-[760px]">
          {!ready && (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Search className="h-6 w-6 text-primary/70" />
              </div>
              <h3 className="text-sm font-bold">Find anything your club shared</h3>
              <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-muted-foreground/65">
                Search conversations, links, filenames, mentions, and shared notes. Enter at least two characters.
              </p>
              <span className="mt-4 hidden rounded-md border border-border/25 bg-muted/20 px-2 py-1 font-mono text-[9px] text-muted-foreground/55 sm:inline-flex">
                Ctrl / ⌘ + K
              </span>
            </div>
          )}

          {ready && loading && (
            <div className="flex min-h-[220px] items-center justify-center gap-2 text-xs font-semibold text-muted-foreground/65">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching messages…
            </div>
          )}

          {ready && !loading && results.length === 0 && (
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <SearchX className="mb-3 h-8 w-8 text-muted-foreground/30" />
              <h3 className="text-sm font-bold">No messages found</h3>
              <p className="mt-1 text-[11px] text-muted-foreground/65">Try another phrase or search all channels.</p>
            </div>
          )}

          {ready && !loading && results.length > 0 && (
            <>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/55">
                  {results.length} result{results.length === 1 ? '' : 's'}
                </p>
                <p className="text-[10px] text-muted-foreground/45">Newest first</p>
              </div>
              <div className="space-y-1.5">
                {results.map(message => (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => onSelectResult(message)}
                    className="group flex w-full gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-colors hover:border-border/20 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <UserAvatar
                      userId={message.user_id}
                      name={message.profiles?.display_name || '?'}
                      avatarUrl={message.profiles?.avatar_url}
                      size={34}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[12px] font-bold text-foreground/90">{message.profiles?.display_name || 'Member'}</span>
                        <span className="text-[10px] text-muted-foreground/50">{format(new Date(message.created_at), 'MMM d, yyyy · h:mm a')}</span>
                        {scope === 'all' && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary/75">
                            <Hash className="h-2.5 w-2.5" /> {channelNames.get(message.channel_id) || 'channel'}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-foreground/75">
                        <HighlightedSnippet content={message.content} query={query} />
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
