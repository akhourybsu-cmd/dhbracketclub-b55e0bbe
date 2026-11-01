import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2, Pickaxe, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ClaimButton({ children, className = '', primary = false, danger = false, pending = false, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; danger?: boolean; pending?: boolean }) {
  return <button {...props} type={props.type ?? 'button'} className={`dcl-button ${primary ? 'is-primary' : ''} ${danger ? 'is-danger' : ''} ${className}`} disabled={props.disabled || pending}>{pending && <Loader2 size={15} className="dcl-spin" aria-hidden="true" />}{children}</button>;
}

export function ClaimDialog({ open, onClose, title, description, children, className = '', busy = false }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; className?: string; busy?: boolean }) {
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}><DialogContent className={`dcl-dialog ${className}`} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description ?? 'Manage your mining company.'}</DialogDescription></DialogHeader>{children}</DialogContent></Dialog>;
}

export function ClaimMeter({ value, max, label, tone = 'brass' }: { value: number; max: number; label: string; tone?: 'brass' | 'green' | 'blue' | 'red' }) {
  const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return <span className={`dcl-meter is-${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span style={{ width: `${fraction * 100}%` }} /></span>;
}

export function ClaimBadge({ children, tone = 'brass' }: { children: ReactNode; tone?: 'brass' | 'green' | 'blue' | 'red' | 'muted' }) {
  return <span className={`dcl-badge is-${tone}`}>{children}</span>;
}

export function ClaimState({ error, title, children, onRetry, refreshing = false }: { error?: string | null; title?: string; children?: ReactNode; onRetry?: () => void; refreshing?: boolean }) {
  return <div className="dcl-state" role={error ? 'alert' : 'status'}><span className="dcl-state-mark"><Pickaxe size={34} strokeWidth={1.5} aria-hidden="true" /></span><span className="dcl-eyebrow">DEEP CLAIM</span><h1>{title ?? (error ? 'The lift stopped.' : 'Opening your claim')}</h1><p>{error ?? children ?? 'Checking the camp and calling your crew.'}</p>{onRetry && <ClaimButton onClick={onRetry}><RefreshCw className={refreshing ? 'dcl-spin' : undefined} size={15} aria-hidden="true" />{error ? 'Reconnect' : 'Retry loading'}</ClaimButton>}</div>;
}

export function ClaimEmpty({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return <div className="dcl-empty">{icon}<h3>{title}</h3><p>{children}</p></div>;
}
