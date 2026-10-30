import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Skull } from "lucide-react";
import {
  BESTIARY_ROSTER,
  parseBestiaryId,
  type RosterEntry,
} from "@/lib/runedelve/enemyRoster";
import {
  ABILITY_BLURB,
  ARCHETYPE_FLAVOR,
  FAMILY_COLOR,
  FAMILY_LABEL,
  ROLE_LABEL,
} from "@/lib/runedelve/bestiary";
import { useBestiary } from "@/hooks/useBestiary";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import { RuneEnemyArt } from "@/components/runedelve/RuneArtwork";
import { RunePager } from "@/components/runedelve/RunePager";
import { useRuneViewport } from "@/hooks/useRuneViewport";
import { useRuneDialogFocus } from "@/components/runedelve/useRuneDialogFocus";
import "@/components/runedelve/runeCodex.css";

type FilterChapter = "all" | 1 | 2 | 3;

export default function RuneDelveBestiaryPage() {
  const query = useBestiary();
  const viewport = useRuneViewport();
  const [chapter, setChapter] = useState<FilterChapter>("all");
  const [search, setSearch] = useState("");
  const [requestedPage, setPage] = useState(0);
  const [selected, setSelected] = useState<RosterEntry | null>(null);
  const focus = useRuneDialogFocus();
  const entryMap = useMemo(
    () =>
      new Map((query.data ?? []).map((entry) => [entry.archetype_id, entry])),
    [query.data],
  );
  const filtered = useMemo(
    () =>
      BESTIARY_ROSTER.filter((enemy) => {
        if (chapter !== "all" && enemy.chapter !== chapter) return false;
        const term = search.trim().toLowerCase();
        return (
          !term ||
          FAMILY_LABEL[enemy.family].toLowerCase().includes(term) ||
          (entryMap.has(enemy.id) && enemy.name.toLowerCase().includes(term))
        );
      }),
    [chapter, search, entryMap],
  );
  const pageSize = viewport.short ? 6 : 9;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(requestedPage, pageCount - 1);
  const defeats = (query.data ?? []).reduce(
    (total, entry) => total + entry.defeat_count,
    0,
  );
  const entry = selected ? entryMap.get(selected.id) : undefined;
  const variant = selected ? parseBestiaryId(selected.id).variant : null;

  return (
    <div className="rd-screen rd-codex-page" data-testid="rune-bestiary">
      <header className="rd-codex-heading">
        <Link
          to="/rune-delve"
          aria-label="Back to sanctum"
          className="rd-codex-back"
        >
          <ArrowLeft size={17} />
        </Link>
        <div className="flex-1">
          <h1 className="rd-title">Bestiary</h1>
          <p>
            {entryMap.size}/{BESTIARY_ROSTER.length} discovered ·{" "}
            {defeats.toLocaleString()} defeats
          </p>
        </div>
      </header>
      <div className="rd-bestiary-filters">
        <div className="rd-bestiary-search">
          <Search aria-hidden />
          <Input
            aria-label="Search bestiary"
            placeholder="Name or family"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="rd-bestiary-chapters" aria-label="Bestiary chapter">
          {(["all", 1, 2, 3] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={chapter === value}
              onClick={() => {
                setChapter(value);
                setPage(0);
              }}
            >
              {value === "all" ? "All" : `Chapter ${value}`}
            </button>
          ))}
        </div>
      </div>
      {query.isError ? (
        <RuneDataState error onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <RuneDataState
          label="Opening the bestiary…"
          onRetry={() => void query.refetch()}
        />
      ) : !filtered.length ? (
        <div className="rd-codex-empty">
          <Skull size={28} />
          <strong>No matches</strong>
          <p>Try a different filter or chapter.</p>
        </div>
      ) : (
        <>
          <div className="rd-bestiary-grid" aria-label="Bestiary entries">
            {filtered
              .slice(page * pageSize, (page + 1) * pageSize)
              .map((enemy) => {
                const discovery = entryMap.get(enemy.id);
                const tier = parseBestiaryId(enemy.id).variant;
                return (
                  <button
                    key={enemy.id}
                    type="button"
                    className="rd-bestiary-tile"
                    aria-label={
                      discovery
                        ? enemy.name
                        : tier
                          ? `Undiscovered ${tier === "boss" ? "boss" : "mini-boss"}`
                          : "Undiscovered"
                    }
                    style={{
                      background: `linear-gradient(150deg, ${FAMILY_COLOR[enemy.family].replace(")", " / .12)")}, hsl(var(--card)))`,
                      border: `1px ${discovery ? "solid" : "dashed"} ${tier ? "hsl(var(--gold) / .7)" : "hsl(var(--border))"}`,
                    }}
                    onClick={() => setSelected(enemy)}
                  >
                    {tier && (
                      <span className="rd-bestiary-tile-tag" aria-hidden>
                        {tier === "boss" ? "BOSS" : "MINI"}
                      </span>
                    )}
                    <div
                      className="rd-bestiary-portrait"
                      style={{
                        filter: discovery
                          ? undefined
                          : "brightness(0) opacity(.4)",
                      }}
                    >
                      <RuneEnemyArt archetypeId={enemy.id} name={enemy.name} />
                    </div>
                    <span className="rd-bestiary-tile-name">
                      {discovery ? enemy.name : "???"}
                    </span>
                    {discovery && (
                      <span className="rd-bestiary-tile-count" aria-hidden>
                        ×{discovery.defeat_count}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
          <RunePager
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            label="Bestiary"
          />
        </>
      )}
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent
          {...focus}
          side="bottom"
          className="rd-dialog-theme rd-codex-detail"
        >
          {selected && (
            <>
              <SheetHeader className="rd-codex-detail-heading">
                <div
                  className="rd-codex-detail-portrait"
                  style={{
                    filter: entry ? undefined : "brightness(0) opacity(.4)",
                  }}
                >
                  <RuneEnemyArt
                    archetypeId={selected.id}
                    name={selected.name}
                  />
                </div>
                <div>
                  <SheetTitle className="rd-title rd-codex-detail-title">
                    {entry
                      ? selected.name
                      : variant === "boss"
                        ? "??? (Boss)"
                        : variant === "mini"
                          ? "??? (Mini-Boss)"
                          : "???"}
                  </SheetTitle>
                  <SheetDescription>
                    {FAMILY_LABEL[selected.family]} · Ch. {selected.chapter}
                    {entry ? ` · ${ROLE_LABEL[selected.role]}` : ""}
                  </SheetDescription>
                </div>
              </SheetHeader>
              <Tabs
                key={selected.id}
                defaultValue="lore"
                className="rd-codex-tabs"
              >
                <TabsList
                  className="rd-codex-tabbar"
                  style={{
                    gridTemplateColumns: `repeat(${entry ? (selected.ability ? 3 : 2) : 1}, minmax(0, 1fr))`,
                  }}
                >
                  <TabsTrigger value="lore">Lore</TabsTrigger>
                  {entry && <TabsTrigger value="record">Record</TabsTrigger>}
                  {entry && selected.ability && (
                    <TabsTrigger value="ability">Ability</TabsTrigger>
                  )}
                </TabsList>
                <TabsContent value="lore" className="rd-codex-tab-content">
                  <section className="rd-codex-detail-panel">
                    <h3>Description</h3>
                    <p>
                      {entry
                        ? (ARCHETYPE_FLAVOR[selected.id] ??
                          ARCHETYPE_FLAVOR[
                            parseBestiaryId(selected.id).baseId
                          ] ??
                          "A foe encountered in the depths.")
                        : `Defeat this ${variant === "boss" ? "BOSS" : variant === "mini" ? "MINI-BOSS" : "foe"} in combat to reveal its entry.`}
                    </p>
                  </section>
                </TabsContent>
                {entry && (
                  <TabsContent value="record" className="rd-codex-tab-content">
                    <section className="rd-codex-detail-panel">
                      <div className="rd-codex-detail-stats">
                        <div>
                          <small>Defeats</small>
                          <strong>{entry.defeat_count}</strong>
                        </div>
                        <div>
                          <small>Best Lvl</small>
                          <strong>L{entry.highest_level_defeated}</strong>
                        </div>
                        <div>
                          <small>Tier</small>
                          <strong>T{selected.tier}</strong>
                        </div>
                      </div>
                      <p className="text-center">
                        First defeated{" "}
                        {new Date(entry.first_defeated_at).toLocaleDateString()}
                      </p>
                    </section>
                  </TabsContent>
                )}
                {entry && selected.ability && (
                  <TabsContent value="ability" className="rd-codex-tab-content">
                    <section className="rd-codex-detail-panel">
                      <h3>{selected.telegraphLabel ?? "Special move"}</h3>
                      <p>{ABILITY_BLURB[selected.ability]}</p>
                    </section>
                  </TabsContent>
                )}
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
