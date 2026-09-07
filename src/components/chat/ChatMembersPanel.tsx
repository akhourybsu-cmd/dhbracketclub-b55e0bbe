import { useMemo, useState } from 'react';
import { Crown, Search, UsersRound, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { UserAvatar } from './UserAvatar';
import type { MentionMember } from './MessageComposer';

interface ChatMembersPanelProps {
  members: MentionMember[];
  onlineUserIds: Set<string>;
  currentUserId?: string;
  onClose?: () => void;
}

function MemberRow({ member, online, current }: { member: MentionMember; online: boolean; current: boolean }) {
  return (
    <div className="group flex min-h-12 items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted/25">
      <UserAvatar
        userId={member.id}
        name={member.display_name}
        avatarUrl={member.avatar_url}
        size={34}
        isOnline={online}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('truncate text-[13px] font-semibold', online ? 'text-foreground/90' : 'text-muted-foreground/70')}>
            {member.display_name}
          </span>
          {current && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-primary">
              You
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/55">
          {member.role === 'admin' && <Crown className="h-2.5 w-2.5 text-premium-warm" aria-hidden="true" />}
          <span>{member.role === 'admin' ? 'Club admin' : online ? 'Online' : 'Offline'}</span>
        </div>
      </div>
    </div>
  );
}

export function ChatMembersPanel({ members, onlineUserIds, currentUserId, onClose }: ChatMembersPanelProps) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return [...members]
      .filter(member => !normalized || member.display_name.toLowerCase().includes(normalized))
      .sort((a, b) => {
        const onlineDelta = Number(onlineUserIds.has(b.id)) - Number(onlineUserIds.has(a.id));
        if (onlineDelta) return onlineDelta;
        const roleDelta = Number(b.role === 'admin') - Number(a.role === 'admin');
        if (roleDelta) return roleDelta;
        return a.display_name.localeCompare(b.display_name);
      });
  }, [members, normalized, onlineUserIds]);

  const online = filtered.filter(member => onlineUserIds.has(member.id));
  const offline = filtered.filter(member => !onlineUserIds.has(member.id));

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-background/70">
      <div className="flex min-h-14 items-center gap-2 border-b border-border/15 px-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <UsersRound className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold tracking-tight">Members</h3>
          <p className="text-[10px] font-medium text-muted-foreground/60">
            {onlineUserIds.size} online · {members.length} total
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground/65 transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label="Close member list"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="border-b border-border/10 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/45" />
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Find a member"
            aria-label="Find a member"
            className="h-9 rounded-xl border-border/20 bg-muted/20 pl-9 pr-8 text-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground/55 hover:bg-muted/40"
              aria-label="Clear member search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
        {online.length > 0 && (
          <section className="mb-4" aria-labelledby="online-members-heading">
            <h4 id="online-members-heading" className="mb-1 px-2 text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/55">
              Online — {online.length}
            </h4>
            {online.map(member => (
              <MemberRow key={member.id} member={member} online current={member.id === currentUserId} />
            ))}
          </section>
        )}

        {offline.length > 0 && (
          <section aria-labelledby="offline-members-heading">
            <h4 id="offline-members-heading" className="mb-1 px-2 text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/55">
              Offline — {offline.length}
            </h4>
            {offline.map(member => (
              <MemberRow key={member.id} member={member} online={false} current={member.id === currentUserId} />
            ))}
          </section>
        )}

        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center">
            <UsersRound className="mx-auto mb-2 h-7 w-7 text-muted-foreground/25" />
            <p className="text-xs font-semibold text-muted-foreground/65">No members found</p>
          </div>
        )}
      </div>
    </aside>
  );
}
