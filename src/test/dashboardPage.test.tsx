import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '@/pages/DashboardPage';

const state=vi.hoisted(()=>({
  user:{id:'member'},club:{id:'club',name:'DH Club'},desktop:false,fail:false,
  assets:['feed','posts','chat','events','draft-arena'].map((slug,index)=>({id:slug,sort_order:index,enabled:true,visible_to_members:true,asset:{slug,name:slug}})),
  filters:[] as {table:string;key:string;value:unknown}[],
}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:state.user})}));
vi.mock('@/contexts/ClubContext',()=>({useClub:()=>({club:state.club,isClubAdmin:false})}));
vi.mock('@/hooks/useMediaQuery',()=>({useMediaQuery:()=>state.desktop}));
vi.mock('@/hooks/useClubAssets',()=>({useClubAssets:()=>({installedAssets:state.assets,allAssets:[],loading:false,isInstalled:(slug:string)=>state.assets.some(item=>item.asset.slug===slug&&item.enabled),isVisible:(slug:string)=>state.assets.some(item=>item.asset.slug===slug&&item.visible_to_members)})}));
vi.mock('@/hooks/usePwaInstall',()=>({usePwaInstall:()=>({canInstall:false})}));
vi.mock('@/hooks/useDraftSeasons',()=>({useCurrentSeason:()=>({season:null}),useSeasonStandings:()=>({standings:[]}),useSeasonEntries:()=>({entries:[]}),getSeasonDraftTarget:()=>0}));
vi.mock('@/hooks/useRealtimeSubscription',()=>({useActivityFeedUpdates:()=>{},useDraftListUpdates:()=>{}}));
vi.mock('@/hooks/useNarrativeCampaigns',()=>({useNarrativeCampaigns:()=>({campaigns:[]})}));
vi.mock('@/hooks/useCelebrations',()=>({useUpcomingCelebrations:()=>({upcoming:[]}),useTodayCelebrations:()=>({today:[]}),useCelebrationSettings:()=>({settings:{show_on_home:true}})}));
vi.mock('@/hooks/useUnreadChannels',()=>({useUnreadChannels:()=>({unreadChannels:[]})}));
vi.mock('@/hooks/useOnboarding',()=>({useClubOnboarding:()=>({needsFirstTime:true}),useNewFeatures:()=>({newFeatures:[]})}));
vi.mock('@/components/home/FeaturedModule',()=>({FeaturedModule:()=>null}));
vi.mock('@/components/home/MembersOnline',()=>({MembersOnline:()=>null}));
vi.mock('@/components/home/DiscoverStrip',()=>({DiscoverStrip:()=>null}));
vi.mock('@/components/home/EmptyClubState',()=>({EmptyClubState:()=>null}));
vi.mock('@/components/home/dashboard/HomeDashboard',()=>({HomeDashboard:()=> <div data-testid="desktop-home">Desktop home</div>}));
vi.mock('@/components/onboarding/ClubOnboardingFlow',()=>({ClubOnboardingFlow:()=> <div data-testid="onboarding"/>}));
vi.mock('@/components/onboarding/WhatIsNewCard',()=>({WhatIsNewCard:()=>null}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:(table:string)=>{
  const request={select:()=>request,eq:(key:string,value:unknown)=>{state.filters.push({table,key,value});return request;},in:()=>request,gte:()=>request,order:()=>request,limit:()=>request,single:()=>request,
    then:(resolve:(value:unknown)=>unknown,reject?:(error:unknown)=>unknown)=>Promise.resolve({error:state.fail?{message:'Fixture failure'}:null,
      data:table==='profiles'?{display_name:'Alex',avatar_url:null}:table==='activity_feed'?[{id:'activity',event_type:'post_created',created_at:'2026-09-10T12:00:00Z',target_id:'post',profiles:{display_name:'Jordan'}}]:table==='events'?[{id:'event',title:'Watch party',starts_at:'2099-09-13T17:00:00Z'}]:[]}).then(resolve,reject)};
  return request;
}}}));
beforeEach(()=>{state.desktop=false;state.fail=false;state.filters=[];state.assets=state.assets.map(item=>({...item,visible_to_members:true}));localStorage.clear();});
afterEach(cleanup);
describe('Dashboard orchestration',()=>{
  it('mounts only the visible home and one onboarding flow, including after resizing',async()=>{
    const view=render(<MemoryRouter><DashboardPage/></MemoryRouter>);
    await screen.findByRole('heading',{name:'Hey, Alex.'});
    expect(screen.queryByTestId('desktop-home')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('onboarding')).toHaveLength(1);
    expect(screen.getByText('Jordan started a discussion')).toBeInTheDocument();
    expect(state.filters.filter(item=>['drafts','events','activity_feed'].includes(item.table))).toEqual(expect.arrayContaining([
      {table:'drafts',key:'club_id',value:'club'},{table:'events',key:'club_id',value:'club'},{table:'activity_feed',key:'club_id',value:'club'},
    ]));
    act(()=>{state.desktop=true;view.rerender(<MemoryRouter><DashboardPage/></MemoryRouter>);});
    expect(screen.getByTestId('desktop-home')).toBeInTheDocument();
    expect(screen.queryByRole('heading',{name:'Hey, Alex.'})).not.toBeInTheDocument();
    expect(screen.getAllByTestId('onboarding')).toHaveLength(1);
  });
  it('does not expose hidden apps through shortcuts or activity',async()=>{
    state.assets=state.assets.map(item=>({...item,visible_to_members:item.asset.slug!=='posts'}));
    render(<MemoryRouter><DashboardPage/></MemoryRouter>);
    await screen.findByRole('heading',{name:'Hey, Alex.'});
    expect(screen.queryByText('Jordan started a discussion')).not.toBeInTheDocument();
    expect(screen.queryByRole('link',{name:'Discussions'})).not.toBeInTheDocument();
  });
  it('shows query failures with retry instead of a perpetual skeleton or false empty state',async()=>{
    state.fail=true;render(<MemoryRouter><DashboardPage/></MemoryRouter>);
    await screen.findByRole('alert');
    expect(screen.queryByLabelText('Loading home')).not.toBeInTheDocument();
    state.fail=false;fireEvent.click(screen.getByRole('button',{name:'Try again'}));
    await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    await screen.findByRole('heading',{name:'Hey, Alex.'});
  });
});
