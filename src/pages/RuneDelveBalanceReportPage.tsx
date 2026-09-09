// Admin-only Rune Delve Balance Report page.
//
// Runs the headless simulator across the full level range × all 4 classes,
// joins the result with live per-level/class aggregates from rune_delve_runs,
// and renders a long-form, printable balance audit. Hidden behind the admin
// role gate.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Loader2, Download, Copy, Activity, Sparkles, AlertTriangle,
  TrendingUp, Shield, Swords, Zap, Coins, Users, Skull,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CLASS_LIST, type HeroClass } from '@/lib/runedelve/classConfig';
import {
  buildBalanceReport, reportToMarkdown,
  type BalanceReport, type LiveLevelAgg,
} from '@/lib/runedelve/balanceReport';

const CLASS_COLORS: Record<HeroClass, string> = {
  warrior: 'hsl(0 72% 55%)',
  mage:    'hsl(220 80% 60%)',
  rogue:   'hsl(45 90% 55%)',
  cleric:  'hsl(140 60% 55%)',
};

function clearColor(rate: number, attempts = 100): string {
  if (attempts === 0) return 'hsl(var(--muted-foreground) / 0.4)';
  if (rate >= 0.7) return 'hsl(142 76% 50%)';
  if (rate >= 0.45) return 'hsl(48 96% 60%)';
  if (rate >= 0.15) return 'hsl(24 90% 55%)';
  return 'hsl(0 72% 55%)';
}

function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function num(n: number, d = 1) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }

const PRIO_STYLES: Record<'P0' | 'P1' | 'P2' | 'P3', string> = {
  P0: 'border-destructive/60 bg-destructive/10 text-destructive',
  P1: 'border-gold/60 bg-gold/10 text-gold',
  P2: 'border-accent/60 bg-accent/10 text-accent',
  P3: 'border-border bg-muted/30 text-muted-foreground',
};

export default function RuneDelveBalanceReportPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [startLevel, setStartLevel] = useState(1);
  const [endLevel, setEndLevel] = useState(150);
  const [runsPerLevel, setRunsPerLevel] = useState(60);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, cls: 'warrior' as HeroClass });
  const [report, setReport] = useState<BalanceReport | null>(null);
  const [elapsed, setElapsed] = useState<string>('');
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    (supabase as any)
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data }: any) => setIsAdmin(!!data));
  }, [user]);

  useEffect(() => () => { cancelRef.current.cancelled = true; }, []);

  if (isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (isAdmin === false) return <Navigate to="/rune-delve" replace />;

  async function fetchLiveData(): Promise<LiveLevelAgg[]> {
    try {
      const { data, error } = await (supabase as any)
        .from('rune_delve_runs')
        .select('level_number, hero_class, dungeon_cleared, turns_used, total_damage, hp_remaining, ability_used, user_id')
        .gte('level_number', startLevel)
        .lte('level_number', endLevel)
        .limit(50000);
      if (error) throw error;
      const map = new Map<string, LiveLevelAgg>();
      for (const row of (data ?? [])) {
        const key = `${row.level_number}|${row.hero_class}`;
        if (!map.has(key)) {
          map.set(key, {
            level: row.level_number,
            hero_class: row.hero_class,
            attempts: 0, clears: 0, avg_turns: 0, avg_dmg: 0, avg_hp: 0,
            unique_players: 0, ability_rate: 0,
          });
        }
        const r = map.get(key)!;
        r.attempts += 1;
        if (row.dungeon_cleared) r.clears += 1;
        r.avg_turns += row.turns_used || 0;
        r.avg_dmg += row.total_damage || 0;
        r.avg_hp += row.hp_remaining || 0;
        r.ability_rate += row.ability_used ? 1 : 0;
      }
      // Convert sums → averages
      const userSets = new Map<string, Set<string>>();
      for (const row of (data ?? [])) {
        const key = `${row.level_number}|${row.hero_class}`;
        if (!userSets.has(key)) userSets.set(key, new Set());
        userSets.get(key)!.add(row.user_id);
      }
      return Array.from(map.values()).map(r => ({
        ...r,
        avg_turns: r.attempts ? r.avg_turns / r.attempts : 0,
        avg_dmg: r.attempts ? r.avg_dmg / r.attempts : 0,
        avg_hp: r.attempts ? r.avg_hp / r.attempts : 0,
        ability_rate: r.attempts ? r.ability_rate / r.attempts : 0,
        unique_players: userSets.get(`${r.level}|${r.hero_class}`)?.size ?? 0,
      }));
    } catch (err) {
      console.warn('Live data fetch failed', err);
      return [];
    }
  }

  async function run() {
    if (running) return;
    cancelRef.current.cancelled = false;
    setRunning(true);
    setReport(null);
    setElapsed('');
    const t0 = performance.now();
    const total = (endLevel - startLevel + 1) * 4;
    setProgress({ done: 0, total, cls: 'warrior' });

    try {
      const live = await fetchLiveData();
      const r = await buildBalanceReport({
        startLevel, endLevel, runsPerLevel,
        liveData: live,
        cancelRef: cancelRef.current,
        onProgress: (done, total, cls) => setProgress({ done, total, cls }),
      });
      const sec = ((performance.now() - t0) / 1000).toFixed(1);
      setElapsed(`${sec}s · ${live.length} live (level, class) cells`);
      setReport(r);
      toast.success('Balance report ready');
    } catch (err: any) {
      if (err?.message !== 'cancelled') {
        console.error(err);
        toast.error('Report failed — see console');
      }
    } finally {
      setRunning(false);
    }
  }

  function copyMarkdown() {
    if (!report) return;
    const md = reportToMarkdown(report);
    navigator.clipboard.writeText(md).then(() => toast.success('Markdown copied'));
  }

  function downloadMarkdown() {
    if (!report) return;
    const md = reportToMarkdown(report);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rune-delve-balance-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/profile" className="p-2 rounded-lg hover:bg-muted/50">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-extrabold tracking-tight">Rune Delve · Balance Report</h1>
            <p className="text-[11px] text-muted-foreground">Full-spectrum audit · sim + live data · admin only</p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {/* Controls */}
        <div className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="From level">
              <input type="number" min={1} max={150} value={startLevel}
                onChange={e => setStartLevel(Math.max(1, Math.min(150, +e.target.value || 1)))}
                disabled={running}
                className="w-full h-10 px-3 rounded-lg bg-muted/40 border border-border font-mono text-sm" />
            </Field>
            <Field label="To level">
              <input type="number" min={1} max={150} value={endLevel}
                onChange={e => setEndLevel(Math.max(1, Math.min(150, +e.target.value || 1)))}
                disabled={running}
                className="w-full h-10 px-3 rounded-lg bg-muted/40 border border-border font-mono text-sm" />
            </Field>
            <Field label="Runs / level / class">
              <select value={runsPerLevel} onChange={e => setRunsPerLevel(+e.target.value)} disabled={running}
                className="w-full h-10 px-3 rounded-lg bg-muted/40 border border-border text-sm">
                {[20, 40, 60, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Total runs">
              <div className="h-10 px-3 rounded-lg bg-muted/30 border border-border text-sm flex items-center font-mono tabular-nums">
                {((endLevel - startLevel + 1) * 4 * runsPerLevel).toLocaleString()}
              </div>
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[11px] text-muted-foreground">
              All 4 classes simulated · live-data joined from <code>rune_delve_runs</code>
            </div>
            <div className="flex items-center gap-2">
              {report && (
                <>
                  <button onClick={copyMarkdown} className="h-10 px-3 rounded-lg bg-muted/40 hover:bg-muted/60 text-xs font-bold flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5" /> Copy MD
                  </button>
                  <button onClick={downloadMarkdown} className="h-10 px-3 rounded-lg bg-muted/40 hover:bg-muted/60 text-xs font-bold flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                </>
              )}
              <button onClick={run} disabled={running || endLevel < startLevel}
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground font-extrabold text-sm flex items-center gap-2 disabled:opacity-50">
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {running ? `Running (${progress.cls})…` : 'Generate report'}
              </button>
            </div>
          </div>

          {running && (
            <div className="space-y-1">
              <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {progress.done} / {progress.total} sweeps · class {progress.cls}
              </div>
            </div>
          )}
        </div>

        {!report && !running && (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">
            Pick a range, hit <span className="font-bold text-foreground">Generate report</span>.
            A full L1-150 sweep at 60 runs/level/class produces ~36k simulated runs and takes ~10-20s.
          </div>
        )}

        {report && <ReportView report={report} elapsed={elapsed} />}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function ReportView({ report, elapsed }: { report: BalanceReport; elapsed: string }) {
  const classes: HeroClass[] = CLASS_LIST.map(c => c.id);

  return (
    <div className="space-y-6">
      {/* Health hero */}
      <div className="glass-card p-5 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-extrabold text-3xl tabular-nums"
            style={{
              background: `conic-gradient(hsl(var(--primary)) ${report.health.score * 3.6}deg, hsl(var(--muted)) 0deg)`,
            }}>
            <div className="w-16 h-16 rounded-xl bg-background flex items-center justify-center">
              {report.health.score}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">Campaign Health</div>
            <div className="text-2xl font-extrabold">{report.health.label}</div>
            <div className="text-[11px] text-muted-foreground">
              {report.totalLevels} levels · {report.runsPerLevel} runs / class / level · {elapsed}
            </div>
          </div>
        </div>
      </div>

      {/* Exec summary */}
      <Section icon={AlertTriangle} title="Executive Summary" iconColor="hsl(var(--destructive))">
        <div className="grid sm:grid-cols-2 gap-3">
          <SummaryList title="Critical Issues" items={report.exec.criticalIssues} accent="hsl(var(--destructive))" />
          <SummaryList title="Quick Wins" items={report.exec.quickWins} accent="hsl(var(--gold))" />
        </div>
      </Section>

      {/* Class matrix heatmap */}
      <Section icon={Swords} title="Class Balance Matrix" iconColor="hsl(var(--primary))">
        <p className="text-[11px] text-muted-foreground mb-2">
          Each cell = sim clear-rate at that level for that class. Green = strong, red = stuck.
        </p>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid gap-px text-[8px] font-mono"
              style={{ gridTemplateColumns: `60px repeat(${report.totalLevels}, 1fr)` }}>
              <div />
              {report.scaling.map(s => (
                <div key={s.level} className="text-center text-muted-foreground/60 tabular-nums">
                  {s.level % 10 === 0 ? s.level : ''}
                </div>
              ))}
              {classes.map(cls => (
                <>
                  <div key={`${cls}-label`} className="text-right pr-2 font-extrabold text-foreground self-center"
                    style={{ color: CLASS_COLORS[cls] }}>{cls}</div>
                  {report.scaling.map(s => (
                    <div key={`${cls}-${s.level}`} className="h-4"
                      style={{ background: clearColor(s.classClear[cls]) }}
                      title={`L${s.level} ${cls}: ${pct(s.classClear[cls])}`} />
                  ))}
                </>
              ))}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
          {report.classSummary.map(cs => (
            <div key={cs.cls} className="glass-card p-3 text-xs space-y-1.5"
              style={{ borderColor: `${CLASS_COLORS[cs.cls]}66` }}>
              <div className="flex items-center justify-between">
                <span className="font-extrabold capitalize" style={{ color: CLASS_COLORS[cs.cls] }}>{cs.name}</span>
                <span className="text-foreground font-mono tabular-nums">{pct(cs.overallClear)}</span>
              </div>
              <div className="text-[10px] text-muted-foreground italic">{cs.passive}</div>
              <div className="text-[10px]">Best ch.{cs.bestChapter} · Worst ch.{cs.worstChapter}</div>
              {cs.deadZones.length > 0 && (
                <div className="text-[10px] text-destructive">
                  {cs.deadZones.length} dead zone{cs.deadZones.length > 1 ? 's' : ''}
                </div>
              )}
              {cs.lockoutLevels.length > 0 && (
                <div className="text-[10px] text-destructive font-bold">
                  {cs.lockoutLevels.length} lockout level{cs.lockoutLevels.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Macro scaling */}
      <Section icon={TrendingUp} title="Macro Scaling Audit" iconColor="hsl(var(--accent))">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider text-[9px]">
              <tr>
                <Th>Lvl</Th><Th>Ch</Th><Th right>HP Tot</Th><Th right>DPS Tot</Th>
                <Th right>Turns</Th><Th right>Req DPS</Th>
                <Th>Best</Th><Th>Worst</Th><Th>Boss</Th>
              </tr>
            </thead>
            <tbody>
              {report.scaling.filter((_, i) => i % Math.max(1, Math.floor(report.scaling.length / 60)) === 0).map(s => (
                <tr key={s.level} className="border-t border-border/40">
                  <Td bold>{s.level}</Td>
                  <Td>{s.chapter}</Td>
                  <Td right>{s.enemyHpTotal}</Td>
                  <Td right>{s.enemyDpsTotal}</Td>
                  <Td right>{s.turnLimit}</Td>
                  <Td right>{num(s.requiredDps)}</Td>
                  <Td><span style={{ color: CLASS_COLORS[s.bestClass] }}>{s.bestClass}</span> {pct(s.classClear[s.bestClass])}</Td>
                  <Td><span style={{ color: CLASS_COLORS[s.worstClass] }}>{s.worstClass}</span> {pct(s.classClear[s.worstClass])}</Td>
                  <Td>{s.bossKind ? <span className="text-gold">{s.bossKind}</span> : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Showing every {Math.max(1, Math.floor(report.scaling.length / 60))}th level · full data exported in markdown.
        </p>
      </Section>

      {/* Masteries */}
      <Section icon={Zap} title="Mastery Catalog" iconColor="hsl(var(--gold))">
        <p className="text-[10px] text-muted-foreground mb-2">
          The base-class simulator does not activate mastery loadouts, so this report does not infer buffs or nerfs from unrelated adjacent levels.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {report.masteries.map(m => {
            const colors: Record<typeof m.verdict, string> = {
              underpowered: 'border-destructive/40 bg-destructive/5',
              balanced: 'border-success/40 bg-success/5',
              overpowered: 'border-gold/40 bg-gold/5',
              situational: 'border-border bg-muted/20',
            };
            return (
              <div key={`${m.cls}-${m.tier}`} className={cn('p-2.5 rounded-lg border text-xs', colors[m.verdict])}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-extrabold" style={{ color: CLASS_COLORS[m.cls] }}>
                    {m.cls} T{m.tier} · {m.name}
                  </div>
                  <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">{m.verdict}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">{m.summary}</div>
                <div className="text-[10px] mt-1 font-mono tabular-nums">Unlocks at class L{m.unlockLevel}</div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Bosses */}
      <Section icon={Skull} title="Boss & Mid-Boss Audit" iconColor="hsl(var(--destructive))">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider text-[9px]">
              <tr>
                <Th>Lvl</Th><Th>Kind</Th><Th>Rule</Th>
                <Th right>Avg Clear</Th><Th right>Avg Turns</Th><Th right>Near-Death</Th><Th>Verdict</Th>
              </tr>
            </thead>
            <tbody>
              {report.bosses.map(b => (
                <tr key={b.level} className="border-t border-border/40">
                  <Td bold>{b.level}</Td>
                  <Td><span className="text-gold">{b.kind}</span></Td>
                  <Td>{b.rule ?? '—'}</Td>
                  <Td right style={{ color: clearColor(b.avgClearAcrossClasses) }}>{pct(b.avgClearAcrossClasses)}</Td>
                  <Td right>{num(b.avgKillTurns)}</Td>
                  <Td right>{pct(b.nearDeathRate)}</Td>
                  <Td>
                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                      b.verdict === 'wall' && 'bg-destructive/20 text-destructive',
                      b.verdict === 'tense' && 'bg-gold/20 text-gold',
                      b.verdict === 'fair' && 'bg-success/20 text-success',
                      b.verdict === 'pushover' && 'bg-accent/20 text-accent',
                    )}>{b.verdict}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Enemies */}
      <Section icon={Users} title="Enemy Roster Usage" iconColor="hsl(var(--muted-foreground))">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider text-[9px]">
              <tr><Th>Name</Th><Th right>Appearances</Th><Th right>Avg HP</Th><Th right>Avg Dmg</Th><Th>Chapters</Th></tr>
            </thead>
            <tbody>
              {report.enemies.slice(0, 25).map(e => (
                <tr key={e.name} className="border-t border-border/40">
                  <Td bold>{e.name}</Td>
                  <Td right>{e.appearances}</Td>
                  <Td right>{num(e.avgHp, 0)}</Td>
                  <Td right>{num(e.avgDmg, 1)}</Td>
                  <Td>{e.chapters.join(', ')}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Mechanics */}
      <Section icon={Activity} title="Mechanics Layer" iconColor="hsl(var(--primary))">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider text-[9px]">
              <tr>
                <Th>Mechanic</Th><Th right>First</Th><Th right>Used At</Th>
                <Th right>Context Δ</Th><Th>Rule Overload</Th>
              </tr>
            </thead>
            <tbody>
              {report.mechanics.map(m => (
                <tr key={m.mechanic} className="border-t border-border/40">
                  <Td bold>{m.mechanic}</Td>
                  <Td right>L{m.introLevel}</Td>
                  <Td right>{m.levels.length}</Td>
                  <Td right style={{ color: m.avgClearImpact < -0.05 ? 'hsl(var(--destructive))' : undefined }}>
                    {(m.avgClearImpact * 100).toFixed(1)}%
                  </Td>
                  <Td>{m.stackingHotspots.length ? m.stackingHotspots.slice(0, 6).join(', ') + (m.stackingHotspots.length > 6 ? '…' : '') : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Context Δ compares the levels where a rule appears with the whole campaign; it is not an isolated mechanic-effect test.
        </p>
      </Section>

      {/* Economy */}
      <Section icon={Coins} title="Economy & Progression" iconColor="hsl(var(--gold))">
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <Stat label="Relic catalog" value={String(report.economy.relicCount)} />
          <Stat label="Avg XP / clear @ L1" value={String(report.economy.xpCurve[0]?.avgXp ?? 0)} />
          <Stat label="Avg XP / clear @ end" value={String(report.economy.xpCurve.at(-1)?.avgXp ?? 0)} />
        </div>
      </Section>

      {/* Live cross-check */}
      <Section icon={Shield} title="Live Data Cross-Check" iconColor="hsl(var(--accent))">
        {report.liveCrossCheck.filter(c => c.flag !== 'no-data').length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No statistically meaningful live data yet (need ≥5 attempts per level/class).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider text-[9px]">
                <tr>
                  <Th>Lvl</Th><Th>Class</Th><Th right>Attempts</Th><Th right>Live %</Th>
                  <Th right>Sim %</Th><Th right>Δ</Th><Th>Flag</Th>
                </tr>
              </thead>
              <tbody>
                {report.liveCrossCheck.filter(c => c.flag !== 'no-data').slice(0, 60).map(c => (
                  <tr key={`${c.level}-${c.cls}`} className="border-t border-border/40">
                    <Td bold>{c.level}</Td>
                    <Td><span style={{ color: CLASS_COLORS[c.cls!] }}>{c.cls}</span></Td>
                    <Td right>{c.liveAttempts}</Td>
                    <Td right>{pct(c.liveClearRate)}</Td>
                    <Td right>{pct(c.simClearRate)}</Td>
                    <Td right style={{ color: c.delta < -0.1 ? 'hsl(var(--destructive))' : c.delta > 0.1 ? 'hsl(var(--success))' : undefined }}>
                      {(c.delta * 100).toFixed(1)}%
                    </Td>
                    <Td>{c.flag}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Recommendations */}
      <Section icon={Sparkles} title="Prioritized Recommendations" iconColor="hsl(var(--gold))">
        {report.recommendations.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No actionable recommendations — campaign is healthy.</p>
        ) : (
          <div className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <div key={i} className={cn('p-3 rounded-lg border text-xs space-y-1', PRIO_STYLES[rec.priority])}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold">{rec.priority} · {rec.area}</span>
                  {rec.file && <code className="text-[9px] opacity-70">{rec.file}</code>}
                </div>
                <div className="text-foreground/90"><span className="font-bold">Finding:</span> {rec.finding}</div>
                <div className="text-foreground/90"><span className="font-bold">Suggestion:</span> {rec.suggestion}</div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Tiny presentational helpers ────────────────────────────────────────────

function Section({ icon: Icon, title, iconColor, children }:
  { icon: any; title: string; iconColor: string; children: React.ReactNode }) {
  return (
    <section className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
        <h2 className="text-sm font-extrabold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SummaryList({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="text-[10px] uppercase tracking-wider font-extrabold mb-2" style={{ color: accent }}>{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">None.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="text-xs leading-snug flex gap-2">
              <span style={{ color: accent }}>•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={cn('p-2 font-extrabold', right ? 'text-right' : 'text-left')}>{children}</th>;
}
function Td({ children, right, bold, style }: { children: React.ReactNode; right?: boolean; bold?: boolean; style?: React.CSSProperties }) {
  return <td className={cn('p-2 tabular-nums', right ? 'text-right' : 'text-left', bold && 'font-extrabold')} style={style}>{children}</td>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">{label}</div>
      <div className="text-lg font-extrabold tabular-nums">{value}</div>
    </div>
  );
}
