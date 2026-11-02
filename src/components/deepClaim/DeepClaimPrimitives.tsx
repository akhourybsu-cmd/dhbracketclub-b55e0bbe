import { createContext, useCallback, useContext, useLayoutEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2, Pickaxe, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import './deepClaimSelectors.css';

export function ClaimButton({ children, className = '', primary = false, danger = false, pending = false, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; danger?: boolean; pending?: boolean }) {
  return <button {...props} type={props.type ?? 'button'} className={`dcl-button ${primary ? 'is-primary' : ''} ${danger ? 'is-danger' : ''} ${className}`} disabled={props.disabled || pending} aria-busy={pending || undefined}>{pending && <Loader2 size={15} className="dcl-spin" aria-hidden="true" />}{children}</button>;
}

const DialogScope = createContext<((id: symbol, open: boolean) => void) | null>(null);

/** Tracks portaled and nested camp dialogs without inspecting the DOM on every frame. */
export function ClaimDialogScope({ children, onOpenChange }: { children: ReactNode; onOpenChange: (open: boolean) => void }) {
  const dialogs = useRef(new Set<symbol>());
  const report = useCallback((id: symbol, open: boolean) => { if (open) dialogs.current.add(id); else dialogs.current.delete(id); onOpenChange(dialogs.current.size > 0); }, [onOpenChange]);
  return <DialogScope.Provider value={report}>{children}</DialogScope.Provider>;
}

export function ClaimDialog({ open, onClose, title, description, children, headerActions, footer, footerNote, className = '', busy = false }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; headerActions?: ReactNode; footer?: ReactNode; footerNote?: ReactNode; className?: string; busy?: boolean }) {
  const report = useContext(DialogScope);
  const token = useRef(Symbol('claim-dialog'));
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { if (!open) return; report?.(token.current, true); const id = token.current; return () => report?.(id, false); }, [open, report]);
  const titleContent = <><DialogTitle ref={heading} tabIndex={-1}>{title}</DialogTitle><DialogDescription className={description?.trim() ? undefined : 'sr-only'}>{description?.trim() || title}</DialogDescription></>;
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}><DialogContent className={`dcl-dialog ${footer ? 'has-fixed-footer' : ''} ${className}`} onOpenAutoFocus={event => { event.preventDefault(); opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; heading.current?.focus({ preventScroll: true }); }} onCloseAutoFocus={event => { event.preventDefault(); if (document.querySelector('[role="dialog"][data-state="open"]')) return; const target = opener.current; if (target?.isConnected && !target.closest('[hidden],[inert]') && !(target instanceof HTMLButtonElement && target.disabled)) target.focus({ preventScroll: true }); else document.querySelector<HTMLElement>('.deep-claim [role="tab"][aria-selected="true"]')?.focus({ preventScroll: true }); }} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}><DialogHeader className={headerActions ? 'dcl-dialog-header has-actions' : undefined}>{headerActions ? <><div className="dcl-dialog-heading">{titleContent}</div><div className="dcl-dialog-header-actions">{headerActions}</div></> : titleContent}</DialogHeader>{footer ? <><div className="dcl-dialog-scroll-body" tabIndex={0} role="region" aria-label={`${title} details`}>{children}</div><div className="dcl-dialog-fixed-footer">{footerNote != null && <div className="dcl-dialog-footer-summary" role="group" aria-label="Transaction summary">{footerNote}</div>}{footer}</div></> : children}</DialogContent></Dialog>;
}

export function ClaimMeter({ value, max, label, valueText, tone = 'brass' }: { value: number; max: number; label: string; valueText?: string; tone?: 'brass' | 'green' | 'blue' | 'red' }) {
  const limit = Number.isFinite(max) && max > 0 ? max : 1;
  const current = Number.isFinite(value) ? Math.max(0, Math.min(limit, value)) : 0;
  const fraction = current / limit;
  return <span className={`dcl-meter is-${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={current} aria-valuetext={valueText} data-complete={fraction === 1}><span style={{ width: `${fraction * 100}%` }} /></span>;
}

export function ClaimBadge({ children, tone = 'brass' }: { children: ReactNode; tone?: 'brass' | 'green' | 'blue' | 'red' | 'muted' }) {
  return <span className={`dcl-badge is-${tone}`}>{children}</span>;
}

export function ClaimState({ error, title, children, onRetry, refreshing = false }: { error?: string | null; title?: string; children?: ReactNode; onRetry?: () => void; refreshing?: boolean }) {
  return <div className="dcl-state" role={error ? 'alert' : 'status'}><span className="dcl-state-mark"><Pickaxe size={34} strokeWidth={1.5} aria-hidden="true" /></span><span className="dcl-eyebrow">DEEP CLAIM</span><h1>{title ?? (error ? 'Unable to load' : 'Loading')}</h1>{(error || children) && <p>{error ?? children}</p>}{onRetry && <ClaimButton onClick={onRetry}><RefreshCw className={refreshing ? 'dcl-spin' : undefined} size={15} aria-hidden="true" />{error ? 'Reconnect' : 'Retry loading'}</ClaimButton>}</div>;
}

export function ClaimEmpty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return <div className="dcl-empty">{icon}<h3>{title}</h3>{children && <p>{children}</p>}</div>;
}
