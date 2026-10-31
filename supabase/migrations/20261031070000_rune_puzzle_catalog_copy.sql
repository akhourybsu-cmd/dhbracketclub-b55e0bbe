-- Describe the new primary journey without changing installation settings.
begin;
update public.platform_assets
set short_description = 'A fantasy puzzle adventure of runes, gates and hidden treasure.',
    full_description = 'Explore 18 handcrafted chambers. Push colored runestones onto matching sigils, open pressure gates and guide stones across ice. Escape to unlock the next chamber, collect optional treasure and master all 54 stars. Free undo, restarts and hints help you experiment. Previous combat modes and progression remain in the Combat Archive.',
    updated_at = now()
where slug = 'rune-delve'
  and (short_description, full_description) is distinct from (
    'A fantasy puzzle adventure of runes, gates and hidden treasure.',
    'Explore 18 handcrafted chambers. Push colored runestones onto matching sigils, open pressure gates and guide stones across ice. Escape to unlock the next chamber, collect optional treasure and master all 54 stars. Free undo, restarts and hints help you experiment. Previous combat modes and progression remain in the Combat Archive.'
  );
commit;
