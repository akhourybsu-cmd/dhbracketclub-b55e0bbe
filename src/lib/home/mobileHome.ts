import { Bookmark, CalendarDays, Cake, MessageCircle, Newspaper, ScrollText, Trophy, BarChart3, type LucideIcon } from 'lucide-react';
import { APP_NAV_SECTIONS } from '@/lib/appNavigation';
import { NAV_ASSET_SLUGS } from '@/types/assets';

export type HomeSection = 'latest' | 'upcoming' | 'playing';
export interface HomeUpdate { id: string; section: HomeSection; title: string; detail?: string; at?: string; dateOnly?: boolean; label: string; to: string; icon: LucideIcon }
interface Activity { id: string; event_type: string; created_at: string; target_type?: string|null; target_id?: string|null; profiles?: {display_name?:string}|null }
interface Celebration { id: string; kind: string; title: string; daysAway?: number; subline?: string|null }
const EVENTS: Record<string,{verb:string;slug:string;path:string;label:string;icon:LucideIcon}> = {
  draft_completed:{verb:'finished a draft',slug:'draft-arena',path:'/drafts',label:'Draft Arena',icon:Bookmark},
  draft_created:{verb:'started a draft',slug:'draft-arena',path:'/drafts',label:'Draft Arena',icon:Bookmark},
  post_created:{verb:'started a discussion',slug:'posts',path:'/posts',label:'Discussion',icon:Newspaper},
  poll_created:{verb:'opened a poll',slug:'polls',path:'/polls',label:'Poll',icon:MessageCircle},
  ranking_created:{verb:'created a ranking',slug:'rankings',path:'/rankings',label:'Ranking',icon:BarChart3},
  event_created:{verb:'added an event',slug:'events',path:'/events',label:'Event',icon:CalendarDays},
  lore_created:{verb:'added to the club story',slug:'lore',path:'/lore',label:'Lore',icon:ScrollText},
  bracket_submitted:{verb:'submitted a bracket',slug:'brackets',path:'/brackets',label:'Brackets',icon:Trophy},
};

export function homeShortcut(slug:string) {
  const canonical = slug === 'narrative' ? 'narrative-rpg' : slug;
  return APP_NAV_SECTIONS.flatMap(section=>section.items).find(item=>NAV_ASSET_SLUGS[item.path]===canonical);
}

export function buildHomeUpdates(input: {
  installed: Set<string>; activity: Activity[];
  events: {id:string;title:string;starts_at:string}[];
  campaigns: {id:string;title:string;pitch?:string|null;status:string}[];
  drafts: {id:string;topic:string;status:string}[];
  today: Celebration[]; upcoming: Celebration[]; showCelebrations:boolean;
  now?:number;
}): HomeUpdate[] {
  const now=input.now ?? Date.now();
  const rows:HomeUpdate[]=[];
  if(input.installed.has('feed')) for(const activity of input.activity) {
    const meta=EVENTS[activity.event_type];
    if(!meta || !input.installed.has(meta.slug)) continue;
    // An activity row may outlive its target. Never fabricate /undefined links.
    const target=activity.target_id ? encodeURIComponent(activity.target_id) : null;
    const to=meta.slug==='brackets' ? (target && activity.target_type==='pool' ? '/pools/'+target : '/brackets') : meta.path+(target?'/'+target:'');
    rows.push({id:'activity-'+activity.id,section:'latest',title:(activity.profiles?.display_name || 'A club member')+' '+meta.verb,
      label:meta.label,at:activity.created_at,to,icon:meta.icon});
  }
  if(input.installed.has('events')) for(const event of input.events) {
    if(!Number.isFinite(Date.parse(event.starts_at)) || Date.parse(event.starts_at)<now) continue;
    rows.push({id:'event-'+event.id,section:'upcoming',title:event.title,label:'Event',at:event.starts_at,to:'/events/'+encodeURIComponent(event.id),icon:CalendarDays});
  }
  if(input.installed.has('narrative-rpg')) for(const campaign of input.campaigns.filter(c=>c.status==='active')) {
    rows.push({id:'campaign-'+campaign.id,section:'playing',title:campaign.title,detail:campaign.pitch || 'Continue your adventure',label:'Campaign',to:'/narrative/'+encodeURIComponent(campaign.id),icon:ScrollText});
  }
  if(input.installed.has('draft-arena')) for(const draft of input.drafts.filter(d=>d.status==='in_progress'||d.status==='setup')) {
    rows.push({id:'draft-'+draft.id,section:'playing',title:draft.topic,label:draft.status==='in_progress'?'Draft in progress':'Draft lobby',to:'/drafts/'+encodeURIComponent(draft.id),icon:Bookmark});
  }
  if(input.showCelebrations && input.installed.has('birthdays-milestones')) {
    for(const item of input.today) rows.push({id:'today-'+item.kind+'-'+item.id,section:'latest',title:item.kind==='birthday'?item.title+'’s birthday':item.title,detail:item.subline || 'Celebrate with your club',label:'Today',at:new Date(now).toISOString(),to:'/celebrations',icon:Cake});
    for(const item of input.upcoming.filter(c=>(c.daysAway??0)>0 && (c.daysAway??0)<=7)) {
      const date = new Date(now);
      date.setDate(date.getDate() + item.daysAway!);
      rows.push({id:'upcoming-'+item.kind+'-'+item.id,section:'upcoming',title:item.title,label:item.kind==='birthday'?'Birthday':'Milestone',at:date.toISOString(),dateOnly:true,to:'/celebrations',icon:Cake});
    }
  }
  return [...new Map(rows.map(row=>[row.id,row])).values()].sort((a,b)=>{
    if(a.section!==b.section) return a.section.localeCompare(b.section);
    const first=Date.parse(a.at||'')||0,second=Date.parse(b.at||'')||0;
    return a.section==='upcoming'?first-second:second-first;
  });
}
