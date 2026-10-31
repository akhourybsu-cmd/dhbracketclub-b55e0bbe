-- Keep public feature descriptions aligned with the shipped screens.
-- Installation flags, club configuration and player data are untouched.
begin;
with current_copy(slug,name,short_description,full_description) as (values
  ('daily-find','The Drop','Thoughts, links, photos and videos from your club.',
   'Share a thought, link or photo in the club feed. Like, reply, share to Chat, play videos inline, and find past Drops through search or the day archive.'),
  ('portfolio-wars','Portfolio Wars','Build a virtual portfolio across quarterly seasons.',
   'Trade stocks using your club’s virtual cash balance. Follow symbols in watchlists, place market or target-price orders, and track holdings and season history. Club standings rank total portfolio value.'),
  ('rankings','Rankings','Power rankings and topic lists for club debates.',
   'Create a topic and entries, arrange your preferred order, and compare participation and the club’s average ranking.'),
  ('posts','Discussions','Club discussions, recaps and announcements.',
   'Start a conversation with a title and message, read the club’s replies, and keep key announcements visible with pinned discussions.'),
  ('shared-media','Shared Media','Links and media shared in club Chat.',
   'Browse links, images and previews collected from club Chat. Filter by media type or channel to find a source again.')
)
update public.platform_assets asset
set name=current_copy.name,
    short_description=current_copy.short_description,
    full_description=current_copy.full_description,
    updated_at=now()
from current_copy
where asset.slug=current_copy.slug
  and (asset.name,asset.short_description,asset.full_description) is distinct from
      (current_copy.name,current_copy.short_description,current_copy.full_description);
commit;
