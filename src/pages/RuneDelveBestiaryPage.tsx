import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Crown, Search, Skull } from "lucide-react";
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
import { useBestiary, type BestiaryEntry } from "@/hooks/useBestiary";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import { RuneEnemyArt } from "@/components/runedelve/RuneArtwork";
import { useRuneDialogFocus } from "@/components/runedelve/useRuneDialogFocus";

type FilterChapter = "all" | 1 | 2 | 3;

/** Variant tier extracted from a bestiary id (mini / boss / null = base). */
function variantOf(entry: RosterEntry): "mini" | "boss" | null {
  return parseBestiaryId(entry.id).variant;
}

const ALL_ARCHETYPES: RosterEntry[] = BESTIARY_ROSTER;

export default function RuneDelveBestiaryPage() {
  const query = useBestiary();
  const { data: entries, isLoading } = query;
  const [chapterFilter, setChapterFilter] = useState<FilterChapter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RosterEntry | null>(null);
  const focus = useRuneDialogFocus();

  // Map archetypeId -> bestiary entry for O(1) lookup.
  const entryMap = useMemo(() => {
    const m = new Map<string, BestiaryEntry>();
    (entries ?? []).forEach((e) => m.set(e.archetype_id, e));
    return m;
  }, [entries]);

  const filtered = useMemo(() => {
    return ALL_ARCHETYPES.filter((r) => {
      if (chapterFilter !== "all" && r.chapter !== chapterFilter) return false;
      if (!search) return true;
      const entry = entryMap.get(r.id);
      // Allow searching by family always; name-search only matches discovered foes.
      if (entry && r.name.toLowerCase().includes(search.toLowerCase()))
        return true;
      if (FAMILY_LABEL[r.family].toLowerCase().includes(search.toLowerCase()))
        return true;
      return false;
    });
  }, [chapterFilter, search, entryMap]);

  const discoveredCount = entries?.length ?? 0;
  const totalArchetypes = ALL_ARCHETYPES.length;
  const totalDefeats = (entries ?? []).reduce((s, e) => s + e.defeat_count, 0);
  const completion = Math.round((discoveredCount / totalArchetypes) * 100);

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          to="/rune-delve"
          className="w-11 h-11 rounded-lg flex items-center justify-center btn-press bg-muted/40"
          aria-label="Back to sanctum"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="rd-title text-xl flex items-center gap-2 leading-tight">
            <BookOpen className="w-4 h-4 text-primary" /> Bestiary
          </h1>
          <p className="text-[11px] text-foreground/70">
            Defeated foes are recorded here for posterity.
          </p>
        </div>
      </div>

      {/* Stats card */}
      <div
        className="glass-card p-4"
        style={{
          background:
            "linear-gradient(160deg, hsl(var(--primary) / 0.10), hsl(var(--gold) / 0.04))",
          borderColor: "hsl(var(--primary) / 0.18)",
        }}
      >
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary">
              Discoveries
            </p>
            <p className="font-rd-display text-2xl tabular-nums">
              {discoveredCount}
              <span className="text-foreground/50 text-base font-bold">
                {" "}
                / {totalArchetypes}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-foreground/65">
              Total Defeats
            </p>
            <p
              className="font-rd-display text-2xl tabular-nums"
              style={{ color: "hsl(var(--gold))" }}
            >
              {totalDefeats}
            </p>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${completion}%`,
              background:
                "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--gold)))",
            }}
          />
        </div>
        <p className="text-[10px] text-foreground/65 mt-1.5 text-center">
          {completion}% complete · keep delving to fill the archive
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search bestiary"
            placeholder="Search by name or family"
            className="pl-9 min-h-11 text-base"
          />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {(["all", 1, 2, 3] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChapterFilter(c)}
              aria-pressed={chapterFilter === c}
              className={`min-w-0 px-1 min-h-11 rounded-lg text-[10px] font-extrabold uppercase tracking-wider btn-press transition-colors ${
                chapterFilter === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-foreground/75"
              }`}
            >
              {c === "all" ? "All" : `Chapter ${c}`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of entries */}
      {query.isError ? (
        <RuneDataState error onRetry={() => void query.refetch()} />
      ) : isLoading ? (
        <RuneDataState
          label="Opening the bestiary…"
          onRetry={() => void query.refetch()}
        />
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center space-y-2">
          <Skull className="w-8 h-8 mx-auto text-foreground/30" />
          <p className="text-sm font-bold">No matches</p>
          <p className="text-[11px] text-foreground/65">
            Try a different filter or chapter.
          </p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-3 gap-2 rd-stagger"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {filtered.map((r, idx) => {
            const entry = entryMap.get(r.id);
            const discovered = !!entry;
            const tier = variantOf(r);
            const ringColor =
              tier === "boss"
                ? "hsl(var(--gold))"
                : tier === "mini"
                  ? "hsl(var(--gold) / 0.7)"
                  : null;
            return (
              <motion.button
                key={r.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.012, 0.18) }}
                onClick={() => setSelected(r)}
                className="aspect-square rounded-xl btn-press flex flex-col items-center justify-center gap-1 p-1.5 relative overflow-hidden"
                style={{
                  background: discovered
                    ? `linear-gradient(160deg, ${FAMILY_COLOR[r.family].replace(")", " / 0.12)")}, hsl(var(--rd-stone-edge) / 0.6))`
                    : "hsl(var(--rd-stone-edge) / 0.55)",
                  border: ringColor
                    ? `1.5px solid ${ringColor}`
                    : discovered
                      ? `1px solid ${FAMILY_COLOR[r.family].replace(")", " / 0.35)")}`
                      : "1px dashed hsl(var(--foreground) / 0.12)",
                  boxShadow:
                    ringColor && discovered
                      ? `0 0 14px ${tier === "boss" ? "hsl(var(--gold) / 0.45)" : "hsl(var(--gold) / 0.25)"}`
                      : undefined,
                }}
                aria-label={
                  discovered
                    ? r.name
                    : tier
                      ? `Undiscovered ${tier === "boss" ? "boss" : "mini-boss"}`
                      : "Undiscovered"
                }
              >
                {tier && (
                  <span
                    className="absolute top-1 left-1 px-1 h-[14px] rounded-full text-[8px] font-extrabold uppercase tracking-wider flex items-center gap-0.5"
                    style={{
                      background:
                        tier === "boss"
                          ? "hsl(var(--gold))"
                          : "hsl(var(--gold) / 0.85)",
                      color: "hsl(var(--background))",
                    }}
                    aria-hidden
                  >
                    {tier === "boss" ? <Crown className="w-2 h-2" /> : "★"}
                    {tier === "boss" ? "Boss" : "Mini"}
                  </span>
                )}
                <div
                  className="w-14 h-14 rounded-xl overflow-hidden"
                  style={{
                    filter: discovered ? "none" : "brightness(0) opacity(0.4)",
                  }}
                >
                  <RuneEnemyArt archetypeId={r.id} name={r.name}/>
                </div>
                <p className="text-[9.5px] font-extrabold uppercase tracking-wider text-center leading-tight max-w-full truncate text-foreground/85">
                  {discovered ? r.name : "???"}
                </p>
                {discovered && entry.defeat_count > 0 && (
                  <span
                    className="absolute top-1 right-1 min-w-[18px] h-[16px] px-1 rounded-full bg-background/80 text-[9px] font-extrabold tabular-nums flex items-center justify-center"
                    style={{ color: "hsl(var(--gold))" }}
                  >
                    ×{entry.defeat_count}
                  </span>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent
          {...focus}
          side="bottom"
          className="rd-dialog-theme rounded-t-2xl max-h-[90dvh] overflow-y-auto"
        >
          {selected &&
            (() => {
              const entry = entryMap.get(selected.id);
              const discovered = !!entry;
              const tier = variantOf(selected);
              const ringColor =
                tier === "boss"
                  ? "hsl(var(--gold))"
                  : tier === "mini"
                    ? "hsl(var(--gold) / 0.7)"
                    : null;
              return (
                <>
                  <SheetHeader className="text-left">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center text-4xl shrink-0"
                        style={{
                          background: `linear-gradient(160deg, ${FAMILY_COLOR[selected.family].replace(")", " / 0.18)")}, hsl(var(--rd-stone-edge) / 0.6))`,
                          border: ringColor
                            ? `1.5px solid ${ringColor}`
                            : `1px solid ${FAMILY_COLOR[selected.family].replace(")", " / 0.35)")}`,
                          boxShadow:
                            ringColor && discovered
                              ? `0 0 18px ${tier === "boss" ? "hsl(var(--gold) / 0.5)" : "hsl(var(--gold) / 0.3)"}`
                              : undefined,
                          filter: discovered
                            ? "none"
                            : "brightness(0) opacity(0.45)",
                        }}
                      >
                        <RuneEnemyArt
                          archetypeId={selected.id}
                          name={selected.name}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <SheetTitle className="font-rd-display text-xl tracking-wide">
                          {discovered
                            ? selected.name
                            : tier === "boss"
                              ? "??? (Boss)"
                              : tier === "mini"
                                ? "??? (Mini-Boss)"
                                : "???"}
                        </SheetTitle>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {tier && (
                            <span
                              className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1"
                              style={{
                                background:
                                  tier === "boss"
                                    ? "hsl(var(--gold))"
                                    : "hsl(var(--gold) / 0.85)",
                                color: "hsl(var(--background))",
                              }}
                            >
                              {tier === "boss" ? (
                                <Crown className="w-2.5 h-2.5" />
                              ) : (
                                "★"
                              )}
                              {tier === "boss" ? "Boss" : "Mini-Boss"}
                            </span>
                          )}
                          <span
                            className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md"
                            style={{
                              background: FAMILY_COLOR[selected.family].replace(
                                ")",
                                " / 0.16)",
                              ),
                              color: FAMILY_COLOR[selected.family],
                            }}
                          >
                            {FAMILY_LABEL[selected.family]}
                          </span>
                          {discovered && (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted/40 text-foreground/75">
                              {ROLE_LABEL[selected.role]}
                            </span>
                          )}
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted/40 text-foreground/75">
                            Ch. {selected.chapter}
                          </span>
                        </div>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="mt-4 space-y-3">
                    {/* Flavor */}
                    <div className="glass-card p-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-foreground/65 mb-1">
                        Description
                      </p>
                      <p className="text-[12.5px] leading-relaxed italic text-foreground/85">
                        {discovered
                          ? (ARCHETYPE_FLAVOR[selected.id] ??
                            ARCHETYPE_FLAVOR[
                              parseBestiaryId(selected.id).baseId
                            ] ??
                            (tier === "boss"
                              ? "A flagship terror — twice the menace of its lesser kin."
                              : tier === "mini"
                                ? "An elevated specimen, gold-ringed and dangerous."
                                : "A foe encountered in the depths."))
                          : tier === "boss"
                            ? "Defeat this BOSS in combat to inscribe its entry."
                            : tier === "mini"
                              ? "Defeat this MINI-BOSS in combat to inscribe its entry."
                              : "Defeat this foe in combat to reveal its entry."}
                      </p>
                    </div>

                    {/* Stats — only revealed once discovered. */}
                    {discovered && (
                      <div className="grid grid-cols-3 gap-2">
                        <StatTile
                          label="Defeats"
                          value={entry!.defeat_count.toString()}
                        />
                        <StatTile
                          label="Best Lvl"
                          value={`L${entry!.highest_level_defeated}`}
                        />
                        <StatTile label="Tier" value={`T${selected.tier}`} />
                      </div>
                    )}

                    {/* Ability info */}
                    {discovered && selected.ability && (
                      <div className="glass-card p-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-primary mb-1">
                          ✦ Special Move
                        </p>
                        <p className="text-[12px] font-bold leading-snug">
                          {selected.telegraphLabel ?? "Charged ability"}
                        </p>
                        <p className="text-[11px] text-foreground/75 leading-snug mt-0.5">
                          {ABILITY_BLURB[selected.ability]}
                        </p>
                      </div>
                    )}

                    {/* First defeat */}
                    {discovered && (
                      <p className="text-[10px] text-foreground/55 text-center">
                        First defeated{" "}
                        {new Date(
                          entry!.first_defeated_at,
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </>
              );
            })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-2.5 text-center">
      <p className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/65">
        {label}
      </p>
      <p
        className="font-rd-display text-lg tabular-nums"
        style={{ color: "hsl(var(--gold))" }}
      >
        {value}
      </p>
    </div>
  );
}
