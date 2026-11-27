import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MESOMON_ASSETS } from '@/lib/mesomon/assets';

/** Discovery stays lightweight: no game rules, renderer or audio in Compete. */
export function MesomonDiscoveryCard() {
  return (
    <Link
      to="/mesomon"
      className="group relative block overflow-hidden rounded-2xl border border-[#9fd6b1]/35 bg-[#102224] text-[#e8e1c6] shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9fd6b1]"
    >
      <img
        src={MESOMON_ASSETS.coverThumbnail}
        alt=""
        loading="lazy"
        decoding="async"
        width={320}
        height={180}
        className="absolute inset-0 h-full w-full object-cover opacity-45 [image-rendering:pixelated]"
      />
      <div className="relative flex min-h-44 items-end gap-4 bg-gradient-to-t from-[#102224] via-[#102224]/60 to-transparent p-5">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-extrabold uppercase tracking-[.22em] text-[#9fd6b1]">Chapter I · Port Marche</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight">Mesomon</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#e8e1c6]">The harbor is singing in two voices.</p>
          <span className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#9fd6b1]/45 bg-[#9fd6b1]/15 px-4 text-xs font-bold text-[#e8e1c6]">
            Enter Port Marche <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <span className="shrink-0 rounded-lg border border-[#e8e1c6]/20 bg-[#102224]/80 px-2 py-1 text-[10px] font-semibold text-[#e8e1c6]">Solo story</span>
      </div>
    </Link>
  );
}
