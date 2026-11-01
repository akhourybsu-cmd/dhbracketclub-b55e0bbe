import { Link } from 'react-router-dom';
import { ArrowUpRight, Gem } from 'lucide-react';
import { DeepClaimMark } from './DeepClaimMark';

export function DeepClaimDiscoveryCard() {
  return <Link to="/deep-claim" className="group relative block overflow-hidden rounded-2xl border border-[#a48b5b]/40 p-5 text-[#f6edda] shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d2ba82]" style={{ background: 'radial-gradient(ellipse at 0% 0%,#69724745,transparent 65%),linear-gradient(135deg,#30372c,#17211e)' }}>
    <div className="relative flex items-center gap-4">
      <DeepClaimMark className="h-[82px] w-[82px] shrink-0 sm:h-[92px] sm:w-[92px]" decorative />
      <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-[9px] font-extrabold tracking-[.2em] text-[#d8c28e]"><Gem className="h-3 w-3" aria-hidden="true" />A PROSPECTOR’S EMPIRE</p><h2 className="mt-1 text-xl font-extrabold tracking-tight">Deep Claim</h2><p className="mt-1 text-xs leading-relaxed text-[#c6ceba]">Build a crew. Work the seams.<br />Return to a growing claim.</p></div>
      <ArrowUpRight className="h-5 w-5 shrink-0 text-[#d8c28e] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
    </div>
    <span className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[#c4aa73]/35 bg-[#c4aa73]/10 px-4 text-xs font-bold text-[#edddba]">Enter Deep Claim</span>
  </Link>;
}
