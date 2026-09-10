import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronRight, Clock3, LayoutGrid, MessageSquare, Pencil, Plus, RefreshCw, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { NextAction } from '@/lib/home/nextAction';
import { homeShortcut, type HomeSection, type HomeUpdate } from '@/lib/home/mobileHome';
import { notificationTime } from '@/lib/notifications';
import type { UseQuickBarReturn } from './useQuickBar';
import { MobileIconButton } from '@/components/mobile/MobileIconButton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface Props {
  displayName: string; clubName: string; installedSlugs: Set<string>;
  actions: NextAction[]; updates: HomeUpdate[]; shortcuts: UseQuickBarReturn;
  refreshing?: boolean; error?: string|null; onRefresh: () => void; children?: ReactNode;
}
const SECTIONS: {key:HomeSection;label:string;empty:string}[] = [
  {key:'latest',label:'Latest',empty:'A little quiet here—for now.'},
  {key:'upcoming',label:'Upcoming',empty:'Nothing on the calendar yet.'},
  {key:'playing',label:'In progress',empty:'No games or stories in progress.'},
];

export function MobileHome({displayName,clubName,installedSlugs,actions,updates,shortcuts,refreshing,error,onRefresh,children}:Props) {
  const [section,setSection]=useState<HomeSection>('latest');
  const [edit,setEdit]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [showAll,setShowAll]=useState(false);
  const panelId=useId();
  const firstName=displayName.trim().split(/\s+/)[0];
  const pinned=shortcuts.pinned.filter(item=>homeShortcut(item.asset.slug));
  const current=updates.filter(row=>row.section===section);
  const attention=actions.filter(action=>!action.assetSlug || installedSlugs.has(action.assetSlug));
  return <div className="mobile-home space-y-6 pb-4">
    <header className="flex items-center gap-3 pt-1">
      <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{format(new Date(),'EEEE, MMMM d')}</p>
        <h1 className="mt-1.5 break-words text-[26px] font-bold leading-tight tracking-[-0.035em]">{firstName?'Hey, '+firstName+'.':'Welcome home.'}</h1>
        <p className="mt-1 break-words text-[13px] text-muted-foreground">Your corner of {clubName}.</p></div>
      <MobileIconButton aria-label="Refresh home" disabled={refreshing} onClick={onRefresh} className="border-border bg-card"><RefreshCw className={cn('h-4 w-4',refreshing&&'animate-spin')} /></MobileIconButton>
    </header>
    {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><p>{error}</p><button className="min-h-11 font-semibold text-primary" onClick={onRefresh}>Try again</button></div>}

    {attention.length>0 && <section aria-label="For you" className="overflow-hidden rounded-2xl border border-primary/25 bg-primary/5">
      <div className="flex items-center justify-between px-4 pt-3"><h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">For you</h2><span className="text-[11px] text-muted-foreground">{attention.length} update{attention.length===1?'':'s'}</span></div>
      {(expanded?attention:attention.slice(0,1)).map(action=><Link key={action.id} to={action.to} className="flex min-h-[76px] items-center gap-3 px-4 py-3 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><action.icon className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold leading-snug">{action.label}</span>{action.sub&&<span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{action.sub}</span>}</span><ArrowRight className="h-4 w-4 shrink-0 text-primary" />
      </Link>)}
      {attention.length>1&&<button aria-expanded={expanded} onClick={()=>setExpanded(!expanded)} className="min-h-11 w-full border-t border-primary/15 px-4 text-left text-xs font-semibold text-primary">{expanded?'Show less':'See '+(attention.length-1)+' more'}</button>}
    </section>}

    {(pinned.length>0||shortcuts.available.length>0)&&<section aria-label="Your shortcuts">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-bold">Your shortcuts</h2><button onClick={()=>setEdit(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:text-foreground" aria-label="Customize shortcuts"><Pencil className="h-3.5 w-3.5" />Customize</button></div>
      {pinned.length>0 ? <div className={cn('grid gap-2',pinned.length<=2?'grid-cols-2':pinned.length===4?'grid-cols-4':'grid-cols-3')}>{pinned.map(item=>{
        const meta=homeShortcut(item.asset.slug)!;const Icon=meta.icon;
        return <Link key={item.id} to={meta.path} className="flex min-h-[80px] min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-2 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Icon className="h-[18px] w-[18px] shrink-0 text-primary" /><span className="min-w-0 break-words text-center text-[11px] font-semibold leading-snug">{meta.label}</span></Link>;
      })}</div>:<button onClick={()=>setEdit(true)} className="min-h-12 w-full rounded-xl border border-dashed border-border text-sm text-muted-foreground">Choose your favorite apps</button>}
    </section>}

    <section aria-label="Club activity" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-base font-bold tracking-tight">Around the club</h2>{installedSlugs.has('feed')&&<Link to="/feed" className="inline-flex min-h-11 items-center gap-1 px-1 text-xs font-medium text-muted-foreground">Full feed<ChevronRight className="h-3.5 w-3.5" /></Link>}</div>
      <div className="mb-3 grid grid-cols-3 rounded-xl bg-muted/50 p-1" aria-label="Activity views" role="tablist">
        {SECTIONS.map((tab,index)=><button key={tab.key} id={panelId+'-'+tab.key} role="tab" aria-selected={section===tab.key} aria-controls={panelId} tabIndex={section===tab.key?0:-1}
          onKeyDown={event=>{const next=event.key==='ArrowRight'?(index+1)%3:event.key==='ArrowLeft'?(index+2)%3:event.key==='Home'?0:event.key==='End'?2:-1;if(next<0)return;event.preventDefault();setSection(SECTIONS[next].key);setShowAll(false);document.getElementById(panelId+'-'+SECTIONS[next].key)?.focus();}}
          onClick={()=>{setSection(tab.key);setShowAll(false);}} className={cn('min-h-11 rounded-lg px-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',section===tab.key?'bg-card text-foreground shadow-sm':'text-muted-foreground hover:text-foreground')}>{tab.label}</button>)}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={panelId+'-'+section} tabIndex={0} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        {current.length===0 ? <div className="px-5 py-8 text-center"><Clock3 className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="text-sm font-semibold">{SECTIONS.find(tab=>tab.key===section)?.empty}</p><p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{section==='latest'?'Fresh conversations, results, and club moments will land here.':section==='upcoming'?'Club events and celebrations will appear here.':'Active drafts and adventures will be ready to jump back into.'}</p>{installedSlugs.has('chat')&&<Link to="/chat" className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-primary"><MessageSquare className="h-4 w-4" />Say hello in chat</Link>}</div>
          : <ul className="divide-y divide-border/60">{(showAll?current:current.slice(0,6)).map(row=><li key={row.id}><Link to={row.to} className="flex items-start gap-3 px-4 py-4 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground"><row.icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block break-words text-[13px] font-semibold leading-snug">{row.title}</span>{row.detail&&<span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">{row.detail}</span>}<span className="mt-1.5 block text-[11px] text-muted-foreground">{row.label}{row.at&&Number.isFinite(Date.parse(row.at))?' · '+(row.section==='upcoming'?format(new Date(row.at),row.dateOnly?'EEE, MMM d':'EEE, MMM d · h:mm a'):notificationTime(row.at)):''}</span></span><ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" /></Link></li>)}</ul>}
        {current.length>6&&<button onClick={()=>setShowAll(!showAll)} aria-expanded={showAll} className="min-h-11 w-full border-t border-border text-xs font-semibold text-primary">{showAll?'Show less':'Show all '+current.length+' updates'}</button>}
      </div>
    </section>
    {children}
    <Sheet open={edit} onOpenChange={setEdit}><SheetContent side="bottom" className="mx-auto flex max-h-[85dvh] max-w-lg flex-col rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:flex [&>button:last-child]:h-11 [&>button:last-child]:w-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center">
      <SheetHeader className="pr-10 text-left"><SheetTitle>Your shortcuts</SheetTitle><SheetDescription>Pin up to {shortcuts.max} apps. Your order stays saved for this club.</SheetDescription></SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {shortcuts.pinned.map((item,index)=><div key={item.id} className="flex min-h-14 items-center gap-1 border-b border-border"><span className="min-w-0 flex-1 text-sm font-medium">{homeShortcut(item.asset.slug)?.label || item.asset.name}</span>
          <MobileIconButton aria-label={'Move '+item.asset.name+' up'} disabled={index===0} onClick={()=>shortcuts.move(item.asset.slug,'up')}><ArrowUp className="h-4 w-4" /></MobileIconButton>
          <MobileIconButton aria-label={'Move '+item.asset.name+' down'} disabled={index===shortcuts.pinned.length-1} onClick={()=>shortcuts.move(item.asset.slug,'down')}><ArrowDown className="h-4 w-4" /></MobileIconButton>
          <MobileIconButton aria-label={'Unpin '+item.asset.name} onClick={()=>shortcuts.unpin(item.asset.slug)}><X className="h-4 w-4" /></MobileIconButton>
        </div>)}
        <p className="mb-1 mt-5 text-xs font-semibold text-muted-foreground">More apps</p>
        {shortcuts.available.filter(item=>homeShortcut(item.asset.slug)).map(item=><button key={item.id} onClick={()=>shortcuts.pin(item.asset.slug)} disabled={shortcuts.pinned.length>=shortcuts.max} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-sm hover:bg-muted/50 disabled:opacity-40"><LayoutGrid className="h-4 w-4 text-muted-foreground" /><span className="flex-1">{homeShortcut(item.asset.slug)?.label}</span><Plus className="h-4 w-4" /></button>)}
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-border pt-2"><button className="min-h-11 px-2 text-xs text-muted-foreground" onClick={shortcuts.reset}>Reset shortcuts</button><button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground" onClick={()=>setEdit(false)}><Check className="h-4 w-4" />Done</button></div>
    </SheetContent></Sheet>
  </div>;
}
