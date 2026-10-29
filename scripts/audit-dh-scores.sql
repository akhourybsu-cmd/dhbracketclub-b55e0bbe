-- Read-only accounting assertions (RPCs may reconcile pending source activity).
-- Run through an authorized database connection, never a browser client.
begin;
do $$
declare member record; entry jsonb; board jsonb; home jsonb; summary jsonb; expected_score bigint; expected_count bigint; expected_rank bigint;
begin
  for member in select distinct user_id,club_id from club_members where dh_public_member(user_id) order by club_id,user_id loop
    perform set_config('request.jwt.claim.sub',member.user_id::text,true);
    board:=dh_feats_board(member.club_id);
    home:=dh_home_progress(member.club_id);
    summary:=dh_feats_summary(member.club_id);
    select coalesce(sum(points),0),count(*) into expected_score,expected_count from dh_feat_unlocks where user_id=member.user_id;
    assert (board->>'score')::bigint=expected_score and (board->>'unlocked')::bigint=expected_count, 'Board/receipt mismatch';
    assert (summary->>'score')::bigint=expected_score and (summary->>'unlocked')::bigint=expected_count, 'Summary/receipt mismatch';
    assert (home->>'score')::bigint=expected_score and (home->>'unlocked')::bigint=expected_count, 'Home/receipt mismatch';
    assert board->'me'->>'user_id'=member.user_id::text, 'Caller identity mismatch';
    assert home->'club_rank'=board->'me'->'rank', 'Home/board rank mismatch';
    assert (board->>'members')::bigint=(select count(distinct user_id) from club_members where club_id=member.club_id and dh_public_member(user_id)), 'Public member count mismatch';
    assert (select count(*)=count(distinct e->>'user_id') from jsonb_array_elements(board->'leaders') e), 'Duplicate lifetime identity';
    assert (select count(*)=count(distinct e->>'user_id') from jsonb_array_elements(board->'monthly_leaders') e), 'Duplicate monthly identity';
    for entry in select value from jsonb_array_elements(board->'leaders') loop
      assert exists(select 1 from club_members where club_id=member.club_id and user_id=(entry->>'user_id')::uuid and dh_public_member(user_id)), 'Nonpublic lifetime entry';
      select coalesce(sum(points),0),count(*) into expected_score,expected_count from dh_feat_unlocks where user_id=(entry->>'user_id')::uuid;
      assert (entry->>'score')::bigint=expected_score and (entry->>'unlocked')::bigint=expected_count, 'Lifetime ledger mismatch';
      select 1+count(*) into expected_rank from (
        select c.user_id,coalesce(sum(u.points),0) score from (select distinct user_id from club_members where club_id=member.club_id and dh_public_member(user_id)) c
        left join dh_feat_unlocks u on u.user_id=c.user_id group by c.user_id
      ) ranked where score>expected_score;
      assert (entry->>'rank')::bigint=expected_rank, 'Lifetime shared-rank mismatch';
    end loop;
    for entry in select value from jsonb_array_elements(board->'monthly_leaders') loop
      assert exists(select 1 from club_members where club_id=member.club_id and user_id=(entry->>'user_id')::uuid and dh_public_member(user_id)), 'Nonpublic monthly entry';
      select coalesce(sum(points),0),count(*) into expected_score,expected_count from dh_feat_unlocks where user_id=(entry->>'user_id')::uuid
        and not historical and earned_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
      assert (entry->>'score')::bigint=expected_score and (entry->>'unlocked')::bigint=expected_count, 'Monthly ledger mismatch';
      select 1+count(*) into expected_rank from (
        select c.user_id,coalesce(sum(u.points),0) score from (select distinct user_id from club_members where club_id=member.club_id and dh_public_member(user_id)) c
        left join dh_feat_unlocks u on u.user_id=c.user_id and not u.historical
          and u.earned_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' group by c.user_id
      ) ranked where score>expected_score;
      assert (entry->>'rank')::bigint=expected_rank, 'Monthly shared-rank mismatch';
    end loop;
  end loop;
end $$;
select count(*) filter(where dh_public_member(id)) as public_accounts,
  (select count(*) from club_members where dh_public_member(user_id)) as checked_memberships,
  (select count(distinct club_id) from club_members where dh_public_member(user_id)) as checked_clubs,
  'passed' as receipt_summary_home_lifetime_monthly_identity_and_rank_checks from profiles;
commit;
