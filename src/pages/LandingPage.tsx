import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import dhMonogram from '@/assets/dh-monogram.png';

export default function LandingPage() {
  const { user } = useAuth();

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Subtle ambient glow */}
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[200px] pointer-events-none opacity-30" style={{ background: 'radial-gradient(circle, hsl(152, 72%, 46%, 0.15), transparent)' }} />

      {/* Minimal header */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <img src={dhMonogram} alt="DH" className="w-6 h-6 object-contain opacity-60" />
        </div>
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground font-semibold text-[12px] h-11 min-h-11 px-3 tracking-wide uppercase">
          <Link to="/auth">Enter</Link>
        </Button>
      </header>

      {/* Hero — minimal, mysterious */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="max-w-sm w-full"
        >
          {/* Monogram — the centerpiece */}
          <motion.img
            src={dhMonogram}
            alt="DH"
            className="w-32 h-32 sm:w-44 sm:h-44 object-contain mx-auto mb-10"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, type: 'spring', damping: 20, stiffness: 100 }}
            style={{ filter: 'drop-shadow(0 0 60px hsl(152, 72%, 46%, 0.12))' }}
          />

          {/* Cryptic tagline */}
          <motion.p
            className="text-muted-foreground text-[13px] sm:text-[15px] font-medium tracking-wide leading-relaxed mb-10 max-w-[260px] mx-auto"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            If you know, you know.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <Button asChild size="lg" className="gap-2.5 px-10 h-12 text-[14px] font-bold rounded-xl btn-press">
              <Link to="/auth">Get In <ArrowRight className="w-4 h-4" /></Link>
            </Button>
          </motion.div>

          {/* Subtle invite hint */}
          <motion.p
            className="text-muted-foreground/50 text-[10px] tracking-[0.15em] uppercase font-semibold mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.0 }}
          >
            Invite only
          </motion.p>

          {/* Start your own club */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="mt-10 pt-6 border-t border-border/30"
          >
            <Link to="/auth" className="inline-flex min-h-11 items-center justify-center py-2 text-[11px] text-muted-foreground/60 hover:text-primary transition-colors">
              Want your own circle? <span className="font-semibold underline-offset-2 underline">Request a club →</span>
            </Link>
          </motion.div>
        </motion.div>
      </main>

      <footer className="relative z-10 text-center py-6">
        <p className="text-[9px] text-muted-foreground/40 font-semibold uppercase tracking-[0.2em]">
          Est. 2025
        </p>
      </footer>
    </div>
  );
}
