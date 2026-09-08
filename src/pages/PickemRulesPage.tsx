import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Info, Lock, Trophy, Star, Zap, Users } from 'lucide-react';
import { TurfBackdrop } from '@/components/pickem/TurfBackdrop';
import { PickemShell } from '@/components/pickem/PickemShell';
import { useActiveSeason } from '@/hooks/usePickem';

export default function PickemRulesPage() {
  const { season } = useActiveSeason();
  const lockMinutes = season?.pick_lock_minutes ?? 10;
  return (
    <PickemShell>
    <div className="space-y-4 pb-6">

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <TurfBackdrop className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary/20 border border-primary/40">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-gold/95">Pick'em Playbook</p>
              <h1 className="text-[22px] font-extrabold tracking-tight leading-tight text-white">How It Works</h1>
            </div>
          </div>
        </TurfBackdrop>
      </motion.div>

      {[
        { icon: <Trophy className="w-4 h-4 text-gold" />, title: 'Goal',
          body: <>Pick the winner of every NFL game each week. The player with the most correct picks at the end of the season wins.</> },
        { icon: <Zap className="w-4 h-4 text-success" />, title: 'Scoring',
          body: <>Each correct pick = <strong>1 point</strong>. No spreads, no confidence, no wagers — just winners.</> },
        { icon: <Lock className="w-4 h-4 text-muted-foreground" />, title: 'Locking',
          body: <>The entire weekly card locks <strong>{lockMinutes} minute{lockMinutes === 1 ? '' : 's'} before the first kickoff</strong>. You can change picks until that cutoff; after it, the card is final.</> },
        { icon: <Users className="w-4 h-4 text-primary" />, title: 'Club Consensus',
          body: <>Everyone else’s choices stay private while picks are open. Once the card locks, each matchup reveals your club’s pick percentages.</> },
        { icon: <Star className="w-4 h-4 text-gold" />, title: 'Tiebreaker',
          body: <>Each week has a featured game. Predict the <strong>total combined points</strong> of that game. Your prediction is used to break weekly ties (closest wins).</> },
        { icon: <Trophy className="w-4 h-4 text-gold" />, title: 'Standings',
          body: <ul className="list-disc list-inside space-y-1">
            <li><strong>Weekly:</strong> Most correct → closest tiebreaker</li>
            <li><strong>Season:</strong> Most total correct → best average weekly rank → most weekly wins</li>
          </ul> },
      ].map((s, i) => (
        <motion.div key={s.title}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}>
          <Section icon={s.icon} title={s.title}>{s.body}</Section>
        </motion.div>
      ))}

      <p className="text-[10px] text-muted-foreground/60 text-center px-4 leading-relaxed pt-2">
        For fun, not funds. No money, no gambling — just bragging rights with your crew.
      </p>
    </div>
    </PickemShell>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h2 className="font-extrabold text-[14px] tracking-tight">{title}</h2>
      </div>
      <div className="text-[12px] text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}
