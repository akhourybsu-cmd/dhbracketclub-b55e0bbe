-- Educational journal only. Apply inside the caller's transaction.
-- No existing game function, rule, company, inventory, job or award is changed.
create function public.dc_tutorial_ids_v1(p_kind text) returns text[] language sql immutable as $tutorial_ids$
 select array(select jsonb_array_elements_text($tutorial_registry${"lessons":["beginner.claim","beginner.camp","beginner.crew","beginner.mine","beginner.worksite","beginner.plan","beginner.descent","beginner.waiting","beginner.haul","beginner.sale","beginner.upgrade","beginner.graduate","workforce.hiring","workforce.stats","workforce.training","workforce.equipment","workforce.repairs","industry.ore","industry.warehouse","industry.smeltery","industry.gems","industry.crafting","industry.queues","field.exploration","field.survey","field.infrastructure","field.hazards","field.reports","field.discoveries","business.office","business.research","business.contracts","business.milestones","business.strategy","club.projects","club.standings","club.showcase","club.privacy","club.updates","settings.sound","settings.main_menu","settings.exit"],"steps":["beginner.claim.deed","beginner.claim.founded","beginner.camp.surface","beginner.camp.building","beginner.camp.mine","beginner.crew.crew","beginner.crew.mara","beginner.crew.ivo","beginner.crew.tessa","beginner.crew.conditions","beginner.mine.enter","beginner.mine.control","beginner.mine.inspect","beginner.worksite.difference","beginner.worksite.planner","beginner.plan.selection","beginner.plan.quote","beginner.descent.confirmed","beginner.waiting.stages","beginner.waiting.returned","beginner.haul.cargo","beginner.haul.collected","beginner.sale.stock","beginner.sale.sale","beginner.upgrade.review","beginner.graduate.ready","workforce.hiring.office","workforce.hiring.capacity","workforce.stats.file","workforce.stats.meaning","workforce.training.course","workforce.training.limits","workforce.equipment.slots","workforce.equipment.tradeoff","workforce.repairs.condition","workforce.repairs.repair","industry.ore.catalog","industry.ore.uses","industry.warehouse.capacity","industry.warehouse.staging","industry.smeltery.station","industry.smeltery.inputs","industry.gems.gems","industry.gems.finish","industry.crafting.craft","industry.crafting.assign","industry.queues.queue","industry.queues.limits","field.exploration.frontier","field.exploration.finite","field.survey.survey","field.survey.quote","field.infrastructure.project","field.infrastructure.cost","field.hazards.conditions","field.hazards.safety","field.reports.log","field.reports.report","field.discoveries.finds","field.discoveries.choice","business.office.office","business.office.sections","business.research.tree","business.research.cost","business.contracts.orders","business.contracts.whole","business.milestones.records","business.milestones.claim","business.strategy.overview","business.strategy.tradeoff","club.projects.project","club.projects.review","club.standings.board","club.standings.meaning","club.showcase.case","club.showcase.curate","club.privacy.consent","club.privacy.choice","club.updates.updates","club.updates.score","settings.sound.settings","settings.sound.comfort","settings.main_menu.menu","settings.exit.exit"],"dialogue":["opening.deed.01","opening.deed.02","opening.deed.03","opening.deed.04","opening.deed.05","opening.deed.06","opening.deed.07","opening.deed.08","opening.crew.01","opening.crew.02","opening.crew.03","opening.crew.04","opening.crew.05","chapter.beginner.claim.01","chapter.beginner.camp.01","chapter.beginner.camp.02","chapter.beginner.crew.01","chapter.beginner.crew.02","chapter.beginner.mine.01","chapter.beginner.mine.02","chapter.beginner.worksite.01","chapter.beginner.plan.01","chapter.beginner.descent.01","chapter.beginner.waiting.01","chapter.beginner.waiting.02","chapter.beginner.haul.01","chapter.beginner.sale.01","chapter.beginner.sale.02","chapter.beginner.upgrade.01","chapter.beginner.graduate.01","chapter.workforce.hiring.01","chapter.workforce.stats.01","chapter.workforce.training.01","chapter.workforce.equipment.01","chapter.workforce.repairs.01","chapter.industry.ore.01","chapter.industry.warehouse.01","chapter.industry.smeltery.01","chapter.industry.gems.01","chapter.industry.crafting.01","chapter.industry.queues.01","chapter.field.exploration.01","chapter.field.survey.01","chapter.field.infrastructure.01","chapter.field.hazards.01","chapter.field.reports.01","chapter.field.discoveries.01","chapter.business.office.01","chapter.business.research.01","chapter.business.contracts.01","chapter.business.milestones.01","chapter.business.strategy.01","chapter.club.projects.01","chapter.club.standings.01","chapter.club.showcase.01","chapter.club.privacy.01","chapter.club.updates.01","chapter.settings.sound.01","chapter.settings.main_menu.01","chapter.settings.exit.01","graduation.sale.01","graduation.sale.02","graduation.sale.03","graduation.review.01","graduation.review.02","graduation.review.03","gus.office.01"]}$tutorial_registry$::jsonb->p_kind))
$tutorial_ids$;

create function public.dc_tutorial_ids_valid_v1(p_ids text[],p_kind text,p_limit integer) returns boolean language sql immutable as $$
 select p_ids is not null and coalesce(array_ndims(p_ids),1)=1 and coalesce(array_lower(p_ids,1),1)=1
  and cardinality(p_ids)<=p_limit and p_ids<@public.dc_tutorial_ids_v1(p_kind)
  and not exists(select 1 from unnest(p_ids)id where id is null or length(id)>128)
  and cardinality(p_ids)=(select count(distinct id) from unnest(p_ids)id)
$$;

create table public.dc_tutorial_progress(
 company_id uuid primary key references public.dc_companies(id),
 version integer not null default 1 check(version=1),revision integer not null default 0 check(revision>=0),
 active_lesson_id text,active_step_id text,
 completed_steps text[] not null default '{}',reviewed_lessons text[] not null default '{}',
 practiced_lessons text[] not null default '{}',skipped_lessons text[] not null default '{}',seen_dialogue text[] not null default '{}',
 campaign_status text not null default 'not_started' check(campaign_status in('not_started','active','paused','completed')),
 commentary_enabled boolean not null default true,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz,
 check((revision=0)=(updated_at is null)),
 check(active_lesson_id is null or active_lesson_id=any(public.dc_tutorial_ids_v1('lessons'))),
 check(active_step_id is null or(active_lesson_id is not null and active_step_id=any(public.dc_tutorial_ids_v1('steps')) and starts_with(active_step_id,active_lesson_id||'.'))),
 check(public.dc_tutorial_ids_valid_v1(completed_steps,'steps',512)),
 check(public.dc_tutorial_ids_valid_v1(reviewed_lessons,'lessons',42)),
 check(public.dc_tutorial_ids_valid_v1(practiced_lessons,'lessons',42)),
 check(public.dc_tutorial_ids_valid_v1(skipped_lessons,'lessons',42)),
 check(public.dc_tutorial_ids_valid_v1(seen_dialogue,'dialogue',512))
);
create table public.dc_tutorial_requests(
 request_id uuid primary key,company_id uuid not null references public.dc_tutorial_progress(company_id),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=33000),
 created_at timestamptz not null default clock_timestamp()
);
create index dc_tutorial_requests_company_time on public.dc_tutorial_requests(company_id,created_at desc,request_id);
alter table public.dc_tutorial_progress enable row level security;
alter table public.dc_tutorial_requests enable row level security;
revoke all on public.dc_tutorial_progress,public.dc_tutorial_requests from public,anon,authenticated;
grant all on public.dc_tutorial_progress,public.dc_tutorial_requests to service_role;

create function public.dc_tutorial_union_v1(p_before text[],p_added jsonb) returns text[] language sql immutable as $$
 select coalesce(array_agg(value order by value collate "C"),'{}') from(
  select unnest(p_before) value union select jsonb_array_elements_text(coalesce(p_added,'[]'))
 )ids
$$;

create function public.dc_tutorial_validate_patch_v1(p_patch jsonb) returns void language plpgsql immutable as $$
declare field record;kind text;limit_count integer;begin
 if jsonb_typeof(p_patch) is distinct from 'object' or octet_length(p_patch::text)>32768 then raise exception 'Invalid training progress.' using errcode='22023';end if;
 for field in select key,value from jsonb_each(p_patch) loop
  if field.key in('completed_steps','reviewed_lessons','practiced_lessons','skipped_lessons','seen_dialogue') then
   kind:=case field.key when 'completed_steps' then 'steps' when 'seen_dialogue' then 'dialogue' else 'lessons' end;
   limit_count:=case when kind='lessons' then 42 else 512 end;
   if jsonb_typeof(field.value) is distinct from 'array' then raise exception 'Invalid training progress list.' using errcode='22023';end if;
   if jsonb_array_length(field.value)>limit_count or exists(select 1 from jsonb_array_elements(field.value)item where jsonb_typeof(item) is distinct from 'string' or not((item#>>'{}')=any(public.dc_tutorial_ids_v1(kind)))) then raise exception 'Unknown training content.' using errcode='22023';end if;
  elsif field.key='active_lesson_id' then
   if field.value<>'null'::jsonb and(jsonb_typeof(field.value) is distinct from 'string' or not((field.value#>>'{}')=any(public.dc_tutorial_ids_v1('lessons')))) then raise exception 'Unknown training lesson.' using errcode='22023';end if;
  elsif field.key='active_step_id' then
   if field.value<>'null'::jsonb and(jsonb_typeof(field.value) is distinct from 'string' or not((field.value#>>'{}')=any(public.dc_tutorial_ids_v1('steps')))) then raise exception 'Unknown training step.' using errcode='22023';end if;
  elsif field.key='campaign_status' then
   if jsonb_typeof(field.value) is distinct from 'string' or (field.value#>>'{}') not in('not_started','active','paused','completed') then raise exception 'Invalid training campaign status.' using errcode='22023';end if;
  elsif field.key='commentary_enabled' then
   if jsonb_typeof(field.value) is distinct from 'boolean' then raise exception 'Invalid mentor commentary setting.' using errcode='22023';end if;
  else raise exception 'Unsupported training progress fields.' using errcode='22023';end if;
 end loop;
end $$;

create function public.dc_tutorial_snapshot_v1(p_company uuid,p_user uuid,p_club uuid,p_now timestamptz) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('version',1,'server_now',p_now,'user_id',p_user,'club_id',p_club,'company_id',p_company,
  'revision',coalesce(j.revision,0),'active_lesson_id',j.active_lesson_id,'active_step_id',j.active_step_id,
  'completed_steps',coalesce(j.completed_steps,'{}'),'reviewed_lessons',coalesce(j.reviewed_lessons,'{}'),
  'practiced_lessons',coalesce(j.practiced_lessons,'{}'),'skipped_lessons',coalesce(j.skipped_lessons,'{}'),'seen_dialogue',coalesce(j.seen_dialogue,'{}'),
  'campaign_status',coalesce(j.campaign_status,'not_started'),'commentary_enabled',coalesce(j.commentary_enabled,true),'updated_at',j.updated_at)
 from(values(1))s(dummy) left join public.dc_tutorial_progress j on j.company_id=p_company
$$;

create function public.dc_tutorial_guard_v1() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new;end if;
 if tg_table_name='dc_tutorial_progress' and tg_op='UPDATE' then
  if new.company_id=old.company_id and new.version=old.version and new.created_at=old.created_at and new.revision=old.revision+1
   and new.updated_at is not null and(old.updated_at is null or new.updated_at>=old.updated_at)
   and old.completed_steps<@new.completed_steps and old.reviewed_lessons<@new.reviewed_lessons and old.practiced_lessons<@new.practiced_lessons
   and old.skipped_lessons<@new.skipped_lessons and old.seen_dialogue<@new.seen_dialogue then return new;end if;
 end if;
 raise exception 'Saved training progress and request identities cannot be rewritten.';
end $$;
create trigger dc_tutorial_progress_guard before update or delete on public.dc_tutorial_progress for each row execute function public.dc_tutorial_guard_v1();
create trigger dc_tutorial_request_guard before update on public.dc_tutorial_requests for each row execute function public.dc_tutorial_guard_v1();

create function public.dc_tutorial_get() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare club uuid:=public.dc_access_v1();company uuid;begin
 select c.id into company from public.dc_companies c where c.club_id=club and c.user_id=auth.uid();
 return public.dc_tutorial_snapshot_v1(company,auth.uid(),club,clock_timestamp());
end $$;

create function public.dc_tutorial_save(p_patch jsonb,p_expected_revision integer,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare club uuid:=public.dc_access_v1();company uuid;current_progress public.dc_tutorial_progress%rowtype;next_progress public.dc_tutorial_progress%rowtype;
 receipt public.dc_tutorial_requests%rowtype;payload jsonb:=jsonb_build_object('patch',p_patch,'expected_revision',p_expected_revision);cursor_patch boolean;
begin
 select c.id into company from public.dc_companies c where c.club_id=club and c.user_id=auth.uid();
 if company is null then raise exception 'Create your company before saving training progress.';end if;
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid training request.' using errcode='22023';end if;
 perform public.dc_tutorial_validate_patch_v1(p_patch);
 insert into public.dc_tutorial_progress(company_id) values(company) on conflict do nothing;
 select * into current_progress from public.dc_tutorial_progress where company_id=company for update;
 select * into receipt from public.dc_tutorial_requests where request_id=p_request_id;
 if found then
  if receipt.company_id<>company or receipt.payload is distinct from payload then raise exception 'Training request was already used for different choices.' using errcode='42501';end if;
  return public.dc_tutorial_snapshot_v1(company,auth.uid(),club,clock_timestamp());
 end if;
 if(select count(*) from public.dc_tutorial_requests where company_id=company and created_at>=clock_timestamp()-interval '1 minute')>=120 then raise exception 'Training progress is syncing too quickly. Try again in a moment.';end if;
 cursor_patch:=p_patch ?| array['active_lesson_id','active_step_id','campaign_status','commentary_enabled'];
 if p_expected_revision>current_progress.revision or(cursor_patch and p_expected_revision<>current_progress.revision) then raise exception 'Training progress changed on another device. Refresh before moving the lesson.' using errcode='40001';end if;
 next_progress:=current_progress;
 next_progress.completed_steps:=public.dc_tutorial_union_v1(current_progress.completed_steps,p_patch->'completed_steps');
 next_progress.reviewed_lessons:=public.dc_tutorial_union_v1(current_progress.reviewed_lessons,p_patch->'reviewed_lessons');
 next_progress.practiced_lessons:=public.dc_tutorial_union_v1(current_progress.practiced_lessons,p_patch->'practiced_lessons');
 next_progress.skipped_lessons:=public.dc_tutorial_union_v1(current_progress.skipped_lessons,p_patch->'skipped_lessons');
 next_progress.seen_dialogue:=public.dc_tutorial_union_v1(current_progress.seen_dialogue,p_patch->'seen_dialogue');
 if p_patch?'active_lesson_id' then next_progress.active_lesson_id:=p_patch->>'active_lesson_id';end if;
 if p_patch?'active_step_id' then next_progress.active_step_id:=p_patch->>'active_step_id';end if;
 if p_patch?'campaign_status' then next_progress.campaign_status:=p_patch->>'campaign_status';end if;
 if p_patch?'commentary_enabled' then next_progress.commentary_enabled:=(p_patch->>'commentary_enabled')::boolean;end if;
 if p_patch?'active_lesson_id' and not(p_patch?'active_step_id') and next_progress.active_step_id is not null and(next_progress.active_lesson_id is null or not starts_with(next_progress.active_step_id,next_progress.active_lesson_id||'.')) then next_progress.active_step_id:=null;end if;
 if next_progress.active_step_id is not null and(next_progress.active_lesson_id is null or not starts_with(next_progress.active_step_id,next_progress.active_lesson_id||'.')) then raise exception 'Choose a step within its training lesson.' using errcode='22023';end if;
 if(to_jsonb(next_progress)-array['revision','updated_at']) is distinct from(to_jsonb(current_progress)-array['revision','updated_at']) then
  update public.dc_tutorial_progress set revision=revision+1,updated_at=clock_timestamp(),
   active_lesson_id=next_progress.active_lesson_id,active_step_id=next_progress.active_step_id,completed_steps=next_progress.completed_steps,
   reviewed_lessons=next_progress.reviewed_lessons,practiced_lessons=next_progress.practiced_lessons,skipped_lessons=next_progress.skipped_lessons,
   seen_dialogue=next_progress.seen_dialogue,campaign_status=next_progress.campaign_status,commentary_enabled=next_progress.commentary_enabled where company_id=company;
 end if;
 begin
  insert into public.dc_tutorial_requests(request_id,company_id,payload) values(p_request_id,company,payload);
 exception when unique_violation then raise exception 'Training request was already used for different choices.' using errcode='42501';end;
 -- Educational receipts are bounded. Recent lost acknowledgements remain safe
 -- to retry; ancient cursor writes still fail their original revision check.
 delete from public.dc_tutorial_requests r where r.company_id=company and r.request_id<>p_request_id and r.request_id in(
  select old_request.request_id from public.dc_tutorial_requests old_request where old_request.company_id=company and old_request.request_id<>p_request_id
   order by old_request.created_at desc,old_request.request_id offset 255
 );
 return public.dc_tutorial_snapshot_v1(company,auth.uid(),club,clock_timestamp());
end $$;

revoke all on function public.dc_tutorial_ids_v1(text),public.dc_tutorial_ids_valid_v1(text[],text,integer),public.dc_tutorial_union_v1(text[],jsonb),public.dc_tutorial_validate_patch_v1(jsonb),public.dc_tutorial_snapshot_v1(uuid,uuid,uuid,timestamptz),public.dc_tutorial_guard_v1(),public.dc_tutorial_get(),public.dc_tutorial_save(jsonb,integer,uuid) from public,anon,authenticated;
grant execute on function public.dc_tutorial_ids_v1(text),public.dc_tutorial_ids_valid_v1(text[],text,integer),public.dc_tutorial_union_v1(text[],jsonb),public.dc_tutorial_validate_patch_v1(jsonb),public.dc_tutorial_snapshot_v1(uuid,uuid,uuid,timestamptz),public.dc_tutorial_guard_v1(),public.dc_tutorial_get(),public.dc_tutorial_save(jsonb,integer,uuid) to service_role;
grant execute on function public.dc_tutorial_get(),public.dc_tutorial_save(jsonb,integer,uuid) to authenticated;
notify pgrst,'reload schema';
