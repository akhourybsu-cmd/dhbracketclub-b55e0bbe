-- Lightweight own-account progress for Home. No club-wide evaluation or
-- achievement acknowledgement; opening Home grants no activity by itself.
begin;
create or replace function public.dh_home_progress(p_club_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); total bigint; earned integer; position bigint; goals jsonb; pins text[];
begin
  if uid is null or not exists(select 1 from club_members where club_id=p_club_id and user_id=uid) then
    raise exception 'Club membership required';
  end if;
  perform dh_feats_refresh_user(uid);
  select coalesce(sum(points),0),count(*) into total,earned from dh_feat_unlocks where user_id=uid;
  select pinned into pins from dh_feat_accounts where user_id=uid;
  select 1+count(*) into position from (
    select c.user_id,coalesce(sum(u.points),0) score from club_members c
    left join dh_feat_unlocks u on u.user_id=c.user_id where c.club_id=p_club_id group by c.user_id
  ) standing where score>total;
  with candidates as (
    select c.key,c.title,c.category,c.unit,coalesce(p.value,0) value,t.target,t.tier::integer,
      c.points[t.tier] points,c.sort_order,array_position(pins,c.key) pin,
      greatest(0,least(1,(coalesce(p.value,0)-coalesce(c.thresholds[t.tier-1],0))/
        (t.target-coalesce(c.thresholds[t.tier-1],0)))) progress
    from dh_feat_catalog c left join dh_feat_progress p on p.feat_key=c.key and p.user_id=uid
    cross join lateral (
      select threshold target,ordinality tier from unnest(c.thresholds) with ordinality s(threshold,ordinality)
      where not exists(select 1 from dh_feat_unlocks u where u.user_id=uid and u.feat_key=c.key and u.tier=s.ordinality)
      order by ordinality limit 1
    ) t
  ), chosen as (
    select *,pin is not null tracked from candidates order by pin nulls last,progress desc,sort_order limit 8
  ) select coalesce(jsonb_agg(to_jsonb(g)-'pin'-'sort_order' order by pin nulls last,progress desc,sort_order),'[]') into goals from chosen g;
  return jsonb_build_object('score',total,'unlocked',earned,'club_rank',position,'goals',goals);
end $$;
revoke all on function public.dh_home_progress(uuid) from public,anon;
grant execute on function public.dh_home_progress(uuid) to authenticated;
commit;
