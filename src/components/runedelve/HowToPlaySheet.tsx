import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getClass, type HeroClass } from '@/lib/runedelve/classConfig';
import { ClassBadge } from './ClassBadge';
import { useSheetSfx } from '@/hooks/useSheetSfx';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heroClass?: HeroClass;
}

const RUNES = [
  { glyph: '⚔', name: 'Red · Attack', color: 'hsl(0 75% 58%)', desc: 'Damages the front enemy. Damage = chain length × 8.' },
  { glyph: '✦', name: 'Blue · Mana', color: 'hsl(215 75% 60%)', desc: 'Charges your ability meter (3 orbs to cast).' },
  { glyph: '❀', name: 'Green · Heal', color: 'hsl(140 60% 50%)', desc: 'Restores HP. Heal = chain length × 6.' },
  { glyph: '◈', name: 'Gold · Guard', color: 'hsl(45 90% 56%)', desc: 'Adds shield turns that reduce incoming damage by 60%.' },
];

export function HowToPlaySheet({ open, onOpenChange, heroClass }: Props) {
  useSheetSfx(open);
  const cls = heroClass ? getClass(heroClass) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88vh] rounded-t-3xl p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-2 text-left">
          <SheetTitle className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <span>📖</span> How to Play Rune Delve
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 px-5 pb-8">
          <div className="space-y-5 pt-2">
            {/* Goal */}
            <Section title="🎯 Goal">
              <p>Progress through a shared <b>level-based campaign</b>. Each level has its own objective — defeat all enemies, survive a set number of turns, reach a target score, or take down a champion. The objective bar shows exactly how close you are. Clear a level to unlock the next one.</p>
              <p className="mt-1.5">Every player faces the <b>same level</b> with the same board, enemies, and turn limit — your score is what sets you apart.</p>
            </Section>

            {/* Controls */}
            <Section title="✋ Controls">
              <ul className="space-y-1.5 list-disc pl-4">
                <li>Choose <b>Drag</b> for one continuous gesture or <b>Tap</b> to build a chain one rune at a time.</li>
                <li>Runes connect in <b>any of 8 directions</b> — including diagonals.</li>
                <li>In Drag mode, <b>release</b> to resolve. In Tap mode, press <b>Resolve</b>. Choose the previous rune to undo a step.</li>
                <li>Keyboard players can focus runes, press Enter or Space to select them, then use Resolve.</li>
                <li>Longer chains hit harder, heal more, and charge faster.</li>
              </ul>
            </Section>

            {/* Runes */}
            <Section title="🔮 Rune Effects">
              <div className="space-y-2">
                {RUNES.map(r => (
                  <div key={r.name} className="flex items-start gap-3 p-2.5 rounded-xl border border-border/40 bg-muted/20">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-extrabold flex-shrink-0"
                      style={{ background: `${r.color}20`, color: r.color, border: `1px solid ${r.color}50` }}
                    >
                      {r.glyph}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[12px]">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{r.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Class */}
            {cls && (
              <Section title="🛡️ Your Hero">
                <div className="flex items-start gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                  <ClassBadge cls={cls.id} size="lg" />
                  <div className="min-w-0">
                    <p className="font-extrabold text-[13px]">{cls.name} {cls.emoji}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5"><b>Passive:</b> {cls.passive}</p>
                    <p className="text-[11px] text-primary mt-0.5"><b>⚡ {cls.abilityName}:</b> {cls.abilityDesc}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Cast costs {cls.abilityCost} mana orbs (charge with Blue runes).</p>
                  </div>
                </div>
              </Section>
            )}

            {/* Combat */}
            <Section title="⚔️ Combat Flow">
              <ol className="space-y-1.5 list-decimal pl-4">
                <li>You chain runes — your turn resolves.</li>
                <li>The <b>▶ marker</b> shows which enemy an Attack chain will hit; ⚔ shows its base damage.</li>
                <li>Living enemies counter-attack (Guard reduces damage).</li>
                <li>Turn counter ticks down by 1.</li>
                <li>Run ends when all enemies fall, your HP hits 0, or turns reach 0.</li>
              </ol>
            </Section>

            {/* Scoring */}
            <Section title="🏆 Scoring">
              <ul className="space-y-1 list-disc pl-4">
                <li>Total damage dealt — <b>1 pt each</b></li>
                <li>Enemies defeated — <b>200 pts each</b></li>
                <li>HP remaining — <b>5 pts per HP</b></li>
                <li>Turns remaining — <b>50 pts per turn</b></li>
                <li>Longest chain — <b>25 pts per rune</b></li>
                <li>Full clear bonus — <b>+500 pts</b></li>
              </ul>
            </Section>

            {/* Progression */}
            <Section title="🌟 XP, Levels & Chapters">
              <p>Your hero earns XP every run (~score ÷ 30, up to 120 + 20 for clears). Hero levels unlock <b>cosmetic titles only</b> — no stat boosts, so the campaign stays fair for everyone.</p>
              <p className="mt-1.5">The campaign is split into <b>chapters of 50 levels</b>. Every chapter introduces a new twist — tougher enemies, elites, or tighter move economies. Replay any cleared level to chase a higher best score.</p>
            </Section>

            <p className="text-[10px] text-center text-muted-foreground pt-2">Shared campaign · Same level, same board for every player</p>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-extrabold text-[13px] uppercase tracking-wider text-foreground/90 mb-1.5">{title}</h3>
      <div className="text-[12px] text-muted-foreground leading-relaxed space-y-1">{children}</div>
    </div>
  );
}
