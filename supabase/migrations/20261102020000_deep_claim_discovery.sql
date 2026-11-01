-- Register Deep Claim in the existing global Asset Library. Club admins retain
-- the existing installation/visibility controls; this never installs the game
-- automatically and never grants or spends any DH Score or other currency.
begin;
insert into public.platform_assets(name,slug,category,short_description,full_description,icon_name,placement_area,
  requires_configuration,is_premium,default_configuration_json,sort_order)
values('Deep Claim','deep-claim','games','A Prospector''s Empire. Build a crew. Grow your claim.',
  'Deep Claim: A Prospector''s Empire is a persistent mining company game within DH Club. Manage three named workers, plan exploration and extraction expeditions, and return to a mine that keeps working while you are away. Reveal finite resource deposits, collect and sell your cargo, and improve four functional company buildings. Each account owns a private company within its club. Business cash, worker energy and inventory remain isolated game resources; Deep Claim never spends DH Score or replaces an existing club game.',
  'Gem','games',false,false,'{}'::jsonb,46)
on conflict(slug) do update set name=excluded.name,category=excluded.category,
  short_description=excluded.short_description,full_description=excluded.full_description,
  icon_name=excluded.icon_name,placement_area=excluded.placement_area,updated_at=now();
commit;
