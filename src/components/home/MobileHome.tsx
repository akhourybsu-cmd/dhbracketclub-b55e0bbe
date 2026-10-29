// One responsive Home composition for phones, tablets and desktop.
import { Children, useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  LayoutGrid,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trophy,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { NextAction } from "@/lib/home/nextAction";
import {
  homeShortcut,
  type HomeSection,
  type HomeUpdate,
} from "@/lib/home/mobileHome";
import type { HomeSignals } from "@/lib/home/signals";
import { homeRelativeTime } from "@/lib/home/signals";
import type { UseQuickBarReturn } from "./useQuickBar";
import { MobileIconButton } from "@/components/mobile/MobileIconButton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HomeProgressCard } from "./HomeProgressCard";
import { HomeFeatureGrid } from "./HomeFeatureGrid";
import "./mobileHome.css";

interface Props {
  displayName: string;
  clubName: string;
  installedSlugs: Set<string>;
  actions: NextAction[];
  updates: HomeUpdate[];
  shortcuts: UseQuickBarReturn;
  refreshing?: boolean;
  error?: string | null;
  onRefresh: () => void;
  signals?: HomeSignals;
  widgets?: ReactNode;
  children?: ReactNode;
  empty?: ReactNode;
}
const SECTIONS: { key: HomeSection; label: string; empty: string }[] = [
  { key: "latest", label: "Latest", empty: "A little quiet here—for now." },
  { key: "upcoming", label: "Upcoming", empty: "Nothing on the calendar yet." },
  {
    key: "playing",
    label: "In progress",
    empty: "No games or stories in progress.",
  },
];
export function MobileHome({
  displayName,
  clubName,
  installedSlugs,
  actions,
  updates,
  shortcuts,
  refreshing,
  error,
  onRefresh,
  signals,
  widgets,
  children,
  empty,
}: Props) {
  const [section, setSection] = useState<HomeSection>("latest"),
    [edit, setEdit] = useState(false),
    [tools, setTools] = useState(false),
    [expanded, setExpanded] = useState(false),
    [showAll, setShowAll] = useState(false);
  const panelId = useId(),
    firstName = displayName.trim().split(/\s+/)[0];
  const pinned = shortcuts.pinned.filter((item) =>
      homeShortcut(item.asset.slug),
    ),
    current = updates.filter((row) => row.section === section);
  const attention = actions.filter(
      (action) => !action.assetSlug || installedSlugs.has(action.assetSlug),
    ),
    lead = attention[0];
  const quiet = installedSlugs.has("daily-find")
    ? {
        title: "Found something good?",
        sub: "Share a read, a photo or a little discovery.",
        to: "/finds?compose=1",
        cta: "Make a Drop",
        icon: Bookmark,
      }
    : installedSlugs.has("chat")
      ? {
          title: "A little time with your people.",
          sub: "Pick up a conversation with your club.",
          to: "/chat",
          cta: "Say hello",
          icon: MessageSquare,
        }
      : {
          title: "Build your DH legacy.",
          sub: "Find a feat and make your next move.",
          to: "/feats",
          cta: "Explore your feats",
          icon: Trophy,
        };
  const ActionIcon = lead?.icon || quiet.icon;
  const extra = !!widgets || Children.toArray(children).length > 0;
  return (
    <div className="mobile-home home-experience">
      <header className="home-welcome">
        <div>
          <p className="home-date">{format(new Date(), "EEEE, MMMM d")}</p>
          <h1>{firstName ? `Hey, ${firstName}.` : "Welcome home."}</h1>
          <p className="home-welcome-sub">
            A little competition. A lot of good company.
          </p>
        </div>
        <div className="home-welcome-actions">
          <MobileIconButton
            aria-label="Refresh home"
            disabled={refreshing}
            onClick={onRefresh}
            className="home-refresh"
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing && "animate-spin")}
            />
          </MobileIconButton>
          {extra && (
            <MobileIconButton
              aria-label="Club extras"
              onClick={() => setTools(true)}
            >
              <MoreHorizontal className="h-5 w-5" />
            </MobileIconButton>
          )}
        </div>
      </header>
      {error && (
        <div role="alert" className="home-error">
          <p>{error}</p>
          <button onClick={onRefresh}>
            Try again
            <RefreshCw size={14} />
          </button>
        </div>
      )}
      <div className="home-opening-grid">
        <HomeProgressCard
          signals={signals}
          installed={installedSlugs}
          onRefresh={onRefresh}
        />
        <section
          className="home-priority home-panel"
          data-urgent={!!lead && lead.priority >= 90}
          aria-label={lead ? "For you" : "Explore your club"}
        >
          <div className="home-priority-top">
            <span className="home-eyebrow">
              <i />
              {lead
                ? lead.priority >= 90
                  ? "YOUR MOVE"
                  : "FOR YOU"
                : "MAKE TODAY COUNT"}
            </span>
            {attention.length > 1 ? (
              <button
                className="home-more home-more-top"
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                <span>
                  {expanded ? "Show less" : `See ${attention.length - 1} more`}
                </span>
                <ChevronDown
                  size={14}
                  className={cn(
                    "home-disclosure-arrow",
                    expanded && "rotate-180",
                  )}
                />
              </button>
            ) : (
              lead && <small>{lead.tag || "UP NEXT"}</small>
            )}
          </div>
          <Link to={lead?.to || quiet.to} className="home-next-action">
            <span className="home-action-icon">
              <ActionIcon size={22} />
            </span>
            <h2>{lead?.label || quiet.title}</h2>
            <p>{lead?.sub || quiet.sub}</p>
            <span className="home-next-cta">
              <span>{lead ? "Jump in" : quiet.cta}</span>
              <ArrowRight size={16} />
            </span>
          </Link>
          {attention.length > 1 && (
            <>
              {expanded && (
                <div className="home-extra-actions">
                  {attention.slice(1).map((action) => (
                    <Link key={action.id} to={action.to}>
                      <action.icon size={16} />
                      <span>
                        <strong>{action.label}</strong>
                        {action.sub && <small>{action.sub}</small>}
                      </span>
                      <ChevronRight size={15} />
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {(pinned.length > 0 || shortcuts.available.length > 0) && (
        <section aria-label="Your shortcuts" className="home-shortcuts-section">
          <div className="home-section-heading">
            <div>
              <span className="home-eyebrow">PICK UP & PLAY</span>
              <h2>Your apps</h2>
            </div>
            <button
              aria-label="Customize shortcuts"
              className="home-text-link"
              onClick={() => setEdit(true)}
            >
              <Pencil size={14} />
              Customize
            </button>
          </div>
          {pinned.length ? (
            <div className="home-shortcuts" data-count={pinned.length}>
              {pinned.map((item) => {
                const meta = homeShortcut(item.asset.slug)!,
                  Icon = meta.icon;
                return (
                  <Link to={meta.path} key={item.id} className="home-shortcut">
                    <span
                      className="home-shortcut-icon"
                      data-slug={item.asset.slug}
                    >
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span>{meta.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <button
              className="home-add-shortcuts"
              onClick={() => setEdit(true)}
            >
              <Plus size={16} />
              Choose your favorite apps
            </button>
          )}
        </section>
      )}

      <HomeFeatureGrid
        installed={installedSlugs}
        signals={signals}
        updates={updates}
      />
      {empty}
      <section aria-label="Club activity" className="home-club-section">
        <div className="home-section-heading">
          <div>
            <span className="home-eyebrow">GOOD COMPANY</span>
            <h2>Around the club</h2>
          </div>
          {installedSlugs.has("feed") && (
            <Link to="/feed" className="home-text-link">
              Full feed
              <ArrowRight size={15} />
            </Link>
          )}
        </div>
        <div className="home-activity-surface home-panel">
          <div className="home-tabs" aria-label="Activity views" role="tablist">
            {SECTIONS.map((tab, index) => (
              <button
                className="home-tab"
                key={tab.key}
                id={panelId + "-" + tab.key}
                role="tab"
                aria-selected={section === tab.key}
                aria-controls={panelId}
                tabIndex={section === tab.key ? 0 : -1}
                onClick={() => {
                  setSection(tab.key);
                  setShowAll(false);
                }}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % 3
                      : event.key === "ArrowLeft"
                        ? (index + 2) % 3
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? 2
                            : -1;
                  if (next < 0) return;
                  event.preventDefault();
                  setSection(SECTIONS[next].key);
                  setShowAll(false);
                  document
                    .getElementById(panelId + "-" + SECTIONS[next].key)
                    ?.focus();
                }}
              >
                {tab.label}
                <span className="home-tab-count" aria-hidden="true">
                  {updates.filter((u) => u.section === tab.key).length}
                </span>
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={panelId}
            aria-labelledby={panelId + "-" + section}
            tabIndex={0}
          >
            {current.length === 0 ? (
              <div className="home-activity-empty">
                <Clock3 size={24} />
                <strong>
                  {SECTIONS.find((tab) => tab.key === section)?.empty}
                </strong>
                <p>
                  {section === "latest"
                    ? "Fresh conversations, results and club moments will land here."
                    : section === "upcoming"
                      ? "Club events and celebrations will appear here."
                      : "Your active drafts and stories will be ready to jump back into."}
                </p>
                {installedSlugs.has("chat") && (
                  <Link to="/chat">
                    Say hello in chat
                    <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            ) : (
              <ul className="home-activity-list">
                {(showAll ? current : current.slice(0, 5)).map((row) => (
                  <li key={row.id}>
                    <Link to={row.to} className="home-activity-row">
                      <span
                        className="home-activity-icon"
                        data-kind={row.label}
                      >
                        <row.icon size={18} />
                      </span>
                      <span className="home-activity-copy">
                        <span className="home-activity-meta">
                          {row.label}
                          {row.at && Number.isFinite(Date.parse(row.at)) && (
                            <>
                              {" "}
                              ·{" "}
                              {row.section === "upcoming"
                                ? format(
                                    new Date(row.at),
                                    row.dateOnly
                                      ? "EEE, MMM d"
                                      : "EEE, MMM d · h:mm a",
                                  )
                                : homeRelativeTime(row.at)}
                            </>
                          )}
                        </span>
                        <strong>{row.title}</strong>
                        {row.detail && (
                          <span className="home-activity-detail">
                            {row.detail}
                          </span>
                        )}
                      </span>
                      <ChevronRight size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {current.length > 5 && (
            <button
              className="home-feed-more"
              aria-expanded={showAll}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show less" : `Show all ${current.length} updates`}
              <ChevronDown size={14} />
            </button>
          )}
        </div>
      </section>
      <footer className="home-signoff">
        <span className="home-signoff-mark">DH</span>
        <span>
          {clubName}
          <small>Made for the people in it.</small>
        </span>
        {extra && (
          <button onClick={() => setTools(true)}>
            Club extras
            <ArrowRight size={14} />
          </button>
        )}
      </footer>

      <Sheet open={tools} onOpenChange={setTools}>
        <SheetContent side="bottom" className="home-tools-sheet home-sheet">
          <SheetHeader>
            <SheetTitle>More from your club</SheetTitle>
            <SheetDescription>
              App details, club updates and a few useful extras.
            </SheetDescription>
          </SheetHeader>
          <div className="home-sheet-scroll">
            {tools && (
              <>
                {widgets}
                {children}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={edit} onOpenChange={setEdit}>
        <SheetContent side="bottom" className="home-shortcut-sheet home-sheet">
          <SheetHeader>
            <SheetTitle>Your shortcuts</SheetTitle>
            <SheetDescription>
              Pin up to {shortcuts.max} apps. Your order stays saved for this
              club.
            </SheetDescription>
          </SheetHeader>
          <div className="home-shortcut-editor home-sheet-scroll">
            {shortcuts.pinned.map((item, index) => (
              <div key={item.id} className="home-pin-row">
                <span>
                  {homeShortcut(item.asset.slug)?.label || item.asset.name}
                </span>
                <MobileIconButton
                  aria-label={`Move ${item.asset.name} up`}
                  disabled={index === 0}
                  onClick={() => shortcuts.move(item.asset.slug, "up")}
                >
                  <ArrowUp size={16} />
                </MobileIconButton>
                <MobileIconButton
                  aria-label={`Move ${item.asset.name} down`}
                  disabled={index === shortcuts.pinned.length - 1}
                  onClick={() => shortcuts.move(item.asset.slug, "down")}
                >
                  <ArrowDown size={16} />
                </MobileIconButton>
                <MobileIconButton
                  aria-label={`Unpin ${item.asset.name}`}
                  onClick={() => shortcuts.unpin(item.asset.slug)}
                >
                  <X size={16} />
                </MobileIconButton>
              </div>
            ))}
            <p className="home-more-apps">More apps</p>
            {shortcuts.available
              .filter((item) => homeShortcut(item.asset.slug))
              .map((item) => (
                <button
                  key={item.id}
                  disabled={shortcuts.pinned.length >= shortcuts.max}
                  className="home-pin-option"
                  onClick={() => shortcuts.pin(item.asset.slug)}
                >
                  <LayoutGrid size={16} />
                  <span>{homeShortcut(item.asset.slug)?.label}</span>
                  <Plus size={16} />
                </button>
              ))}
          </div>
          <div className="home-sheet-actions">
            <button onClick={shortcuts.reset}>Reset shortcuts</button>
            <button className="home-done-button" onClick={() => setEdit(false)}>
              <Check size={16} />
              Done
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
