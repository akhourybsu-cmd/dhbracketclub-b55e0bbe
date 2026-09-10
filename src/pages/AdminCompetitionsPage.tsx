import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminSectionCard } from '@/components/admin/AdminPrimitives';
import { Trophy, Bookmark, Swords, BarChart3, Sliders, Users } from 'lucide-react';

export default function AdminCompetitionsPage() {
  return (
    <AdminLayout title="Competitions" subtitle="Per-module admin tools across the platform.">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 mb-2 px-1">
        Live Modules
      </p>
      <div className="space-y-2 mb-5">
        <AdminSectionCard to="/pickem/admin" icon={Trophy} label="NFL Game Center Admin" description="Seasons, weeks, games, scoring, and markets" color="gold" />
        <AdminSectionCard to="/drafts" icon={Bookmark} label="Drafts Hub" description="Manage drafts & league seasons" color="accent" />
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 mb-2 px-1">
        Rune Delve
      </p>
      <div className="space-y-2 mb-5">
        <AdminSectionCard to="/rune-delve/analytics" icon={Swords} label="Analytics" description="Per-level stats, cliffs, AI handoff" color="primary" />
        <AdminSectionCard to="/rune-delve/simulator" icon={Swords} label="Playtest Sim" description="Stress-test any future level (1-150)" color="accent" />
        <AdminSectionCard to="/rune-delve/balance" icon={BarChart3} label="Balance Report" description="Full-spectrum audit · sim + live data" color="gold" />
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 mb-2 px-1">
        Nexus Defense
      </p>
      <div className="space-y-2">
        <AdminSectionCard to="/nexus/balance" icon={BarChart3} label="Balance" description="Mission, tower & ability telemetry" color="primary" />
        <AdminSectionCard to="/nexus/calibration" icon={Sliders} label="Mission Calibration" description="Tune live mission difficulty" color="warning" />
        <AdminSectionCard to="/nexus/operation" icon={Users} label="Co-op Operations" description="Start, monitor & end club operations" color="accent" />
      </div>
    </AdminLayout>
  );
}
