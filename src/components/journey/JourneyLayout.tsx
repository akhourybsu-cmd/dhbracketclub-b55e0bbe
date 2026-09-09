import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Compass, LogOut, ScrollText, Settings2, Shield, User, Volume2, VolumeX } from 'lucide-react';
import '@/styles/journey.css';
import { useJourneySettings } from './useJourneySettings';
import { JourneyReadingSettings } from './JourneyReadingSettings';
import {
  journeyEnter, journeyLeave, playSelect, playSoft, setMusicEnabled, setSfxEnabled, unlockAudio,
} from '@/lib/journey/audio';

/**
 * Full-screen standalone shell for The Splendid Journey. Applies the `.jy-mode`
 * design-system scope, so no fantasy token can leak into DH Club components,
 * and owns the module's own header + navigation. AppLayout hides DH chrome
 * while any /journey/* route is active.
 */
export function JourneyLayout({ children, chrome = true }: { children: ReactNode; chrome?: boolean }) {
  const { textSize, reducedMotion, music, soundEffects, update } = useJourneySettings();
  const { pathname } = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Keep the ambient pad alive across journey screens; tear down on exit.
  useEffect(() => { journeyEnter(); return () => journeyLeave(); }, []);

  // Sync the synth with the reader's audio preferences.
  useEffect(() => { setMusicEnabled(music); }, [music]);
  useEffect(() => { setSfxEnabled(soundEffects); }, [soundEffects]);

  // Audio may only begin after a real gesture — unlock on the first one.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // One delegated handler gives every button its fantasy voice: a flourish for
  // story choices, a soft note for everything else.
  const onPressSound = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('.jy-choice, .jy-action, .jy-btn');
    if (!el || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return;
    if (el.classList.contains('jy-choice') || el.classList.contains('jy-action')) playSelect();
    else playSoft();
  };

  return (
    <div
      className={`jy-mode jy-shell jy-text-${textSize} ${reducedMotion ? 'jy-reduced-motion' : ''}`}
      onClick={onPressSound}
    >
      {chrome && (
        <header
          className="sticky top-0 z-30 backdrop-blur-sm"
          style={{
            background: 'linear-gradient(180deg, hsl(28 12% 7% / 0.96), hsl(28 12% 7% / 0.78))',
            borderBottom: '1px solid hsl(var(--jy-border-subtle))',
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
            <Link to="/journey" className="min-w-0 flex-1">
              <div className="jy-eyebrow truncate">The Splendid Journey</div>
              <div className="jy-display truncate text-[0.9rem] jy-secondary">of Unimaginable Consequence</div>
            </Link>
            <button
              type="button"
              className="jy-btn jy-btn-ghost jy-btn-sm"
              onClick={() => update('music', !music)}
              aria-label={music ? 'Mute music' : 'Play music'}
              aria-pressed={music}
              title={music ? 'Mute music' : 'Play music'}
            >
              {music ? <Volume2 className="h-3.5 w-3.5" aria-hidden /> : <VolumeX className="h-3.5 w-3.5" aria-hidden />}
            </button>
            <button
              type="button"
              className="jy-btn jy-btn-ghost jy-btn-sm"
              onClick={() => setSettingsOpen(true)}
              aria-label="Reading settings"
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Reading</span>
            </button>
            <Link to="/dashboard" className="jy-btn jy-btn-ghost jy-btn-sm" aria-label="Exit to DH Club">
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Exit</span>
            </Link>
          </div>
        </header>
      )}

      <main
        className="mx-auto w-full max-w-5xl px-4 pt-4"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>

      {chrome && <JourneyNav pathname={pathname} />}
      {settingsOpen && <JourneyReadingSettings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

const NAV = [
  { to: '/journey', label: 'Journey', icon: Compass, exact: true },
  { to: '/journey/journal', label: 'Journal', icon: ScrollText },
  { to: '/journey/character', label: 'Hero', icon: User },
  { to: '/journey/world', label: 'World', icon: BookOpen },
];

function JourneyNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Journey navigation"
      className="fixed inset-x-0 bottom-0 z-30"
      style={{
        background: 'linear-gradient(180deg, hsl(28 12% 8% / 0.9), hsl(28 14% 5%))',
        borderTop: '1px solid hsl(var(--jy-border-subtle))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="mx-auto flex max-w-5xl">
        {NAV.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? pathname === to : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className="flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 py-2"
              style={{ color: active ? 'hsl(var(--jy-gold))' : 'hsl(var(--jy-text-muted))' }}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="text-[0.6875rem] tracking-wide">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Styled fantasy error state — never a blank page. */
export function JourneyError({ message, onRetry, detail }: { message: string; onRetry?: () => void; detail?: string }) {
  return (
    <div className="jy-panel-raised mx-auto max-w-lg p-6 text-center">
      <Shield className="mx-auto mb-3 h-6 w-6" style={{ color: 'hsl(var(--jy-blood))' }} aria-hidden />
      <h2 className="jy-display mb-2 text-xl">The road is blocked</h2>
      <p className="jy-secondary mb-4 text-sm">{message}</p>
      {detail && <pre className="jy-muted mb-4 overflow-auto text-left text-[0.7rem]">{detail}</pre>}
      <div className="flex justify-center gap-2">
        {onRetry && <button className="jy-btn jy-btn-primary" onClick={onRetry}>Try again</button>}
        <Link className="jy-btn jy-btn-ghost" to="/journey">Return to the campaign hall</Link>
      </div>
    </div>
  );
}

export function JourneySkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded-sm"
          style={{
            background: 'linear-gradient(90deg, hsl(var(--jy-bg-surface)), hsl(var(--jy-bg-elevated)), hsl(var(--jy-bg-surface)))',
            width: `${70 + ((i * 13) % 30)}%`,
          }}
        />
      ))}
    </div>
  );
}
