import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Bookmark, MessageSquare } from 'lucide-react';
import { MobileHome } from '@/components/home/MobileHome';
import { buildHomeUpdates, homeShortcut } from '@/lib/home/mobileHome';
import { notificationCursor, notificationPath, notificationTime } from '@/lib/notifications';
import type { InstalledAsset } from '@/types/assets';
import type { NextAction } from '@/lib/home/nextAction';

const now=Date.parse('2026-09-10T17:00:00Z');
const asset=(slug:string,name=slug)=>({id:slug,asset:{slug,name},enabled:true,visible_to_members:true,sort_order:1}) as InstalledAsset;
const shortcuts={pinned:[asset('nfl-pickem'),asset('chat')],available:[asset('events')],max:6,pin:vi.fn(),unpin:vi.fn(),move:vi.fn(),reset:vi.fn()};
const actions:NextAction[]=[{id:'pick',label:'Your draft pick is up',sub:'Best movie villains',priority:100,icon:Bookmark,accent:'gold',to:'/drafts/one',assetSlug:'draft-arena'},
 {id:'chat',label:'New chat in #general',priority:55,icon:MessageSquare,accent:'primary',to:'/chat',assetSlug:'chat'}];
const input={installed:new Set(['feed','draft-arena','chat','events','birthdays-milestones']),now,
 activity:[{id:'old',event_type:'draft_created',created_at:'2026-09-09T17:00:00Z',target_id:null,profiles:{display_name:'Alex'}},
 {id:'new',event_type:'draft_completed',created_at:'2026-09-10T16:00:00Z',target_id:'one',profiles:{display_name:'Sam'}}],
 events:[{id:'late',title:'Sunday watch party',starts_at:'2026-09-13T17:00:00Z'},{id:'soon',title:'Thursday meetup',starts_at:'2026-09-11T17:00:00Z'}],
 campaigns:[],drafts:[{id:'one',topic:'Best movie villains',status:'in_progress'}],today:[],upcoming:[],showCelebrations:true};
beforeEach(()=>{cleanup();vi.clearAllMocks();});
describe('Mobile home organization',()=>{
 it('keeps history, upcoming dates and active games distinct and sorts each correctly',()=>{
  const rows=buildHomeUpdates(input);
  expect(rows.filter(r=>r.section==='latest').map(r=>r.id)).toEqual(['activity-new','activity-old']);
  expect(rows.filter(r=>r.section==='upcoming').map(r=>r.id)).toEqual(['event-soon','event-late']);
  expect(rows.find(r=>r.id==='activity-old')?.to).toBe('/drafts');
  expect(rows.filter(r=>r.section==='playing')).toHaveLength(1);
 });
 it('never exposes an uninstalled module or invalid/stale event',()=>{
  expect(buildHomeUpdates({...input,installed:new Set()})).toEqual([]);
  expect(buildHomeUpdates({...input,events:[{id:'bad',title:'Bad date',starts_at:'nope'},{id:'past',title:'Past',starts_at:'2025-01-01T00:00:00Z'}]}).some(r=>r.section==='upcoming')).toBe(false);
 });
 it('uses canonical routes including NFL Game Center and newly added apps',()=>{
  expect(homeShortcut('nfl-pickem')?.path).toBe('/nfl');
  expect(homeShortcut('workout-competition')?.path).toBe('/workouts');
  expect(homeShortcut('narrative')?.path).toBe('/narrative');
  expect(homeShortcut('missing')).toBeUndefined();
 });
 it('prioritizes one action, expands other actions, filters updates and preserves meaningful links',()=>{
  render(<MemoryRouter><MobileHome displayName="Alex Khoury" clubName="DH Club" installedSlugs={input.installed} actions={actions} updates={buildHomeUpdates(input)} shortcuts={shortcuts} onRefresh={vi.fn()} /></MemoryRouter>);
  expect(screen.getByRole('heading',{name:'Hey, Alex.'})).toBeInTheDocument();
  expect(screen.queryByText('New chat in #general')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'See 1 more'}));expect(screen.getByText('New chat in #general')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'NFL Game Center'})).toHaveAttribute('href','/nfl');
  expect(screen.getByText('Sam finished a draft')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab',{name:'Upcoming'}));expect(screen.getByText('Sunday watch party')).toBeInTheDocument();
  expect(screen.queryByText('Sam finished a draft')).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('tab',{name:'Upcoming'}),{key:'ArrowRight'});expect(screen.getByRole('tab',{name:'In progress'})).toHaveAttribute('aria-selected','true');
 });
 it('supports customization, clear errors, and a quiet club without invented urgency',()=>{
  const refresh=vi.fn();render(<MemoryRouter><MobileHome displayName="" clubName="DH Club" installedSlugs={input.installed} actions={[]} updates={[]} shortcuts={shortcuts} error="Connection failed" onRefresh={refresh} /></MemoryRouter>);
  expect(screen.queryByRole('region',{name:'For you'})).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Connection failed');fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(refresh).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Customize shortcuts'}));
  expect(screen.getByRole('dialog')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Unpin chat'}));expect(shortcuts.unpin).toHaveBeenCalledWith('chat');
 });
});
describe('Notification links and stable cursors',()=>{
 it('allows internal deep links but rejects external or ambiguous destinations',()=>{
  expect(notificationPath('/chat?channel=one&message=two')).toContain('/chat?');
  for(const url of ['https://evil.test','//evil.test','/\\evil.test','/bad\npath','javascript:alert(1)',null]) expect(notificationPath(url)).toBeNull();
  expect(notificationTime('invalid')).toBe('Recently');
 });
 it('uses ID to break ties when notifications share a timestamp',()=>{
  expect(notificationCursor('00000000-0000-4000-8000-000000000001','2026-09-10T17:00:00+00:00')).toContain('and(created_at.eq.');
  expect(()=>notificationCursor('bad','2026-09-10T17:00:00Z')).toThrow();
 });
});
