-- The Splendid Journey — legible player agency and decision consequences.
--
-- Choice agency metadata is encoded in the existing tags array so it survives
-- the current Studio import/export and immutable release-package pipeline:
--   path:guardian
--   impact:Protect the trapped crew
--   outcome:The crew remembers who came back for them.

create or replace function public.journey_tag_values(_tags jsonb, _prefix text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(substr(x.tag, char_length(_prefix) + 1)) order by x.ord), '[]'::jsonb)
    from jsonb_array_elements_text(
      case when jsonb_typeof(_tags) = 'array' then _tags else '[]'::jsonb end
    ) with ordinality as x(tag, ord)
   where x.tag like _prefix || '%'
     and char_length(x.tag) > char_length(_prefix);
$$;

create or replace function public.journey_first_tag_value(_tags jsonb, _prefix text)
returns text
language sql
immutable
set search_path = public
as $$
  select x.tag_value
    from jsonb_array_elements_text(public.journey_tag_values(_tags, _prefix)) x(tag_value)
   limit 1;
$$;

create or replace function public.journey_path_label(_path text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(_path, ''))
    when 'guardian' then 'Guardian'
    when 'seeker' then 'Seeker'
    when 'defiant' then 'Defiant'
    when 'maker' then 'Maker'
    else null
  end;
$$;

revoke all on function public.journey_tag_values(jsonb, text) from anon, public;
revoke all on function public.journey_first_tag_value(jsonb, text) from anon, public;
revoke all on function public.journey_path_label(text) from anon, public;

-- A choice now strengthens Theron's authored role-playing path, stores a
-- spoiler-safe decision record, and returns an immediate consequence card.
create or replace function public.journey_execute_choice(
  _run_id uuid,
  _scene_key text,
  _choice_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  run public.journey_campaign_runs;
  sc jsonb;
  ch jsonb;
  st jsonb;
  made jsonb;
  res jsonb;
  notices jsonb := '[]'::jsonb;
  path_value text;
  path_label text;
  path_variable text;
  outcome_value text;
  impact jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into run from public.journey_campaign_runs where id = _run_id for update;
  if run is null or run.user_id <> uid then raise exception 'Run not found'; end if;
  if run.status <> 'active' then raise exception 'This journey is no longer active'; end if;
  if run.current_scene_key is distinct from _scene_key then raise exception 'Scene out of sync'; end if;

  sc := public.journey_scene_content(run.campaign_id, run.campaign_version, _scene_key);
  if sc is null then raise exception 'Scene not found'; end if;
  select e into ch from jsonb_array_elements(coalesce(sc -> 'choices', '[]'::jsonb)) e
   where e ->> 'choice_key' = _choice_key limit 1;
  if ch is null then raise exception 'Choice not available in this scene'; end if;

  st := coalesce(run.state, '{}'::jsonb);
  if not public.journey_eval_requirements(ch -> 'requirements', st) then
    raise exception 'Requirements not met';
  end if;
  if coalesce((ch ->> 'once_only')::boolean, false)
     and (coalesce(st -> 'choices_made', '[]'::jsonb) @> to_jsonb(array[_choice_key])) then
    raise exception 'Choice already taken';
  end if;

  st := public.journey_apply_effects(ch -> 'effects', st);
  notices := public.journey_effect_notices(ch -> 'effects');

  path_value := lower(public.journey_first_tag_value(ch -> 'tags', 'path:'));
  path_label := public.journey_path_label(path_value);
  path_variable := case path_value
    when 'guardian' then 'PATH_GUARDIAN'
    when 'seeker' then 'PATH_SEEKER'
    when 'defiant' then 'PATH_DEFIANT'
    when 'maker' then 'PATH_MAKER'
    else null
  end;
  if path_variable is not null then
    st := public.journey_apply_effects(
      jsonb_build_array(jsonb_build_object(
        'type', 'increment_variable',
        'key', path_variable,
        'value', 1
      )),
      st
    );
    notices := notices || jsonb_build_array(path_label || ' path strengthened');
  end if;

  made := coalesce(st -> 'choices_made', '[]'::jsonb);
  if not (made @> to_jsonb(_choice_key)) then
    st := jsonb_set(st, array['choices_made'], made || to_jsonb(_choice_key), true);
  end if;

  outcome_value := public.journey_first_tag_value(ch -> 'tags', 'outcome:');
  impact := jsonb_build_object(
    'choice_text', ch ->> 'choice_text',
    'path', path_value,
    'path_label', path_label,
    'outcome_text', outcome_value,
    'impact', public.journey_tag_values(ch -> 'tags', 'impact:')
  );

  insert into public.journey_run_choice_history
    (run_id, user_id, scene_key, choice_key, choice_text_snapshot, campaign_version, metadata)
  values
    (run.id, uid, _scene_key, _choice_key, ch ->> 'choice_text', run.campaign_version, impact);

  if (ch ->> 'next_scene_key') is not null then
    res := public.journey_enter_scene(run.campaign_id, run.campaign_version, ch ->> 'next_scene_key', st);
    notices := notices || coalesce(res -> 'notices', '[]'::jsonb);
    update public.journey_campaign_runs r set
      state = res -> 'state',
      current_scene_key = res ->> 'scene_key',
      current_chapter_key = coalesce(res ->> 'chapter_key', r.current_chapter_key),
      status = case when (res ->> 'terminal')::boolean then 'completed' else r.status end,
      ending_key = coalesce(res ->> 'ending_key', r.ending_key),
      completed_at = case when (res ->> 'terminal')::boolean then now() else r.completed_at end,
      last_played_at = now()
    where r.id = run.id returning * into run;
  else
    update public.journey_campaign_runs r set state = st, last_played_at = now()
     where r.id = run.id returning * into run;
  end if;

  return jsonb_build_object(
    'run', to_jsonb(run),
    'notices', notices,
    'decision_impact', impact
  );
end;
$$;

revoke all on function public.journey_execute_choice(uuid, text, text) from anon, public;
grant execute on function public.journey_execute_choice(uuid, text, text) to authenticated;

-- Encounter approaches can now depend on inventory, traits, earlier choices,
-- relationships, or any other supported requirement. The check is repeated on
-- the server so a locked approach cannot be invoked by bypassing the client.
create or replace function public.journey_resolve_encounter_action(
  _run_id uuid,
  _scene_key text,
  _action_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  run public.journey_campaign_runs;
  sess public.journey_combat_sessions;
  encounter jsonb;
  action jsonb;
  st jsonb;
  ps jsonb;
  action_effects jsonb := '[]'::jsonb;
  resolution_effects jsonb := '[]'::jsonb;
  notices jsonb := '[]'::jsonb;
  entry jsonb;
  encounter_log jsonb;
  stat_key text;
  stat_score integer;
  focus integer;
  focus_cost integer;
  roll_bonus integer;
  die integer;
  total integer;
  difficulty integer;
  progress integer;
  progress_gained integer;
  target_progress integer;
  max_rounds integer;
  damage integer;
  result text;
  new_status text := 'active';
  resolved_flag text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(_action_key, '') = '' then raise exception 'Choose an approach'; end if;

  select * into run
    from public.journey_campaign_runs
   where id = _run_id
   for update;

  if run is null or run.user_id <> uid then raise exception 'Run not found'; end if;
  if run.status <> 'active' then raise exception 'This journey is no longer active'; end if;
  if run.current_scene_key is distinct from _scene_key then raise exception 'Scene out of sync'; end if;

  encounter := public.journey_adventure_encounter_definition(run.campaign_id, run.campaign_version, _scene_key);
  if encounter is null then raise exception 'This scene has no active challenge'; end if;

  select a into action
    from jsonb_array_elements(coalesce(encounter -> 'actions', '[]'::jsonb)) a
   where a ->> 'action_key' = _action_key
   limit 1;
  if action is null then raise exception 'That approach is not available'; end if;

  st := coalesce(run.state, '{}'::jsonb);
  if not public.journey_eval_requirements(action -> 'requirements', st) then
    raise exception '%', coalesce(nullif(action ->> 'locked_hint', ''), 'That approach is not available yet');
  end if;

  select * into sess
    from public.journey_combat_sessions s
   where s.run_id = run.id and s.scene_key = _scene_key
   order by s.created_at desc
   limit 1
   for update;

  if sess.id is null then
    insert into public.journey_combat_sessions
      (run_id, user_id, scene_key, status, round, player_state, enemies, log)
    values (
      run.id,
      uid,
      _scene_key,
      'active',
      1,
      jsonb_build_object(
        'progress', 0,
        'focus', greatest(0, coalesce((encounter ->> 'max_focus')::integer, 2))
      ),
      '[]'::jsonb,
      '[]'::jsonb
    )
    returning * into sess;
  end if;

  if sess.status <> 'active' then
    return jsonb_build_object(
      'session', to_jsonb(sess) - 'user_id',
      'state', run.state,
      'notices', jsonb_build_array('This challenge is already resolved.')
    );
  end if;

  ps := coalesce(sess.player_state, '{}'::jsonb);
  stat_key := coalesce(nullif(action ->> 'stat', ''), 'resolve');
  stat_score := greatest(0, coalesce((st #>> array['stats', stat_key])::integer, 0));
  focus := greatest(0, coalesce((ps ->> 'focus')::integer, (encounter ->> 'max_focus')::integer, 2));
  focus_cost := greatest(0, coalesce((action ->> 'focus_cost')::integer, 0));
  if focus_cost > focus then raise exception 'Not enough focus for that approach'; end if;

  roll_bonus := coalesce((action ->> 'roll_bonus')::integer, 0);
  difficulty := greatest(5, coalesce((action ->> 'difficulty')::integer, 11));
  die := floor(random() * 20 + 1)::integer;
  total := die + stat_score + roll_bonus;

  if die = 20 or total >= difficulty then
    result := 'success';
    progress_gained := greatest(1, coalesce((action ->> 'success_progress')::integer, 2));
    if die = 20 then progress_gained := progress_gained + 1; end if;
    damage := 0;
    action_effects := coalesce(action -> 'success_effects', '[]'::jsonb);
  elsif die <> 1 and total >= difficulty - 3 then
    result := 'costly';
    progress_gained := greatest(0, coalesce((action ->> 'costly_progress')::integer, 1));
    damage := greatest(0, coalesce((action ->> 'costly_damage')::integer, 1));
    action_effects := coalesce(action -> 'costly_effects', '[]'::jsonb);
  else
    result := 'setback';
    progress_gained := greatest(0, coalesce((action ->> 'setback_progress')::integer, 0));
    damage := greatest(0, coalesce((action ->> 'setback_damage')::integer, 2));
    action_effects := coalesce(action -> 'setback_effects', '[]'::jsonb);
  end if;

  progress := greatest(0, coalesce((ps ->> 'progress')::integer, 0)) + progress_gained;
  focus := focus - focus_cost;
  target_progress := greatest(1, coalesce((encounter ->> 'target_progress')::integer, 4));
  max_rounds := greatest(1, coalesce((encounter ->> 'max_rounds')::integer, 4));

  st := public.journey_apply_effects(action_effects, st);
  notices := notices || public.journey_effect_notices(action_effects);
  if damage > 0 then
    st := public.journey_apply_effects(
      jsonb_build_array(jsonb_build_object('type', 'damage_player', 'value', damage)),
      st
    );
    notices := notices || jsonb_build_array(format('%s strain suffered', damage));
  end if;

  if progress >= target_progress then
    new_status := 'victory';
    resolution_effects := coalesce(encounter -> 'success_effects', '[]'::jsonb);
  elsif sess.round >= max_rounds or coalesce((st ->> 'health')::integer, 0) <= 0 then
    new_status := 'defeat';
    resolution_effects := coalesce(encounter -> 'failure_effects', '[]'::jsonb);
  end if;

  if new_status <> 'active' then
    resolved_flag := coalesce(
      nullif(encounter ->> 'resolved_flag', ''),
      'encounter_' || _scene_key || '_resolved'
    );
    resolution_effects := resolution_effects || jsonb_build_array(
      jsonb_build_object('type', 'set_flag', 'key', resolved_flag, 'value', true),
      jsonb_build_object('type', 'set_variable', 'key', 'LAST_ENCOUNTER_OUTCOME', 'value', new_status)
    );
    st := public.journey_apply_effects(resolution_effects, st);
    notices := notices || public.journey_effect_notices(resolution_effects);
    if coalesce((st ->> 'health')::integer, 0) <= 0 then
      st := jsonb_set(st, '{health}', '1'::jsonb, true);
      notices := notices || jsonb_build_array('Theron presses on with 1 health.');
    end if;
  end if;

  entry := jsonb_build_object(
    'action_key', _action_key,
    'action_label', coalesce(action ->> 'label', _action_key),
    'stat', stat_key,
    'die', die,
    'stat_score', stat_score,
    'bonus', roll_bonus,
    'total', total,
    'difficulty', difficulty,
    'result', result,
    'progress_gained', progress_gained,
    'damage', damage,
    'at', now()
  );
  encounter_log := coalesce(sess.log, '[]'::jsonb) || jsonb_build_array(entry);
  ps := ps || jsonb_build_object(
    'progress', progress,
    'focus', focus,
    'last_result', entry
  );

  update public.journey_combat_sessions s
     set status = new_status,
         round = least(sess.round + 1, max_rounds),
         player_state = ps,
         log = encounter_log,
         updated_at = now()
   where s.id = sess.id
   returning * into sess;

  update public.journey_campaign_runs r
     set state = st,
         last_played_at = now(),
         updated_at = now()
   where r.id = run.id
   returning * into run;

  return jsonb_build_object(
    'session', to_jsonb(sess) - 'user_id',
    'state', run.state,
    'roll', entry,
    'notices', notices
  );
end;
$$;

revoke all on function public.journey_resolve_encounter_action(uuid, text, text) from anon, public;
grant execute on function public.journey_resolve_encounter_action(uuid, text, text) to authenticated;

-- Expand the spoiler-safe runtime with agency cues and evaluated encounter
-- availability. Requirements, effects, destinations, and outcome text remain
-- server-side until the player actually commits.
create or replace function public.journey_get_runtime_scene(_run_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  run public.journey_campaign_runs;
  camp public.journey_campaigns;
  sess public.journey_combat_sessions;
  sc jsonb;
  c jsonb;
  st jsonb;
  choices jsonb := '[]'::jsonb;
  blocks jsonb := '[]'::jsonb;
  b jsonb;
  avail boolean;
  taken boolean;
  loc_name text;
  npcmap jsonb := '{}'::jsonb;
  spk text;
  encounter jsonb;
  safe_actions jsonb := '[]'::jsonb;
  action jsonb;
  action_available boolean;
  safe_encounter jsonb;
  session_payload jsonb;
  path_value text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into run from public.journey_campaign_runs where id = _run_id;
  if run is null or run.user_id <> uid then raise exception 'Run not found'; end if;
  select * into camp from public.journey_campaigns where id = run.campaign_id;

  st := coalesce(run.state, '{}'::jsonb);
  sc := public.journey_scene_content(run.campaign_id, run.campaign_version, run.current_scene_key);
  encounter := public.journey_adventure_encounter_definition(
    run.campaign_id,
    run.campaign_version,
    run.current_scene_key
  );

  select coalesce(jsonb_object_agg(npc_key, to_jsonb(portrait)), '{}'::jsonb)
    into npcmap
    from public.journey_npcs
   where campaign_id = run.campaign_id and nullif(portrait, '') is not null;

  if sc is not null then
    for b in select * from jsonb_array_elements(coalesce(sc -> 'blocks', '[]'::jsonb)) loop
      if public.journey_eval_requirements(b -> 'conditions', st) then
        if (b ->> 'block_type') = 'dialogue' and (b -> 'metadata') is not null then
          spk := b -> 'metadata' ->> 'speaker_key';
          if spk is not null and (npcmap ? spk) then
            b := jsonb_set(b, '{metadata,portrait}', npcmap -> spk, true);
          end if;
        end if;
        blocks := blocks || (b - 'conditions');
      end if;
    end loop;

    for c in select * from jsonb_array_elements(coalesce(sc -> 'choices', '[]'::jsonb)) loop
      avail := public.journey_eval_requirements(c -> 'requirements', st);
      taken := coalesce((c ->> 'once_only')::boolean, false)
               and (coalesce(st -> 'choices_made', '[]'::jsonb) @> to_jsonb(array[c ->> 'choice_key']));
      if (avail and not taken) or not coalesce((c ->> 'hidden_when_unavailable')::boolean, false) then
        path_value := public.journey_first_tag_value(c -> 'tags', 'path:');
        choices := choices || jsonb_build_object(
          'choice_key', c ->> 'choice_key',
          'choice_text', c ->> 'choice_text',
          'short_label', c ->> 'short_label',
          'description', c ->> 'description',
          'choice_style', coalesce(c ->> 'choice_style', 'standard'),
          'confirmation_required', coalesce((c ->> 'confirmation_required')::boolean, false),
          'major_decision', coalesce((c ->> 'major_decision')::boolean, false),
          'available', (avail and not taken),
          'locked_hint', case when (avail and not taken) then null
                              else coalesce(nullif(c ->> 'locked_hint', ''), 'Unavailable') end,
          'intent', public.journey_path_label(path_value),
          'impact_preview', public.journey_tag_values(c -> 'tags', 'impact:')
        );
      end if;
    end loop;

    select name into loc_name
      from public.journey_locations
     where campaign_id = run.campaign_id and location_key = (sc ->> 'location_key');
  end if;

  if encounter is not null then
    for action in select * from jsonb_array_elements(coalesce(encounter -> 'actions', '[]'::jsonb)) loop
      action_available := public.journey_eval_requirements(action -> 'requirements', st);
      safe_actions := safe_actions || jsonb_build_array(
        (action - 'success_effects' - 'costly_effects' - 'setback_effects' - 'requirements')
        || jsonb_build_object(
          'available', action_available,
          'locked_hint', case when action_available then null
            else coalesce(nullif(action ->> 'locked_hint', ''), 'Earlier decisions have not opened this approach') end
        )
      );
    end loop;
    safe_encounter := (
      encounter - 'success_effects' - 'failure_effects' - 'resolved_flag' - 'author_notes'
    ) || jsonb_build_object('actions', safe_actions);

    select * into sess
      from public.journey_combat_sessions s
     where s.run_id = run.id and s.scene_key = run.current_scene_key
     order by s.created_at desc
     limit 1;

    if sess.id is null then
      session_payload := jsonb_build_object(
        'status', 'active',
        'round', 1,
        'player_state', jsonb_build_object(
          'progress', 0,
          'focus', greatest(0, coalesce((encounter ->> 'max_focus')::integer, 2))
        ),
        'log', '[]'::jsonb
      );
    else
      session_payload := to_jsonb(sess) - 'id' - 'run_id' - 'user_id' - 'scene_key' - 'enemies' - 'created_at' - 'updated_at';
    end if;
  end if;

  return jsonb_build_object(
    'run', to_jsonb(run),
    'campaign', jsonb_build_object(
      'id', camp.id,
      'title', camp.title,
      'subtitle', camp.subtitle,
      'slug', camp.slug,
      'cover_image', camp.cover_image
    ),
    'scene', case when sc is null then null else jsonb_build_object(
      'scene_key', sc ->> 'scene_key',
      'scene_type', sc ->> 'scene_type',
      'title', sc ->> 'title',
      'subtitle', sc ->> 'subtitle',
      'background_asset', sc ->> 'background_asset',
      'is_terminal', coalesce((sc ->> 'is_terminal')::boolean, false),
      'has_auto_next', (sc ->> 'auto_next_scene_key') is not null
    ) end,
    'chapter_title', sc ->> 'chapter_title',
    'location_name', loc_name,
    'blocks', blocks,
    'choices', choices,
    'encounter', case when encounter is null then null else jsonb_build_object(
      'definition', safe_encounter,
      'session', session_payload,
      'resolved', coalesce(sess.status, 'active') <> 'active',
      'outcome', coalesce(sess.status, 'active')
    ) end
  );
end;
$$;

revoke all on function public.journey_get_runtime_scene(uuid) from anon, public;
grant execute on function public.journey_get_runtime_scene(uuid) to authenticated;
