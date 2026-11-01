import { ArrowLeft, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import './showdown.css';
import './afterimage/afterimageResults.css';
import './cipher/cipherHub.css';
import { AfterimageMark } from './AfterimageMark';
import { CipherMark } from './cipher/CipherMark';

export function PrismMark({ className = '', label }: { className?: string; label?: string }) {
  return <svg viewBox="0 0 160 160" className={`sd-prism-mark ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <path d="M0 82H49" fill="none" stroke="#7ceeff" strokeWidth="5" />
    <path d="m102 68 58-28M109 83h51m-56 14 56 25" fill="none" strokeWidth="4" strokeLinecap="round" className="sd-prism-rays" />
    <path d="m78 24 43 78-43 32-43-32Z" fill="rgb(85 162 255 / .12)" stroke="#8decff" strokeWidth="2" />
    <path d="m78 24 1 78 42 0m-42 0-44 0m44 0-1 32" fill="none" stroke="#aab7ff" strokeWidth="1.5" />
    <path d="m78 24 1 78-44 0Z" fill="rgb(123 231 255 / .14)" />
    <path d="m79 102 42 0-43 32Z" fill="rgb(218 128 255 / .2)" />
    <circle cx="79" cy="82" r="7" fill="#efffff" className="sd-prism-core" />
    <path d="m17 27 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#a5f7ff" opacity=".7" />
    <path d="m132 137 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" fill="#d5aeff" opacity=".7" />
  </svg>;
}

export function ShowdownGameMark({ gameKey, ...props }: { gameKey?: string; className?: string; label?: string }) {
  return gameKey === 'cipher_duel' ? <CipherMark {...props} /> : gameKey === 'afterimage' ? <AfterimageMark {...props} /> : <PrismMark {...props} />;
}

export function ShowdownFrame({ children, title = 'DH Showdown', subtitle, backTo = '/compete', action, className = '', gameKey }: {
  children: ReactNode; title?: string; subtitle?: string; backTo?: string; action?: ReactNode; className?: string; gameKey?: string;
}) {
  return <main className={`sd-shell ${gameKey === 'afterimage' ? 'sd-afterimage' : gameKey === 'cipher_duel' ? 'sd-cipher' : ''} ${className}`} data-game={gameKey} data-testid="showdown-shell">
    <header className="sd-header">
      <Link to={backTo} className="sd-icon-button" aria-label={backTo.split('?')[0] === '/showdown' ? 'Back to Showdown' : 'Back to Compete'}><ArrowLeft size={19} aria-hidden="true" /></Link>
      <div className="sd-header-brand"><ShowdownGameMark gameKey={gameKey} /><div><span>{title}</span>{subtitle && <small>{subtitle}</small>}</div></div>
      {action}
    </header>
    {children}
  </main>;
}

export function ShowdownDataState({ error, retry, title }: { error?: string | null; retry?: () => void; title?: string }) {
  return <div className="sd-data-state" role={error ? 'alert' : 'status'}>
    {error ? <ShieldCheck aria-hidden="true" /> : <Loader2 className="sd-loading" aria-hidden="true" />}
    <h2>{title ?? (error ? 'Connection interrupted' : 'Opening Showdown')}</h2>
    <p>{error ?? 'Preparing your club’s challenge board.'}</p>
    {error && retry && <button type="button" className="sd-button sd-primary" onClick={retry}><RefreshCw size={16} aria-hidden="true" />Try again</button>}
  </div>;
}

export function ShowdownAvatar({ name, url, className = '' }: { name: string; url?: string | null; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? '').join('').toUpperCase() || '?';
  return <span className={`sd-avatar ${className}`} aria-hidden="true"><span>{initials}</span>{url && <img key={url} src={url} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} />}</span>;
}
