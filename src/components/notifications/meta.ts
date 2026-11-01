import {
  Bell, AtSign, Reply, Heart, Bookmark, CalendarDays, MessageCircle, BarChart3,
  FileText, ScrollText, Cake, BookOpen, Trophy, TrendingUp, Lock, Shield,
  Sparkles, VenetianMask, Brackets as BracketsIcon, Flame, Gem, Pickaxe,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// notification `type` → icon + accent token (mirrors the app's feature palette).
export const NOTIF_META: Record<string, { icon: LucideIcon; color: string }> = {
  mention: { icon: AtSign, color: 'primary' },
  reply: { icon: Reply, color: 'primary' },
  reaction: { icon: Heart, color: 'destructive' },
  draft: { icon: Bookmark, color: 'gold' },
  showdown: { icon: Gem, color: 'primary' },
  deep_claim: { icon: Pickaxe, color: 'warning' },
  poll: { icon: MessageCircle, color: 'warning' },
  event: { icon: CalendarDays, color: 'success' },
  posts: { icon: FileText, color: 'primary' },
  lore: { icon: ScrollText, color: 'accent-foreground' },
  celebrations: { icon: Cake, color: 'warning' },
  narrative: { icon: BookOpen, color: 'primary' },
  rankings: { icon: BarChart3, color: 'accent-foreground' },
  brackets: { icon: BracketsIcon, color: 'primary' },
  pickem: { icon: Trophy, color: 'gold' },
  portfolio_wars: { icon: TrendingUp, color: 'success' },
  lockbox: { icon: Lock, color: 'destructive' },
  nexus: { icon: Shield, color: 'primary' },
  runedelve: { icon: Sparkles, color: 'success' },
  readshift: { icon: VenetianMask, color: 'primary' },
  forge: { icon: Flame, color: 'warning' },
  system: { icon: Bell, color: 'primary' },
};

export function notifIcon(type: string): { icon: LucideIcon; color: string } {
  return NOTIF_META[type] ?? { icon: Bell, color: 'primary' };
}
