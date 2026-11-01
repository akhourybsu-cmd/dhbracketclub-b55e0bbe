import { Link } from 'react-router-dom';
import { ArrowUpRight, Gem, Swords } from 'lucide-react';

/** Discovery stays in Compete; invitations use the existing notification inbox. */
export function ShowdownDiscoveryCard() {
  return <Link to="/showdown" className="group relative block overflow-hidden rounded-2xl border border-cyan-300/25 p-5 text-white shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
    style={{ background: 'radial-gradient(ellipse at 10% 0%,#08749270,transparent 60%),radial-gradient(ellipse at 100% 100%,#8b35a64d,transparent 65%),linear-gradient(145deg,#111b32,#080f20)' }}>
    <div className="relative flex items-center gap-4">
      <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-2xl border border-cyan-200/25 bg-cyan-200/5"><Gem className="h-10 w-10 text-cyan-200" aria-hidden="true" style={{ filter: 'drop-shadow(0 0 13px #22d3ee66)' }} /></div>
      <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-[9px] font-extrabold tracking-[.2em] text-cyan-200"><Swords className="h-3 w-3" aria-hidden="true" />ASYNC 1V1</p><h2 className="mt-1 text-xl font-extrabold tracking-tight">DH Showdown</h2><p className="mt-1 text-xs leading-relaxed text-slate-300">Prism Break. Three boards.<br />Play on your schedule.</p></div>
      <ArrowUpRight className="h-5 w-5 shrink-0 text-cyan-200 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
    </div><span className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-100">Enter Showdown</span>
  </Link>;
}
