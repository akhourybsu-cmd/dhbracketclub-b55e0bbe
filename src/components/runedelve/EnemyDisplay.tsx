import { useEffect, useState } from "react";
import type { Enemy } from "@/lib/runedelve/dungeonGenerator";
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  Skull,
  Sword,
  Zap,
} from "lucide-react";
import { RuneEnemyArt } from "./RuneArtwork";
import { BattleStageFeedback, TargetFeedback } from "./CombatFeedback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import "./runeBattle.css";
import "./runeDialogs.css";
import { RunePager } from "./RunePager";
import { useRuneDialogFocus } from "./useRuneDialogFocus";

interface Props {
  enemies: Enemy[];
  flashId?: string | null;
  primaryTargetId?: string | null;
  onInspectChange?: (open: boolean) => void;
}

const ABILITY_DESCRIPTION: Record<string, string> = {
  heavy_strike:
    "Unleashes an extra charged blast. Defeat this enemy before its ability countdown reaches zero.",
  shield_self: "Raises armor to reduce the damage of your next attacks.",
  heal_ally: "Restores health to a wounded ally.",
  summon_minion: "Summons another enemy into the encounter.",
  corrupt_tile:
    "Spreads corruption onto the rune board. Corrupted runes cost health when chained.",
  seal_tile: "Seals a rune. Connect neighboring runes to break seals.",
};

function EnemyTile({
  e,
  primaryTargetId,
  onInspect,
}: {
  e: Enemy;
  flashId?: string | null;
  primaryTargetId?: string | null;
  onInspect: () => void;
}) {
  const dead = e.hp <= 0;
  const isPrimaryTarget = !dead && e.id === primaryTargetId;
  const pct = Math.max(
    0,
    Math.min(100, Math.round((e.hp / Math.max(1, e.maxHp)) * 100)),
  );
  const heavyReady = !dead && e.intent != null && e.intent <= 1;
  const abilityReady =
    !dead && !!e.ability && e.abilityCooldown != null && e.abilityCooldown <= 1;
  return (
    <div
      data-enemy-id={e.id}
      data-primary-target={isPrimaryTarget ? "true" : undefined}
      data-defeated={dead || undefined}
      data-tier={e.tier ?? "normal"}
      className="rd-enemy-tile"
    >
      <button
        type="button"
        onClick={onInspect}
        className="rd-enemy-portrait"
        aria-label={`Inspect ${e.name}. ${Math.max(0, e.hp)} of ${e.maxHp} health. ${e.damage} attack.${isPrimaryTarget ? " Current attack target." : ""}`}
      >
        <RuneEnemyArt
          archetypeId={e.archetypeId}
          name={e.name}
          tier={e.tier}
          enemyId={e.id}
          className="rd-enemy-art"
        />
        {dead && (
          <span className="rd-enemy-defeated-mark">
            <Skull size={14} aria-hidden />
          </span>
        )}
        <TargetFeedback target={e.id} />
        {isPrimaryTarget && (
          <span className="rd-enemy-target" aria-hidden>
            ▲ TARGET
          </span>
        )}
        {!dead && (e.armor ?? 0) > 0 && (
          <span
            className="absolute top-1 left-1 rounded bg-background/90 px-1 text-[9px] font-extrabold text-gold"
            title={`${e.armor} armor`}
          >
            <Shield size={9} className="inline" />
            {e.armor}
          </span>
        )}
        {!dead && e.tier && (
          <span
            className="absolute top-1 right-1 text-[11px]"
            aria-label={e.tier === "boss" ? "Boss" : "Mini-boss"}
          >
            {e.tier === "boss" ? "♛" : "✦"}
          </span>
        )}
      </button>
      <span className="rd-enemy-name">{e.name}</span>
      <div
        className="rd-enemy-hp"
        aria-label={`${Math.max(0, e.hp)} of ${e.maxHp} health`}
      >
        <div>
          <span
            style={{
              width: `${pct}%`,
              background: pct <= 25 ? "hsl(var(--destructive))" : undefined,
            }}
          />
        </div>
        <span>{Math.max(0, e.hp)}</span>
      </div>
      <div
        className={`rd-enemy-danger ${heavyReady || abilityReady ? "is-ready" : ""}`}
      >
        {dead ? (
          <span>Defeated</span>
        ) : (
          <>
            <Sword size={10} aria-hidden />
            <span>{e.damage}</span>
            {e.intent != null && (
              <span title={`Heavy strike in ${e.intent} turns`}>
                {" "}
                · <Zap size={10} className="inline" aria-hidden />
                {e.intent}
              </span>
            )}
            {abilityReady && (
              <span
                title={e.telegraphLabel ?? "Ability next turn"}
                aria-label={e.telegraphLabel ?? "Ability next turn"}
              >
                {" "}
                · ✦
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function EnemyDisplay({
  enemies,
  flashId,
  primaryTargetId,
  onInspectChange,
}: Props) {
  const [enemyPage, setEnemyPage] = useState(0);
  const pageSize = enemies.length > 4 ? 3 : 4;
  const pageCount = Math.max(1, Math.ceil(enemies.length / pageSize));
  const activePage = Math.min(enemyPage, pageCount - 1);
  const visibleEnemies = enemies.slice(
    activePage * pageSize,
    (activePage + 1) * pageSize,
  );
  const targetId = primaryTargetId ?? enemies.find((enemy) => enemy.hp > 0)?.id;
  const targetIndex = enemies.findIndex((enemy) => enemy.id === targetId);
  useEffect(() => {
    if (targetIndex >= 0) setEnemyPage(Math.floor(targetIndex / pageSize));
  }, [targetId, targetIndex, pageSize]);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [inspectionPage, setInspectionPage] = useState(0);
  const inspectionFocus = useRuneDialogFocus();
  useEffect(() => setInspectionPage(0), [inspecting]);
  const inspected = enemies.find((enemy) => enemy.id === inspecting);
  const hasInspection = !!inspected;
  useEffect(() => {
    onInspectChange?.(hasInspection);
  }, [hasInspection, onInspectChange]);
  useEffect(() => () => onInspectChange?.(false), [onInspectChange]);
  return (
    <>
      <div className="rd-enemy-stage">
        <BattleStageFeedback />
        <div className={pageCount > 1 ? "rd-enemy-pages" : undefined}>
          {pageCount > 1 && (
            <button
              type="button"
              className="rd-enemy-page-button"
              aria-label="Previous enemies"
              disabled={activePage === 0}
              onClick={() => setEnemyPage(activePage - 1)}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
          )}
          <div className="rd-enemies">
            {visibleEnemies.map((e) => (
              <EnemyTile
                key={e.id}
                e={e}
                flashId={flashId}
                primaryTargetId={primaryTargetId}
                onInspect={() => setInspecting(e.id)}
              />
            ))}
          </div>
          {pageCount > 1 && (
            <button
              type="button"
              className="rd-enemy-page-button"
              aria-label={`Next enemies. Page ${activePage + 1} of ${pageCount}`}
              disabled={activePage === pageCount - 1}
              onClick={() => setEnemyPage(activePage + 1)}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          )}
        </div>
      </div>
      <Dialog
        open={!!inspected}
        onOpenChange={(open) => {
          if (!open) setInspecting(null);
        }}
      >
        <DialogContent
          {...inspectionFocus}
          className="rd-dialog-theme rd-paged-dialog"
        >
          <DialogHeader className="rd-dialog-header">
            <DialogTitle className="rd-title">{inspected?.name}</DialogTitle>
            <DialogDescription>
              {inspected?.tier === "boss"
                ? "Boss"
                : inspected?.tier === "mini"
                  ? "Champion"
                  : (inspected?.role ?? "Enemy")}{" "}
              · {inspected?.family ?? "Dungeon creature"}
            </DialogDescription>
          </DialogHeader>
          {inspected && (
            <>
              <div className="rd-dialog-body" aria-live="polite">
                {inspectionPage === 0 ? (
                  <>
                    <RuneEnemyArt
                      archetypeId={inspected.archetypeId}
                      name={inspected.name}
                      tier={inspected.tier}
                      enemyId={inspected.id}
                      decorative={false}
                      className="rd-dialog-inspection-art"
                    />
                    <div className="rd-dialog-stats">
                      <div>
                        <strong>
                          {Math.max(0, inspected.hp)}/{inspected.maxHp}
                        </strong>
                        <span>Health</span>
                      </div>
                      <div>
                        <strong>{inspected.damage}</strong>
                        <span>Base attack</span>
                      </div>
                      <div>
                        <strong>{inspected.armor ?? 0}</strong>
                        <span>Armor</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <article className="rd-dialog-card">
                    <h3>
                      {inspected.telegraphLabel ??
                        (inspected.ability
                          ? inspected.ability.replace(/_/g, " ")
                          : "Enemy tactics")}
                    </h3>
                    {inspected.intent != null && (
                      <p>
                        Heavy strike in {inspected.intent}{" "}
                        {inspected.intent === 1 ? "turn" : "turns"}. Guard
                        softens the hit.
                      </p>
                    )}
                    {inspected.ability ? (
                      <>
                        <p>
                          Ability countdown: {inspected.abilityCooldown ?? "?"}{" "}
                          turns.
                        </p>
                        <p>
                          {ABILITY_DESCRIPTION[inspected.ability] ??
                            "A special attack triggers when the ability countdown reaches zero."}
                        </p>
                      </>
                    ) : (
                      <p>
                        This foe has no additional charged ability. Its base
                        attack follows your chain.
                      </p>
                    )}
                  </article>
                )}
              </div>
              <RunePager
                page={inspectionPage}
                pageCount={2}
                onPageChange={setInspectionPage}
                label="Enemy inspection"
              />
              <button
                type="button"
                onClick={() => setInspecting(null)}
                className="rd-dialog-primary"
              >
                Back to battle
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
