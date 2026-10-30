import { useEffect, useState } from "react";
import type { Enemy } from "@/lib/runedelve/dungeonGenerator";
import { Shield, Skull, Sword, Zap } from "lucide-react";
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
          className="rd-enemy-art"
        />
        {dead && <span className="rd-enemy-defeated-mark"><Skull size={14} aria-hidden /></span>}
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
  const [inspecting, setInspecting] = useState<string | null>(null);
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
        <div className="rd-enemies">
          {enemies.map((e) => (
            <EnemyTile
              key={e.id}
              e={e}
              flashId={flashId}
              primaryTargetId={primaryTargetId}
              onInspect={() => setInspecting(e.id)}
            />
          ))}
        </div>
      </div>
      <Dialog
        open={!!inspected}
        onOpenChange={(open) => {
          if (!open) setInspecting(null);
        }}
      >
        <DialogContent className="rd-dialog-theme rd-battle-dialog">
          <DialogHeader>
            <DialogTitle className="rd-title text-xl">
              {inspected?.name}
            </DialogTitle>
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
              <RuneEnemyArt
                archetypeId={inspected.archetypeId}
                name={inspected.name}
                className="mx-auto h-36 w-36"
              />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-border p-3">
                  <strong className="block text-lg">
                    {Math.max(0, inspected.hp)}/{inspected.maxHp}
                  </strong>
                  <span className="text-[10px] text-muted-foreground">
                    Health
                  </span>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <strong className="block text-lg">{inspected.damage}</strong>
                  <span className="text-[10px] text-muted-foreground">
                    Base attack
                  </span>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <strong className="block text-lg">
                    {inspected.armor ?? 0}
                  </strong>
                  <span className="text-[10px] text-muted-foreground">
                    Armor
                  </span>
                </div>
              </div>
              {inspected.intent != null && (
                <p className="text-xs text-muted-foreground">
                  <Zap className="mr-1 inline h-3 w-3 text-gold" /> Heavy strike
                  in {inspected.intent}{" "}
                  {inspected.intent === 1 ? "turn" : "turns"}. Guard softens the
                  hit.
                </p>
              )}
              {inspected.ability && (
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
                  <h3 className="text-sm font-extrabold">
                    {inspected.telegraphLabel ??
                      inspected.ability.replace(/_/g, " ")}
                    <span className="ml-2 text-xs text-primary">
                      {inspected.abilityCooldown ?? "?"} turns
                    </span>
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {ABILITY_DESCRIPTION[inspected.ability] ??
                      "A special attack triggers when the ability countdown reaches zero."}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setInspecting(null)}
                className="h-11 rounded-xl bg-primary font-extrabold text-primary-foreground"
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
