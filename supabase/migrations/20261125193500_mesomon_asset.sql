-- Catalog registration only. Existing club admins retain installation,
-- enablement and visibility controls; no club receives an unsolicited install.
begin;

insert into public.platform_assets (
  name, slug, category, short_description, full_description, icon_name,
  placement_area, requires_configuration, is_premium,
  default_configuration_json, sort_order
)
values (
  'Mesomon', 'mesomon', 'games', 'A harbor in two voices.',
  'Return to Port Marche as Tavian Merrow in a standalone pixel-art story chapter. Explore a working harbor, investigate a missing mentor, earn a willing Mesomon companion''s trust and seal the first rift. Touch and keyboard controls, three personal save slots, local offline progress and authenticated cloud synchronization. This is an independent, non-canon story set in Mesoplasia during the Halcyon Age; it does not alter the Mesoplasia canon or any other DH game.',
  'Sparkles', 'games', false, false, '{}'::jsonb, 47
)
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  icon_name = excluded.icon_name,
  placement_area = excluded.placement_area,
  updated_at = now();

commit;
