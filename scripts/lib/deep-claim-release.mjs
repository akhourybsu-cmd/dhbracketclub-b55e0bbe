// Pure release construction only. This module never opens a database or reads
// application credentials; the caller executes the reviewed result explicitly.
import { createHash } from 'node:crypto';

export const DEEP_CLAIM_PHASE7_RELEASE_VERSION = '20261102070000';
export const DEEP_CLAIM_PHASE7_RELEASE_NAME = 'deep_claim_ancient_deep';
export const DEEP_CLAIM_PHASE7_CRITICAL_PATTERN = '^(dc_|dh_feat|dh_feats|dh_home_progress|dh_public_member|dh_visible)';

export const DEEP_CLAIM_PHASE7_CHANGED_SIGNATURES = Object.freeze([
  'dc_cell_v1(uuid,integer,integer)',
  'dc_chunk_version_v2(uuid,integer,integer)',
  'dc_dispatch(uuid[],text,integer,integer,integer,boolean,integer,uuid)',
  'dc_dispatch_operation(uuid[],text,integer,integer,integer,boolean,text,integer,uuid)',
  'dc_hardness_v1(text)',
  'dc_minerals_v2()',
  'dc_mining_value_v5(jsonb)',
  'dc_preview_operation(uuid[],text,integer,integer,integer,boolean,text)',
  'dc_price_v1(text)',
  'dc_reconcile_v1(uuid,timestamp with time zone)',
  'dc_resources_v1()',
  'dc_snapshot_v1(uuid,timestamp with time zone)',
  'dc_upgrade(text,integer,uuid)',
]);

export const DEEP_CLAIM_PHASE7_ADDED_SIGNATURES = Object.freeze([
  'dc_buildings_v7(dc_companies)',
  'dc_cell_v4(uuid,integer,integer)',
  'dc_current_ticket_v7()',
  'dc_deep_catalog_v7()',
  'dc_deep_modifiers_v7(uuid,uuid[],text,integer,integer,jsonb,integer)',
  'dc_dispatch_v7_impl(uuid[],text,integer,integer,integer,boolean,text,integer,uuid)',
  'dc_freeze_equipment_v7(uuid,uuid,uuid[],integer)',
  'dc_hardness_v1_pre_v7(text)',
  'dc_infrastructure_capacity_v7(uuid)',
  'dc_lift_discount_v7(uuid,jsonb)',
  'dc_mining_value_v5_pre_v7(jsonb)',
  'dc_preview_operation_v3_pre_v7(uuid,uuid[],text,integer,integer,integer,boolean,text,timestamp with time zone)',
  'dc_preview_operation_v7(uuid,uuid[],text,integer,integer,integer,boolean,text,timestamp with time zone)',
  'dc_preview_operation_v7_base(uuid,uuid[],text,integer,integer,integer,boolean,text,timestamp with time zone)',
  'dc_preview_v1_phase2_base_pre_v7(uuid,uuid[],text,integer,integer,integer,boolean,timestamp with time zone)',
  'dc_price_v1_pre_v7(text)',
  'dc_reconcile_v1_pre_v7(uuid,timestamp with time zone)',
  'dc_reconcile_v7_fields(uuid,timestamp with time zone)',
  'dc_snapshot_v1_pre_v7(uuid,timestamp with time zone)',
  'dc_upgrade_pre_v7(text,integer,uuid)',
]);

const MEMBER_NAMES = Object.freeze([
  'dc_bootstrap', 'dc_get', 'dc_reconcile', 'dc_preview', 'dc_dispatch',
  'dc_collect', 'dc_sell', 'dc_upgrade', 'dc_hire', 'dc_train',
  'dc_assign_equipment', 'dc_repair_equipment', 'dc_start_production',
  'dc_collect_production', 'dc_retire_equipment', 'dc_preview_operation',
  'dc_dispatch_operation', 'dc_resolve_discovery', 'dc_start_research',
  'dc_fulfill_contract', 'dc_claim_milestone', 'dc_get_club',
  'dc_set_social_preferences', 'dc_contribute_project', 'dc_claim_project',
]);
const PRIOR_NAMES = Object.freeze({
  '20261102010000': 'deep_claim_foundation',
  '20261102020000': 'deep_claim_discovery',
  '20261102030000': 'deep_claim_workforce_production',
  '20261102040000': 'deep_claim_underground_operations',
  '20261102050000': 'deep_claim_business_development',
  '20261102060000': 'deep_claim_club_operations',
  '20261102061000': 'deep_claim_dh_integration',
});
const critical = new RegExp(DEEP_CLAIM_PHASE7_CRITICAL_PATTERN);
const fail = message => { throw new Error(`Deep Claim release: ${message}`); };
const md5 = value => createHash('md5').update(value).digest('hex');

function normalizeBodies(value, label, total, dcCount) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be a function-body map`);
  const entries = value instanceof Map ? [...value] : Object.entries(value);
  if (entries.length !== total) fail(`${label} must contain exactly ${total} critical functions`);
  const result = Object.create(null);
  for (const [signature, hash] of entries) {
    if (typeof signature !== 'string' || signature.length > 512 || !/^[a-z_][a-z_0-9]*\([a-z_0-9 ,.\[\]]*\)$/.test(signature)
      || !critical.test(signature.slice(0, signature.indexOf('(')))) fail(`${label} contains an invalid critical signature`);
    if (typeof hash !== 'string' || !/^[a-f0-9]{32}$/i.test(hash) || Object.hasOwn(result, signature)) fail(`${label} contains an invalid or duplicate MD5`);
    result[signature] = hash.toLowerCase();
  }
  if (Object.keys(result).filter(key => key.startsWith('dc_')).length !== dcCount) fail(`${label} must contain exactly ${dcCount} dc_ functions`);
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

// Read only top-level statement starts. Quotes, nested block comments and
// dollar-quoted function bodies cannot masquerade as transaction boundaries.
function assertSingleTransactionSource(source) {
  if (typeof source !== 'string' || !source.trim() || source.includes('\0') || Buffer.byteLength(source) > 1_000_000) fail('source must be nonempty SQL under one megabyte');
  let command = '', state = 'normal', dollar = '', depth = 0, escaped = false;
  const check = () => {
    if (/^\s*(?:begin\b|commit\b|end\b|rollback\b|abort\b|start\s+transaction\b|prepare\s+transaction\b)/i.test(command)) fail('source must not contain transaction boundaries');
    command = '';
  };
  for (let index = 0; index < source.length; index++) {
    const char = source[index], next = source[index + 1];
    if (state === 'line') { if (char === '\n') { state = 'normal'; command += ' '; } continue; }
    if (state === 'block') {
      if (char === '/' && next === '*') { depth++; index++; }
      else if (char === '*' && next === '/') { depth--; index++; if (depth === 0) { state = 'normal'; command += ' '; } }
      continue;
    }
    if (state === 'dollar') {
      if (source.startsWith(dollar, index)) { index += dollar.length - 1; state = 'normal'; command += ' '; }
      continue;
    }
    if (state === 'single' || state === 'double') {
      const quote = state === 'single' ? "'" : '"';
      if (state === 'single' && escaped && char === '\\') { index++; continue; }
      if (char === quote) { if (next === quote) index++; else { state = 'normal'; command += ' '; } }
      continue;
    }
    if (char === '-' && next === '-') { state = 'line'; index++; continue; }
    if (char === '/' && next === '*') { state = 'block'; depth = 1; index++; continue; }
    if (char === "'" || char === '"') {
      escaped = char === "'" && /(?:^|[^a-z_0-9])e$/i.test(command);
      state = char === "'" ? 'single' : 'double'; command += ' '; continue;
    }
    if (char === '$') {
      const match = source.slice(index).match(/^\$(?:[a-z_][a-z_0-9]*)?\$/i);
      if (match) { dollar = match[0]; state = 'dollar'; index += dollar.length - 1; command += ' '; continue; }
    }
    if (char === ';') check(); else command += char;
  }
  if (!['normal', 'line'].includes(state)) fail('source contains an unterminated SQL quote or comment');
  check();
}

/**
 * Build, but never execute, the one-transaction Phase7 release.
 * Hash maps contain the complete public critical-regex set (133 then153),
 * including the same15 non-DC functions. Expected hashes intentionally remain
 * editable so native QA can prove a deliberately wrong postcondition rolls back.
 */
export function buildDeepClaimPhase7Release({ source, baselineBodies, expectedBodies, priorMigrations } = {}) {
  assertSingleTransactionSource(source);
  const baseline = normalizeBodies(baselineBodies, 'baselineBodies', 133, 118);
  const expected = normalizeBodies(expectedBodies, 'expectedBodies', 153, 138);
  const additions = Object.keys(expected).filter(key => !Object.hasOwn(baseline, key)).sort();
  if (JSON.stringify(additions) !== JSON.stringify([...DEEP_CLAIM_PHASE7_ADDED_SIGNATURES].sort())) fail('expected signatures must add exactly the twenty Phase7 private helpers');
  if (Object.keys(baseline).some(key => !Object.hasOwn(expected, key))) fail('expected signatures must preserve every baseline function');
  if (DEEP_CLAIM_PHASE7_CHANGED_SIGNATURES.some(key => !Object.hasOwn(baseline, key))) fail('baseline is missing a Phase7 replacement signature');
  if (!Array.isArray(priorMigrations) || priorMigrations.length !== 7) fail('priorMigrations must contain the seven released Deep Claim sources');
  const prior = priorMigrations.map(row => {
    if (!row || typeof row !== 'object' || typeof row.version !== 'string' || PRIOR_NAMES[row.version] !== row.name || typeof row.md5 !== 'string' || !/^[a-f0-9]{32}$/i.test(row.md5)) fail('invalid prior migration identity or MD5');
    return { version: row.version, name: row.name, md5: row.md5.toLowerCase() };
  }).sort((a, b) => a.version.localeCompare(b.version));
  if (new Set(prior.map(row => row.version)).size !== 7) fail('duplicate prior migration version');

  // Metadata and original-source HISTORY literals use delimiters absent from
  // all caller-controlled contents. The reviewed migration is intentionally
  // appended separately as executable SQL inside this explicit transaction.
  const haystack = [source, JSON.stringify(baseline), JSON.stringify(expected), JSON.stringify(prior)].join('\n');
  const quoted = (value, label) => {
    let index = 0, tag;
    do { tag = `$dc_release_${label}_${md5(haystack).slice(0, 12)}_${index++}$`; } while (haystack.includes(tag) || value.includes(tag));
    return `${tag}${value}${tag}`;
  };
  const json = (value, label) => `${quoted(JSON.stringify(value), label)}::jsonb`;
  const baselineSQL = json(baseline, 'baseline'), expectedSQL = json(expected, 'expected'), priorSQL = json(prior, 'prior');
  const changedSQL = json(DEEP_CLAIM_PHASE7_CHANGED_SIGNATURES, 'changed'), addedSQL = json(DEEP_CLAIM_PHASE7_ADDED_SIGNATURES, 'added');
  const memberSQL = json(MEMBER_NAMES, 'members'), sourceSQL = quoted(source, 'source');
  const doTag = (() => { let n = 0, tag; do { tag = `$dc_release_checks_${md5(haystack).slice(0, 12)}_${n++}$`; } while (haystack.includes(tag)); return tag; })();

  return `-- Generated Deep Claim Ancient Deep release. One transaction; no player state is returned.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
set local search_path=public,pg_temp;

do ${doTag}
declare actual jsonb; prior record;
begin
 select coalesce(jsonb_object_agg(p.oid::regprocedure::text,md5(p.prosrc)),'{}') into actual
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname ~ '${DEEP_CLAIM_PHASE7_CRITICAL_PATTERN}';
 if actual is distinct from ${baselineSQL} then raise exception 'Release preflight: critical function baseline mismatch';end if;
 if exists(select 1 from supabase_migrations.schema_migrations where version='${DEEP_CLAIM_PHASE7_RELEASE_VERSION}') then raise exception 'Release preflight: Phase7 is already recorded';end if;
 for prior in select * from jsonb_to_recordset(${priorSQL}) as p(version text,name text,md5 text) loop
  if not exists(select 1 from supabase_migrations.schema_migrations h where h.version=prior.version and h.name=prior.name and cardinality(h.statements)=1 and md5(h.statements[1])=prior.md5) then raise exception 'Release preflight: prior source history mismatch';end if;
 end loop;
 perform 1 from public.platform_assets where slug='deep-claim' for update;
 if not found then raise exception 'Release preflight: Deep Claim asset is unavailable';end if;
end ${doTag};

-- Match authorized calls: asset first, then the global company barrier/rows,
-- then field tickets and production tickets. A busy5-second lock rolls back.
lock table public.dc_companies in access exclusive mode;
do ${doTag} begin perform id from public.dc_companies order by id for update;end ${doTag};
lock table public.dc_expeditions in share row exclusive mode;
lock table public.dc_production_jobs in share row exclusive mode;

create temporary table pg_temp.dc_release_rows_before(table_name text not null,row_hash text not null,copies bigint not null,primary key(table_name,row_hash)) on commit drop;
create temporary table pg_temp.dc_release_rows_after(like pg_temp.dc_release_rows_before including all) on commit drop;
create temporary table pg_temp.dc_release_tables on commit drop as
 select c.relname table_name,c.oid table_oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'dc_%';
create temporary table pg_temp.dc_release_function_oids on commit drop as
 select p.oid function_oid,p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '${DEEP_CLAIM_PHASE7_CRITICAL_PATTERN}';
create temporary table pg_temp.dc_release_company_revisions on commit drop as select id,revision from public.dc_companies;
create temporary table pg_temp.dc_release_member_rpcs on commit drop as
 select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'dc_%' and has_function_privilege('authenticated',p.oid,'EXECUTE');
create temporary table pg_temp.dc_release_shared_before(table_name text not null,row_hash text not null,copies bigint not null,primary key(table_name,row_hash)) on commit drop;
create temporary table pg_temp.dc_release_shared_after(like pg_temp.dc_release_shared_before including all) on commit drop;

do ${doTag}
declare t record;expression text; table_count integer:=0; member_names jsonb;
begin
 for t in select c.relname,c.oid,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'dc_%' order by c.relname loop
  table_count:=table_count+1;
  if not t.relrowsecurity or has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Release preflight: private table authorization mismatch';end if;
  expression:=case t.relname when 'dc_companies' then 'to_jsonb(t)-array[''revision'',''updated_at'']' when 'dc_expeditions' then 'to_jsonb(t)-''deep_modifiers''' else 'to_jsonb(t)' end;
  execute format('insert into pg_temp.dc_release_rows_before select %L,md5((%s)::text),count(*) from public.%I t group by md5((%s)::text)',t.relname,expression,t.relname,expression);
 end loop;
 if table_count<>33 then raise exception 'Release preflight: expected33 private Deep Claim tables';end if;
 if (select count(*) from pg_temp.dc_release_member_rpcs)<>25 then raise exception 'Release preflight: expected25 member RPCs';end if;
 select jsonb_agg(name order by name collate "C") into member_names from(select p.proname name from pg_temp.dc_release_member_rpcs r join pg_proc p on p.oid=to_regprocedure(r.signature))q;
 if member_names is distinct from (select jsonb_agg(value order by (value#>>'{}') collate "C") from jsonb_array_elements(${memberSQL})) then raise exception 'Release preflight: member RPC allowlist mismatch';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' and(has_function_privilege('anon',p.oid,'EXECUTE') or not has_function_privilege('service_role',p.oid,'EXECUTE'))) then raise exception 'Release preflight: function authorization mismatch';end if;
 if exists(select 1 from pg_publication_tables where schemaname='public' and tablename like 'dc_%') then raise exception 'Release preflight: private Deep Claim tables must not enter Realtime';end if;
 foreach expression in array array['dh_feat_unlocks','dh_feat_catalog','club_installed_assets'] loop
  execute format('insert into pg_temp.dc_release_shared_before select %L,md5(to_jsonb(t)::text),count(*) from public.%I t group by md5(to_jsonb(t)::text)',expression,expression);
 end loop;
 insert into pg_temp.dc_release_shared_before select 'deep_claim_asset',md5((to_jsonb(assetrow)-array['full_description','updated_at'])::text),count(*) from public.platform_assets assetrow where assetrow.slug='deep-claim' group by md5((to_jsonb(assetrow)-array['full_description','updated_at'])::text);
end ${doTag};

-- BEGIN EXACT ORIGINAL0700 SOURCE. The history record below stores this source alone.
${source}
-- END EXACT ORIGINAL0700 SOURCE.

do ${doTag}
declare t record;expression text; actual jsonb;changed jsonb;added jsonb;before_count bigint;after_count bigint;table_count integer:=0;
begin
 select coalesce(jsonb_object_agg(p.oid::regprocedure::text,md5(p.prosrc)),'{}') into actual
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '${DEEP_CLAIM_PHASE7_CRITICAL_PATTERN}';
 if actual is distinct from ${expectedSQL} then raise exception 'Release postflight: expected function bodies mismatch';end if;
 select coalesce(jsonb_agg(b.key order by b.key collate "C"),'[]') into changed from jsonb_each_text(${baselineSQL}) b where actual->>b.key is distinct from b.value;
 select coalesce(jsonb_agg(a.key order by a.key collate "C"),'[]') into added from jsonb_each_text(actual) a where not(${baselineSQL} ? a.key);
 if not(changed @> ${changedSQL} and changed <@ ${changedSQL} and added @> ${addedSQL} and added <@ ${addedSQL}) then raise exception 'Release postflight: changed-function allowlist mismatch';end if;
 if exists(select 1 from pg_temp.dc_release_function_oids b where to_regprocedure(b.signature)::oid is distinct from b.function_oid) then raise exception 'Release postflight: existing function identity changed';end if;
 for t in select c.relname,c.oid,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'dc_%' order by c.relname loop
  table_count:=table_count+1;
  if not t.relrowsecurity or has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Release postflight: private table authorization mismatch';end if;
  expression:=case t.relname when 'dc_companies' then 'to_jsonb(t)-array[''revision'',''updated_at'']' when 'dc_expeditions' then 'to_jsonb(t)-''deep_modifiers''' else 'to_jsonb(t)' end;
  execute format('insert into pg_temp.dc_release_rows_after select %L,md5((%s)::text),count(*) from public.%I t group by md5((%s)::text)',t.relname,expression,t.relname,expression);
  select coalesce(sum(copies),0) into before_count from pg_temp.dc_release_rows_before where table_name=t.relname;
  select coalesce(sum(copies),0) into after_count from pg_temp.dc_release_rows_after where table_name=t.relname;
  if t.relname='dc_chunks' then
   if after_count<before_count then raise exception 'Release postflight: chunk metadata was removed';end if;
  elsif after_count-before_count<>(case t.relname when 'dc_rules' then 1 when 'dc_recipes' then 2 when 'dc_equipment_catalog' then 1 else 0 end) then raise exception 'Release postflight: unexpected Deep Claim row-count change';end if;
 end loop;
 if table_count<>33 then raise exception 'Release postflight: expected33 private Deep Claim tables';end if;
 if exists(select 1 from pg_temp.dc_release_tables b left join pg_class c on c.oid=b.table_oid left join pg_namespace n on n.oid=c.relnamespace where c.relname is distinct from b.table_name or n.nspname is distinct from 'public' or c.relkind is distinct from 'r') then raise exception 'Release postflight: existing private table identity changed';end if;
 if exists(select 1 from pg_temp.dc_release_rows_before b left join pg_temp.dc_release_rows_after a using(table_name,row_hash) where coalesce(a.copies,0)<b.copies) then raise exception 'Release postflight: existing private company data changed';end if;
 if exists(select 1 from pg_temp.dc_release_company_revisions b left join public.dc_companies c using(id) where c.id is null or c.revision<>b.revision+1) then raise exception 'Release postflight: company revision must increase exactly once';end if;
 if exists(select 1 from public.dc_expeditions where config_version<>7 and deep_modifiers is not null) then raise exception 'Release postflight: legacy expedition modifiers changed';end if;
 -- Added chunks are only deterministic OLD metadata pins, never new terrain.
 if exists(select 1 from public.dc_chunks c join public.dc_worlds w using(company_id) where not exists(select 1 from pg_temp.dc_release_rows_before b where b.table_name='dc_chunks' and b.row_hash=md5(to_jsonb(c)::text)) and (
  c.world_version not between 1 and 3 or c.seed<>md5(w.seed::text||':'||c.world_version||':'||c.chunk_x||':'||c.chunk_y) or not exists(
   select 1 from public.dc_milestones m join public.dc_expeditions e on e.id=m.job_id cross join lateral jsonb_array_elements(coalesce(m.payload->'reveals','[]')||coalesce(m.payload->'extractions','[]'))p
    where m.company_id=c.company_id and m.applied_at is null and e.config_version in(1,2,3) and (p.value->>'x')::integer/32=c.chunk_x and (p.value->>'y')::integer/32=c.chunk_y
   union all select 1 from public.dc_expeditions e join public.dc_plans plan on plan.job_id=e.id cross join lateral jsonb_array_elements(coalesce(plan.content->'reveals','[]')||coalesce(plan.content->'extractions','[]')||e.path||jsonb_build_array(jsonb_build_object('x',e.target_x,'y',e.target_y)))p
    where e.company_id=c.company_id and e.status='active' and e.config_version in(1,2,3) and (p.value->>'x')::integer/32=c.chunk_x and (p.value->>'y')::integer/32=c.chunk_y))) then raise exception 'Release postflight: unexpected new geological metadata';end if;
 foreach expression in array array['dh_feat_unlocks','dh_feat_catalog','club_installed_assets'] loop
  execute format('insert into pg_temp.dc_release_shared_after select %L,md5(to_jsonb(t)::text),count(*) from public.%I t group by md5(to_jsonb(t)::text)',expression,expression);
 end loop;
 insert into pg_temp.dc_release_shared_after select 'deep_claim_asset',md5((to_jsonb(assetrow)-array['full_description','updated_at'])::text),count(*) from public.platform_assets assetrow where assetrow.slug='deep-claim' group by md5((to_jsonb(assetrow)-array['full_description','updated_at'])::text);
 if exists(select 1 from pg_temp.dc_release_shared_before b left join pg_temp.dc_release_shared_after a using(table_name,row_hash) where coalesce(a.copies,0)<b.copies) then raise exception 'Release postflight: existing awards, definitions or installation choices changed';end if;
 if(select coalesce(sum(copies),0) from pg_temp.dc_release_shared_before where table_name='dh_feat_catalog')<>(select coalesce(sum(copies),0) from pg_temp.dc_release_shared_after where table_name='dh_feat_catalog') then raise exception 'Release postflight: Feat catalog size changed';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' and(
  has_function_privilege('anon',p.oid,'EXECUTE') or not has_function_privilege('service_role',p.oid,'EXECUTE') or
  has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from exists(select 1 from pg_temp.dc_release_member_rpcs r where r.signature=p.oid::regprocedure::text) or
  (has_function_privilege('authenticated',p.oid,'EXECUTE') and not p.prosecdef))) then raise exception 'Release postflight: function authorization mismatch';end if;
 if (select count(*) from pg_temp.dc_release_member_rpcs)<>25 or (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' and has_function_privilege('authenticated',p.oid,'EXECUTE'))<>25 then raise exception 'Release postflight: member RPC count changed';end if;
 if exists(select 1 from pg_publication_tables where schemaname='public' and tablename like 'dc_%') then raise exception 'Release postflight: private Deep Claim tables must not enter Realtime';end if;
end ${doTag};

insert into supabase_migrations.schema_migrations(version,name,statements)
 values('${DEEP_CLAIM_PHASE7_RELEASE_VERSION}','${DEEP_CLAIM_PHASE7_RELEASE_NAME}',array[${sourceSQL}]);
do ${doTag}
declare prior record;
begin
 for prior in select * from jsonb_to_recordset(${priorSQL}) as p(version text,name text,md5 text) loop
  if not exists(select 1 from supabase_migrations.schema_migrations h where h.version=prior.version and h.name=prior.name and cardinality(h.statements)=1 and md5(h.statements[1])=prior.md5) then raise exception 'Release postflight: prior source history changed';end if;
 end loop;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='${DEEP_CLAIM_PHASE7_RELEASE_VERSION}' and name='${DEEP_CLAIM_PHASE7_RELEASE_NAME}' and cardinality(statements)=1 and md5(statements[1])='${md5(source)}') then raise exception 'Release postflight: exact original source was not recorded';end if;
end ${doTag};

select jsonb_build_object('ok',true,'version','${DEEP_CLAIM_PHASE7_RELEASE_VERSION}','critical_functions',153,'dc_functions',138,'member_rpcs',25,'private_tables',33,
 'companies_preserved',(select count(*) from pg_temp.dc_release_company_revisions),
 'existing_feat_awards_preserved',(select coalesce(sum(copies),0) from pg_temp.dc_release_shared_before where table_name='dh_feat_unlocks'),
 'prior_sources_verified',7,'existing_rows_preserved',true,'authorization_verified',true,'source_recorded',true,'source_md5','${md5(source)}') release;
commit;
`;
}
