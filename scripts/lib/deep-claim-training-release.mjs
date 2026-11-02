// Constructs the reviewed educational migration transaction; never connects or
// executes it. Runtime fingerprints contain hashes only, never player records.
import { createHash } from 'node:crypto';

export const DEEP_CLAIM_TRAINING_RELEASE_VERSION = '20261102080000';
export const DEEP_CLAIM_TRAINING_RELEASE_NAME = 'deep_claim_training_journal';
export const DEEP_CLAIM_TRAINING_CRITICAL_PATTERN = '^(dc_|dh_feat|dh_feats|dh_home_progress|dh_public_member|dh_visible)';
export const DEEP_CLAIM_TRAINING_SOURCE_SHA256 = '787670491647a61f49ad967a980acf6805255c7ecbbc29c5d0b253699c81a670';
export const DEEP_CLAIM_TRAINING_SOURCE_MD5 = '8cdd87f5834c5bfaf91a7089f059b637';
export const DEEP_CLAIM_TRAINING_ADDED_SIGNATURES = Object.freeze([
  'dc_tutorial_get()', 'dc_tutorial_guard_v1()', 'dc_tutorial_ids_v1(text)',
  'dc_tutorial_ids_valid_v1(text[],text,integer)', 'dc_tutorial_save(jsonb,integer,uuid)',
  'dc_tutorial_snapshot_v1(uuid,uuid,uuid,timestamp with time zone)',
  'dc_tutorial_union_v1(text[],jsonb)', 'dc_tutorial_validate_patch_v1(jsonb)',
]);

const PRIOR_NAMES = Object.freeze({
  '20261102010000': 'deep_claim_foundation', '20261102020000': 'deep_claim_discovery',
  '20261102030000': 'deep_claim_workforce_production', '20261102040000': 'deep_claim_underground_operations',
  '20261102050000': 'deep_claim_business_development', '20261102060000': 'deep_claim_club_operations',
  '20261102061000': 'deep_claim_dh_integration', '20261102070000': 'deep_claim_ancient_deep',
});
const OLD_MEMBER_NAMES = Object.freeze([
  'dc_bootstrap','dc_get','dc_reconcile','dc_preview','dc_dispatch','dc_collect','dc_sell','dc_upgrade',
  'dc_hire','dc_train','dc_assign_equipment','dc_repair_equipment','dc_start_production','dc_collect_production',
  'dc_retire_equipment','dc_preview_operation','dc_dispatch_operation','dc_resolve_discovery','dc_start_research',
  'dc_fulfill_contract','dc_claim_milestone','dc_get_club','dc_set_social_preferences','dc_contribute_project','dc_claim_project',
]);
const SHARED_TABLES = Object.freeze([
  'dh_feat_accounts','dh_feat_catalog','dh_feat_progress','dh_feat_unlocks','notifications','notification_preferences',
  'club_installed_assets','platform_assets','profiles','clubs','club_members','user_roles',
]);
const critical = new RegExp(DEEP_CLAIM_TRAINING_CRITICAL_PATTERN);
const hash = (value, algorithm = 'md5') => createHash(algorithm).update(value).digest('hex');
const fail = message => { throw new Error(`Training release: ${message}`); };

function bodies(value, label, count, dcCount) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be a function-body map`);
  const entries = value instanceof Map ? [...value] : Object.entries(value);
  if (entries.length !== count) fail(`${label} must contain exactly${count} critical functions`);
  const result = Object.create(null);
  for (const [signature, md5] of entries) {
    if (typeof signature !== 'string' || signature.length > 512 || !/^[a-z_][a-z_0-9]*\([a-z_0-9 ,.\[\]]*\)$/.test(signature)
      || !critical.test(signature.slice(0, signature.indexOf('(')))) fail(`${label} has an invalid critical signature`);
    if (typeof md5 !== 'string' || !/^[a-f0-9]{32}$/i.test(md5) || Object.hasOwn(result, signature)) fail(`${label} has an invalid or duplicate MD5`);
    result[signature] = md5.toLowerCase();
  }
  if (Object.keys(result).filter(key => key.startsWith('dc_')).length !== dcCount) fail(`${label} must contain exactly${dcCount} dc_ functions`);
  return result;
}

// Transaction commands inside comments/quoted function bodies are harmless;
// top-level boundaries would escape this release and are always rejected.
function assertSource(source) {
  if (typeof source !== 'string' || !source.trim() || source.includes('\0') || Buffer.byteLength(source) > 1_000_000) fail('invalid migration source');
  let command = '', state = 'normal', delimiter = '', depth = 0, escaped = false;
  const statement = () => { if (/^\s*(?:begin\b|commit\b|end\b|rollback\b|abort\b|start\s+transaction\b|prepare\s+transaction\b)/i.test(command)) fail('source contains transaction boundaries'); command = ''; };
  for (let index = 0; index < source.length; index++) {
    const char = source[index], next = source[index + 1];
    if (state === 'line') { if (char === '\n') { state = 'normal'; command += ' '; } continue; }
    if (state === 'block') { if (char === '/' && next === '*') { depth++; index++; } else if (char === '*' && next === '/') { depth--; index++; if (!depth) { state = 'normal'; command += ' '; } } continue; }
    if (state === 'dollar') { if (source.startsWith(delimiter, index)) { index += delimiter.length - 1; state = 'normal'; command += ' '; } continue; }
    if (state === 'single' || state === 'double') {
      const quote = state === 'single' ? "'" : '"';
      if (state === 'single' && escaped && char === '\\') { index++; continue; }
      if (char === quote) { if (next === quote) index++; else { state = 'normal'; command += ' '; } } continue;
    }
    if (char === '-' && next === '-') { state = 'line'; index++; continue; }
    if (char === '/' && next === '*') { state = 'block'; depth = 1; index++; continue; }
    if (char === "'" || char === '"') { escaped = char === "'" && /(?:^|[^a-z_0-9])e$/i.test(command); state = char === "'" ? 'single' : 'double'; command += ' '; continue; }
    if (char === '$') { const found = source.slice(index).match(/^\$(?:[a-z_][a-z_0-9]*)?\$/i); if (found) { delimiter = found[0]; index += delimiter.length - 1; state = 'dollar'; command += ' '; continue; } }
    if (char === ';') statement(); else command += char;
  }
  if (!['normal','line'].includes(state)) fail('unterminated source quote or comment'); statement();
  if (hash(source, 'sha256') !== DEEP_CLAIM_TRAINING_SOURCE_SHA256 || hash(source) !== DEEP_CLAIM_TRAINING_SOURCE_MD5) fail('source does not match the frozen0800 SHA256/MD5');
}

/** Only build; callers explicitly execute the resulting one-transaction SQL. */
export function buildDeepClaimTrainingRelease({ source, baselineBodies, expectedBodies, priorMigrations } = {}) {
  assertSource(source);
  const before = bodies(baselineBodies, 'baselineBodies', 153, 138), after = bodies(expectedBodies, 'expectedBodies', 161, 146);
  const additions = Object.keys(after).filter(key => !Object.hasOwn(before, key)).sort();
  if (JSON.stringify(additions) !== JSON.stringify([...DEEP_CLAIM_TRAINING_ADDED_SIGNATURES].sort()) || Object.keys(before).some(key => !Object.hasOwn(after, key))) fail('only the eight tutorial signatures may be added; every existing function must remain');
  // Expected hash values may be deliberately wrong for rollback QA. SQL checks
  // both the expected whole map and unchanged actual baseline independently.
  if (!Array.isArray(priorMigrations) || priorMigrations.length !== 8) fail('eight prior source-history records are required');
  const prior = priorMigrations.map(item => {
    if (!item || typeof item.version !== 'string' || PRIOR_NAMES[item.version] !== item.name || typeof item.md5 !== 'string' || !/^[a-f0-9]{32}$/i.test(item.md5)) fail('invalid prior migration identity or MD5');
    return { version: item.version, name: item.name, md5: item.md5.toLowerCase() };
  });
  if (new Set(prior.map(item => item.version)).size !== 8) fail('duplicate prior migration version');
  const haystack = [source, JSON.stringify(before), JSON.stringify(after), JSON.stringify(prior)].join('\n');
  function delimiter(label) { let index = 0, tag; do { tag = `$dc_training_${label}_${hash(haystack).slice(0, 12)}_${index++}$`; } while (haystack.includes(tag)); return tag; }
  const literal = (value, label) => { let tag = delimiter(label); while (value.includes(tag)) tag = tag.slice(0, -1) + '_x$'; return `${tag}${value}${tag}`; };
  const json = (value, label) => `${literal(JSON.stringify(value), label)}::jsonb`;
  const beforeSQL = json(before, 'before'), afterSQL = json(after, 'after'), priorSQL = json(prior, 'prior');
  const additionsSQL = json(DEEP_CLAIM_TRAINING_ADDED_SIGNATURES, 'added'), oldMembersSQL = json(OLD_MEMBER_NAMES, 'members'), sharedSQL = json(SHARED_TABLES, 'shared');
  const sourceSQL = literal(source, 'source'), block = delimiter('checks');

  return `-- Exact educational release; only safe aggregate metadata is returned.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
set local search_path=public,pg_temp;
-- No asset UPDATE or later asset row lock exists, so this barrier comes first.
lock table public.dc_companies in access exclusive mode;
do ${block} begin perform id from public.dc_companies order by id for update;end ${block};
lock table public.dc_expeditions in share row exclusive mode;
lock table public.dc_production_jobs in share row exclusive mode;

do ${block}
declare actual jsonb; migration record;member_names jsonb;
begin
 if exists(select 1 from supabase_migrations.schema_migrations where version='${DEEP_CLAIM_TRAINING_RELEASE_VERSION}') then raise exception 'Training release already recorded';end if;
 select coalesce(jsonb_object_agg(p.oid::regprocedure::text,md5(p.prosrc)),'{}') into actual from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '${DEEP_CLAIM_TRAINING_CRITICAL_PATTERN}';
 if actual is distinct from ${beforeSQL} then raise exception 'Training preflight: critical baseline mismatch';end if;
 for migration in select * from jsonb_to_recordset(${priorSQL}) as h(version text,name text,md5 text) loop
  if not exists(select 1 from supabase_migrations.schema_migrations h where h.version=migration.version and h.name=migration.name and cardinality(h.statements)=1 and md5(h.statements[1])=migration.md5) then raise exception 'Training preflight: prior source history mismatch';end if;
 end loop;
 select jsonb_agg(p.proname order by p.proname collate "C") into member_names from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^dc_' and has_function_privilege('authenticated',p.oid,'EXECUTE');
 if member_names is distinct from(select jsonb_agg(value order by (value#>>'{}') collate "C") from jsonb_array_elements(${oldMembersSQL})) then raise exception 'Training preflight: member RPC baseline mismatch';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^dc_' and(has_function_privilege('anon',p.oid,'EXECUTE') or not has_function_privilege('service_role',p.oid,'EXECUTE'))) then raise exception 'Training preflight: function authorization mismatch';end if;
 if exists(select 1 from pg_publication_tables where schemaname='public' and tablename ~ '^dc_') then raise exception 'Training preflight: private tables must not enter Realtime';end if;
end ${block};

create temporary table pg_temp.dc_training_tables on commit drop as select c.relname table_name,c.oid table_oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname ~ '^dc_';
create temporary table pg_temp.dc_training_functions on commit drop as select p.oid function_oid,p.oid::regprocedure::text signature,md5(to_jsonb(p)::text) metadata_hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '${DEEP_CLAIM_TRAINING_CRITICAL_PATTERN}';
create temporary table pg_temp.dc_training_old_rpcs on commit drop as select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^dc_' and has_function_privilege('authenticated',p.oid,'EXECUTE');
create temporary table pg_temp.dc_training_before(table_name text not null,row_hash text not null,copies bigint not null,primary key(table_name,row_hash)) on commit drop;
create temporary table pg_temp.dc_training_after(like pg_temp.dc_training_before including all) on commit drop;
create temporary table pg_temp.dc_training_shared_before(like pg_temp.dc_training_before including all) on commit drop;
create temporary table pg_temp.dc_training_shared_after(like pg_temp.dc_training_before including all) on commit drop;

do ${block}
declare tab record;shared text;begin
 if(select count(*) from pg_temp.dc_training_tables)<>33 then raise exception 'Training preflight: expected33 economic tables';end if;
 for tab in select c.oid,c.relname,c.relrowsecurity from pg_class c join pg_temp.dc_training_tables t on t.table_oid=c.oid loop
  if not tab.relrowsecurity or has_table_privilege('authenticated',tab.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_table_privilege('anon',tab.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Training preflight: table authorization mismatch';end if;
  execute format('insert into pg_temp.dc_training_before select %L,md5(to_jsonb(record_row)::text),count(*) from public.%I record_row group by md5(to_jsonb(record_row)::text)',tab.relname,tab.relname);
 end loop;
 for shared in select jsonb_array_elements_text(${sharedSQL}) loop
  execute format('insert into pg_temp.dc_training_shared_before select %L,md5(to_jsonb(record_row)::text),count(*) from public.%I record_row group by md5(to_jsonb(record_row)::text)',shared,shared);
 end loop;
end ${block};

-- BEGIN EXACT ORIGINAL0800 SOURCE.
${source}
-- END EXACT ORIGINAL0800 SOURCE.

do ${block}
declare actual jsonb;added jsonb;tab record;shared text;begin
 select coalesce(jsonb_object_agg(p.oid::regprocedure::text,md5(p.prosrc)),'{}') into actual from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '${DEEP_CLAIM_TRAINING_CRITICAL_PATTERN}';
 if actual is distinct from ${afterSQL} then raise exception 'Training postflight: expected function bodies mismatch';end if;
 if exists(select 1 from jsonb_each_text(${beforeSQL}) b where actual->>b.key is distinct from b.value) then raise exception 'Training postflight: an existing function changed';end if;
 select coalesce(jsonb_agg(a.key order by a.key collate "C"),'[]') into added from jsonb_each_text(actual) a where not(${beforeSQL} ? a.key);
 if not(added @> ${additionsSQL} and added <@ ${additionsSQL}) then raise exception 'Training postflight: tutorial function additions mismatch';end if;
 if exists(select 1 from pg_temp.dc_training_functions f left join pg_proc p on p.oid=f.function_oid where p.oid is null or p.oid::regprocedure::text<>f.signature or md5(to_jsonb(p)::text)<>f.metadata_hash) then raise exception 'Training postflight: existing function identity or security metadata changed';end if;
 if exists(select 1 from pg_temp.dc_training_tables t left join pg_class c on c.oid=t.table_oid left join pg_namespace n on n.oid=c.relnamespace where c.relname is distinct from t.table_name or n.nspname is distinct from 'public' or c.relkind is distinct from 'r') then raise exception 'Training postflight: old table identity changed';end if;
 for tab in select * from pg_temp.dc_training_tables loop
  execute format('insert into pg_temp.dc_training_after select %L,md5(to_jsonb(record_row)::text),count(*) from public.%I record_row group by md5(to_jsonb(record_row)::text)',tab.table_name,tab.table_name);
 end loop;
 if exists((select * from pg_temp.dc_training_before except select * from pg_temp.dc_training_after) union all(select * from pg_temp.dc_training_after except select * from pg_temp.dc_training_before)) then raise exception 'Training postflight: old economic records changed';end if;
 for shared in select jsonb_array_elements_text(${sharedSQL}) loop
  execute format('insert into pg_temp.dc_training_shared_after select %L,md5(to_jsonb(record_row)::text),count(*) from public.%I record_row group by md5(to_jsonb(record_row)::text)',shared,shared);
 end loop;
 if exists(select 1 from pg_temp.dc_training_shared_before b left join pg_temp.dc_training_shared_after a using(table_name,row_hash) where coalesce(a.copies,0)<b.copies) then raise exception 'Training postflight: old awards, settings, installations or identity records changed';end if;
 if(select coalesce(sum(copies),0) from pg_temp.dc_training_shared_before where table_name='dh_feat_catalog')<>(select coalesce(sum(copies),0) from pg_temp.dc_training_shared_after where table_name='dh_feat_catalog') then raise exception 'Training postflight: Feat catalog changed';end if;
 if(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname ~ '^dc_')<>35 then raise exception 'Training postflight: expected35 private tables';end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='dc_tutorial_progress' and c.relkind='r') or not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='dc_tutorial_requests' and c.relkind='r') then raise exception 'Training postflight: tutorial tables missing';end if;
 if exists(select 1 from public.dc_tutorial_progress) or exists(select 1 from public.dc_tutorial_requests) then raise exception 'Training postflight: migration must not seed player education records';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname ~ '^dc_' and(not c.relrowsecurity or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))) then raise exception 'Training postflight: private table authorization mismatch';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^dc_' and(
  has_function_privilege('anon',p.oid,'EXECUTE') or not has_function_privilege('service_role',p.oid,'EXECUTE') or
  has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from(exists(select 1 from pg_temp.dc_training_old_rpcs r where r.signature=p.oid::regprocedure::text) or p.oid::regprocedure::text in('dc_tutorial_get()','dc_tutorial_save(jsonb,integer,uuid)')) or
  (has_function_privilege('authenticated',p.oid,'EXECUTE') and not p.prosecdef))) then raise exception 'Training postflight: RPC authorization mismatch';end if;
 if(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^dc_' and has_function_privilege('authenticated',p.oid,'EXECUTE'))<>27 then raise exception 'Training postflight: expected27 member RPCs';end if;
 if exists(select 1 from pg_publication_tables where schemaname='public' and tablename ~ '^dc_') then raise exception 'Training postflight: private tables entered Realtime';end if;
end ${block};

insert into supabase_migrations.schema_migrations(version,name,statements) values('${DEEP_CLAIM_TRAINING_RELEASE_VERSION}','${DEEP_CLAIM_TRAINING_RELEASE_NAME}',array[${sourceSQL}]);
do ${block}
declare migration record;begin
 for migration in select * from jsonb_to_recordset(${priorSQL}) as h(version text,name text,md5 text) loop
  if not exists(select 1 from supabase_migrations.schema_migrations h where h.version=migration.version and h.name=migration.name and cardinality(h.statements)=1 and md5(h.statements[1])=migration.md5) then raise exception 'Training postflight: old source history changed';end if;
 end loop;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='${DEEP_CLAIM_TRAINING_RELEASE_VERSION}' and name='${DEEP_CLAIM_TRAINING_RELEASE_NAME}' and cardinality(statements)=1 and md5(statements[1])='${DEEP_CLAIM_TRAINING_SOURCE_MD5}' and encode(sha256(convert_to(statements[1],'UTF8')),'hex')='${DEEP_CLAIM_TRAINING_SOURCE_SHA256}') then raise exception 'Training postflight: original0800 source was not recorded exactly';end if;
end ${block};

select jsonb_build_object('ok',true,'version','${DEEP_CLAIM_TRAINING_RELEASE_VERSION}','critical_functions',161,'member_rpcs',27,'private_tables',35,
 'old_functions_exact',153,'old_economic_tables_exact',33,'old_records_preserved',true,'tutorial_records_seeded',0,
 'old_awards_preserved',(select coalesce(sum(copies),0) from pg_temp.dc_training_shared_before where table_name='dh_feat_unlocks'),
 'prior_sources_verified',8,'source_recorded',true,'source_md5','${DEEP_CLAIM_TRAINING_SOURCE_MD5}','source_sha256','${DEEP_CLAIM_TRAINING_SOURCE_SHA256}') release;
commit;
`;
}
