import {
  Bookmark,
  BookOpen,
  CalendarDays,
  Compass,
  Flame,
  GitBranch,
  Goal,
  KeyRound,
  ListOrdered,
  MessageSquare,
  ScanEye,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  Vote,
} from "lucide-react";
const icons = {
  Bookmark,
  BookOpen,
  CalendarDays,
  Compass,
  Flame,
  GitBranch,
  Goal,
  KeyRound,
  ListOrdered,
  MessageSquare,
  ScanEye,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  Vote,
};
export function FeatIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = icons[name as keyof typeof icons] || Sparkles;
  return <Icon size={size} aria-hidden="true" />;
}
export function FeatCrest({ level = 1 }: { level?: number }) {
  return (
    <span className="dh-crest" data-level={level} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <path
          className="dh-crest-orbit"
          d="M50 4 90 27 90 73 50 96 10 73 10 27Z"
        />
        <path d="M50 11 84 30 84 70 50 89 16 70 16 30Z" />
        <path d="M50 20 76 35 76 65 50 80 24 65 24 35Z" />
      </svg>
      <Trophy size={29} />
      <small>{String(level).padStart(2, "0")}</small>
    </span>
  );
}
