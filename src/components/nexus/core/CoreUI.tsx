import {
  ArrowRight,
  BatteryCharging,
  Check,
  ChevronLeft,
  Crosshair,
  Heart,
  HeartPulse,
  Hexagon,
  Orbit,
  Radar,
  Shield,
  Snowflake,
  Sparkles,
  Split,
  Star,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useNexusCore } from "@/hooks/useNexusCore";
import { CoreSigil } from "./CoreArtwork";
import type { ReactNode } from "react";

const icons = {
  BatteryCharging,
  Crosshair,
  Heart,
  HeartPulse,
  Hexagon,
  Orbit,
  Radar,
  Shield,
  Snowflake,
  Sparkles,
  Split,
  Zap,
};
export function CoreIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = icons[name as keyof typeof icons] || Hexagon;
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}
export function CoreHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="nc-heading">
      <div className="nc-eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
export function CoreBack({
  to = "/nexus",
  children = "Home",
}: {
  to?: string;
  children?: ReactNode;
}) {
  return (
    <Link className="nc-back" to={to}>
      <ChevronLeft size={15} />
      {children}
    </Link>
  );
}
export function CoreStars({ count }: { count: number }) {
  return (
    <span className="nc-stars" aria-label={`${count} of 3 stars`}>
      {[1, 2, 3].map((n) => (
        <Star
          size={13}
          key={n}
          fill={n <= count ? "currentColor" : "none"}
          style={{ opacity: n <= count ? 1 : 0.2 }}
        />
      ))}
    </span>
  );
}
export function CoreLink({
  to,
  children,
  secondary = false,
}: {
  to: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      className={`nc-button ${secondary ? "nc-button-secondary" : ""}`}
      to={to}
    >
      {children}
      <ArrowRight size={17} />
    </Link>
  );
}
export function CoreProfileGate({ children }: { children: ReactNode }) {
  const { profile, isError, refetch, isFetching } = useNexusCore();
  if (profile) return <>{children}</>;
  return (
    <div className="nc-boot">
      <CoreSigil />
      <h2>{isError ? "Connection lost" : "POWERING UP"}</h2>
      <p>{isError ? "Reconnect to continue." : "Loading your core…"}</p>
      <button
        className="nc-button nc-button-secondary"
        onClick={() => refetch()}
        disabled={isFetching}
      >
        {isFetching ? "Connecting…" : "Try again"}
      </button>
    </div>
  );
}
export function CoreSaved({ text = "Progress synced" }: { text?: string }) {
  return (
    <span className="nc-saved">
      <Check size={12} />
      {text}
    </span>
  );
}
