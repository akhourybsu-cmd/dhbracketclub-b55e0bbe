import {beforeEach,describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,waitFor,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
const state=vi.hoisted(()=>({save:vi.fn().mockResolvedValue({}),ready:true,entry:null as null|{legs:unknown[]},marketPatch:{} as Record<string,unknown>,now:Date.parse('2026-09-10T19:30:00Z')}));
const fixtures=vi.hoisted(()=>{
 const team=(id:string)=>({id,abbr:id,city:id,name:id});
 const game=(id:string,kickoff_at:string,status:string)=>({id,week_id:'week',season_id:'season',kickoff_at,status,
  home_team_id:'HOME',away_team_id:'AWAY',home_team:team('HOME'),away_team:team('AWAY'),home_score:null,away_score:null});
 return {season:{id:'season',current_week:1},weeks:[{id:'week',week_number:1,label:'Week 1',marketCount:2}],
  games:[game('thursday','2026-09-10T20:00:00Z','scheduled'),game('sunday','2026-09-13T17:00:00Z','scheduled')],
  markets:['thursday','sunday'].map(id=>({id,game_id:id,display_text:id+' prediction',market_type:'team_win',operator:'eq',threshold:1,status:'open',source_provider:'admin',subject_external_id:null}))};
});
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'me'}})}));
vi.mock('@/hooks/usePickem',()=>({useActiveSeason:()=>({season:fixtures.season}),useWeekGames:()=>({games:fixtures.games,refetch:vi.fn()})}));
vi.mock('@/hooks/useCrazyChainWeeks',()=>({useCrazyChainWeeks:()=>({weeks:fixtures.weeks}),chooseChainBoardWeek:()=>fixtures.weeks[0]}));
vi.mock('@/hooks/useCrazyChainBoard',()=>({useCrazyChainBoard:()=>({migrationReady:state.ready,availabilityReady:true,now:state.now,
 board:{games:[{game_id:'thursday',unlocked:state.now<Date.parse('2026-09-10T19:30:00Z')},{game_id:'sunday',unlocked:true}]}})}));
vi.mock('@/hooks/useCrazyChain',()=>({saveCrazyChainGame:state.save,
 useCrazyChainMarkets:()=>({markets:fixtures.markets.map(m=>m.id==='sunday'?{...m,...state.marketPatch}:m),refetch:vi.fn()}),useMyCrazyChainEntry:()=>({entry:state.entry,refetch:vi.fn().mockResolvedValue({})}),
 useCrazyChainStandings:()=>({standings:[]}),useMyCrazyChainGameCards:()=>({cards:[]})}));
import CrazyChainPage from '@/pages/CrazyChainPage';
const ui=()=> <QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/nfl/crazy-chain?week=1']}><CrazyChainPage /></MemoryRouter></QueryClientProvider>;
beforeEach(()=>{cleanup();state.save.mockClear();state.ready=true;state.entry=null;state.marketPatch={};state.now=Date.parse('2026-09-10T19:30:00Z');});
describe('Independent Crazy Chain game controls',()=>{
 it.each(['review','verified'])('allows a player with a %s or expired availability check to be picked',async availability_status=>{
  state.marketPatch={source_provider:'espn-roster',subject_external_id:'qb',availability_status,availability_checked_at:null};
  render(ui());const pick=screen.getByRole('button',{name:/sunday prediction/});expect(pick).toBeEnabled();
  fireEvent.click(pick);fireEvent.click(screen.getByRole('button',{name:'Save picks for AWAY at HOME'}));
  await waitFor(()=>expect(state.save).toHaveBeenCalledWith('sunday',['sunday']));
 });
 it('keeps a cancelled saved pick visible with a reason and excludes it from active picks',()=>{
  state.marketPatch={status:'void',void_reason:'Player out before kickoff. Pick cancelled; no chain penalty.'};
  state.entry={legs:[{market_id:'sunday',status:'void',display_text:'sunday prediction',void_reason:state.marketPatch.void_reason}]};
  render(ui());expect(screen.getByRole('button',{name:/sunday prediction/})).toBeDisabled();
  expect(screen.getByText(/Player out before kickoff/)).toBeInTheDocument();
  expect(screen.getByText(/0 active picks/)).toBeInTheDocument();
 });
 it('drops an unsaved selection that was cancelled during a background refresh',()=>{
  const view=render(ui());fireEvent.click(screen.getByRole('button',{name:/sunday prediction/}));
  state.marketPatch={status:'void'};view.rerender(ui());
  expect(screen.getByRole('button',{name:/sunday prediction/})).toHaveAttribute('aria-pressed','false');
  expect(screen.getByRole('button',{name:'Save picks for AWAY at HOME'})).toBeDisabled();
 });
 it('lets members select Thursday until exactly 30 minutes before kickoff',()=>{
  state.now=Date.parse('2026-09-10T19:29:59.999Z');const view=render(ui());
  expect(screen.getByRole('button',{name:/thursday prediction/})).toBeEnabled();
  expect(screen.getByText('Crazy Chain picks lock 30 minutes before kickoff.')).toBeInTheDocument();
  state.now=Date.parse('2026-09-10T19:30:00Z');view.rerender(ui());
  expect(screen.getByRole('button',{name:/thursday prediction/})).toBeDisabled();
 });
 it('locks Thursday but saves Sunday selections independently',async()=>{
  render(ui());
  expect(screen.getByRole('button',{name:/thursday prediction/})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:/sunday prediction/}));
  fireEvent.click(screen.getByRole('button',{name:'Save picks for AWAY at HOME'}));
  await waitFor(()=>expect(state.save).toHaveBeenCalledWith('sunday',['sunday']));
 });
 it('does not discard an unsaved game draft when results refresh',()=>{
  const view=render(ui());
  fireEvent.click(screen.getByRole('button',{name:/sunday prediction/}));
  state.entry={legs:[]};view.rerender(ui());
  expect(screen.getByRole('button',{name:/sunday prediction/})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
 });
 it('fails closed until the per-game SQL is installed',()=>{
  state.ready=false;render(ui());
  expect(screen.getByRole('button',{name:/sunday prediction/})).toBeDisabled();
  expect(screen.queryByRole('button',{name:'Save picks for AWAY at HOME'})).not.toBeInTheDocument();
 });
});
