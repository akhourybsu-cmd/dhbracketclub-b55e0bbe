// DH Club — Feature Onboarding Registry
//
// Single source of truth for "what does each feature teach the user".
// Keyed by feature slug (matches `PlatformAsset.slug`). Used by the
// onboarding framework to:
//   • drive the first-time club tour
//   • drive "What's New" prompts when assets are installed/enabled
//   • drive single-feature tutorials (admin preview, deep-link, etc.)
//
// Adding onboarding for a new feature: append an entry below. If you don't,
// callers fall back to `deriveFallbackOnboarding(asset)` which constructs
// a minimal one-step tutorial from the existing asset metadata, so the
// system never breaks on unknown features.
//
// Importance gates what surfaces a feature: `minor` features never trigger
// the New Feature prompt; `standard`+ do. Critical-tagged features can be
// pinned more prominently in the future.

import type { PlatformAsset } from '@/types/assets';

export type OnboardingImportance = 'minor' | 'standard' | 'important' | 'critical';
export type OnboardingType = 'club_intro' | 'new_feature' | 'feature_update';
export type OnboardingRole = 'admin' | 'member';

export interface OnboardingStep {
  /** Bold heading for this step. */
  title: string;
  /** Body copy — keep short, 1–2 sentences. */
  body: string;
  /** Lucide icon name — looked up at render time via a small map. */
  iconKey?: string;
}

export interface FeatureOnboarding {
  /** Slug — matches PlatformAsset.slug. */
  featureKey: string;
  /** Display name for headers / chips. */
  displayName: string;
  /** Short subtitle shown under the title (one line). */
  shortDescription: string;
  /** Category tag — drives accent + grouping. */
  featureType: 'core' | 'plugin' | 'game' | 'social' | 'admin' | 'utility';
  /** Importance gate. `minor` features never trigger prompts. */
  importance: OnboardingImportance;
  /**
   * Version. Bumping this re-triggers onboarding once for each user as a
   * `feature_update` event (only if the feature is also marked `standard`+).
   */
  version: number;
  /**
   * Roles allowed to see this onboarding. Omit = everyone. `'admin'` =
   * only club admins. `'member'` = only non-admin members.
   */
  requiredRole?: OnboardingRole;
  /** Header for the onboarding modal. */
  onboardingTitle: string;
  /** One-line summary shown below the title. */
  onboardingSummary: string;
  /** Steps — keep to 2–4 for mobile readability. */
  onboardingSteps: OnboardingStep[];
  /** Final CTA button on the completion screen. */
  primaryCta: { label: string; route: string };
  /** Optional iconKey for the feature header (defaults derived from category). */
  iconKey?: string;
  /** Free-form tags shown as small chips ("Multiplayer", "Daily", etc). */
  tags?: string[];
}

/* ─── Registry ─────────────────────────────────────────────────────── */

const REGISTRY: Record<string, FeatureOnboarding> = {
  'draft-arena': {
    featureKey: 'draft-arena',
    displayName: 'Draft Arena',
    shortDescription: 'Run live snake drafts with your crew.',
    featureType: 'game',
    importance: 'critical',
    version: 1,
    iconKey: 'Bookmark',
    tags: ['Live', 'Multiplayer', 'Seasons'],
    onboardingTitle: 'Welcome to Draft Arena',
    onboardingSummary: 'Run live drafts, build seasons, and crown a champion.',
    onboardingSteps: [
      { title: 'Live snake drafts', body: 'Members take turns picking on any topic — sports, music, debates, anything.', iconKey: 'Bookmark' },
      { title: 'Seasons & playoffs', body: 'String drafts into a season. Top finishers go to a Bo3 playoffs bracket.', iconKey: 'Trophy' },
      { title: 'Your turn pings', body: "Get a notification when you're on the clock. Resume drafts on any device.", iconKey: 'BellRing' },
    ],
    primaryCta: { label: 'Open Draft Arena', route: '/drafts' },
  },

  'rune-delve': {
    featureKey: 'rune-delve',
    displayName: 'Rune Delve',
    shortDescription: 'A fantasy puzzle adventure for your club.',
    featureType: 'game',
    importance: 'critical',
    version: 2,
    iconKey: 'Sparkles',
    tags: ['Puzzles', 'Mastery', 'Exploration'],
    onboardingTitle: 'Welcome to Rune Delve',
    onboardingSummary: 'Restore the runes. Find your way out.',
    onboardingSteps: [
      { title: 'Restore the chamber', body: 'Move your delver and push runestones onto matching sigils, then enter the restored portal.', iconKey: 'Sparkles' },
      { title: 'Read the room', body: 'Open pressure gates, slide stones across ice, and restore sigils to calm their guardians.', iconKey: 'DoorOpen' },
      { title: 'Master your route', body: 'Undo, restart and hints are free. Earn stars for escape, efficient pushes and treasure. Older modes remain in the Combat Archive.', iconKey: 'Trophy' },
    ],
    primaryCta: { label: 'Open Rune Delve', route: '/rune-delve' },
  },

  'nexus-defense': {
    featureKey: 'nexus-defense',
    displayName: 'Nexus Defense',
    shortDescription: 'Fortify a central nexus against enemies from every direction.',
    featureType: 'game',
    importance: 'critical',
    version: 3,
    iconKey: 'Shield',
    tags: ['Survival', 'Upgrades', 'Endless'],
    onboardingTitle: 'Welcome to Nexus Defense',
    onboardingSummary: 'Equip your core. Survive endless waves. Build a stronger next run.',
    onboardingSteps: [
      { title: 'Equip your core', body: 'Choose weapons and a support module before launch. Each loadout must fit its power budget.', iconKey: 'Shield' },
      { title: 'Outlast the swarm', body: 'Enemies approach from every direction. Spend run energy on attack, defense and utility, then push for your next wave milestone.', iconKey: 'Sparkles' },
      { title: 'Grow your arsenal', body: 'Earn research credits from completed assaults. Unlock weapons and permanent upgrades, then take on higher endless difficulties.', iconKey: 'Zap' },
    ],
    primaryCta: { label: 'Open Nexus Defense', route: '/nexus' },
  },

  'nfl-pickem': {
    featureKey: 'nfl-pickem',
    displayName: 'NFL Game Center',
    shortDescription: 'Scores, weekly Pick’em, and Crazy Chain.',
    featureType: 'game',
    importance: 'important',
    version: 1,
    iconKey: 'Trophy',
    tags: ['Weekly', 'Sports'],
    onboardingTitle: 'Welcome to NFL Game Center',
    onboardingSummary: 'Follow the slate, pick every game, and build a season-long Crazy Chain.',
    onboardingSteps: [
      { title: 'Pick before kickoff', body: 'Every game locks at kickoff. Late picks default to no-selection.', iconKey: 'Clock' },
      { title: 'Score moves season-long', body: 'Correct picks score. Wrong picks hurt. The leaderboard updates live.', iconKey: 'TrendingUp' },
      { title: 'Build a Crazy Chain', body: 'Choose as many weekly predictions as you want. Hit every leg to add them all; one miss resets the run.', iconKey: 'Link2' },
      { title: 'See the sharpest in your club', body: 'Pick’em and Crazy Chain leaderboards track two different kinds of NFL mastery.', iconKey: 'Trophy' },
    ],
    primaryCta: { label: 'Open NFL Game Center', route: '/nfl' },
  },

  'brackets': {
    featureKey: 'brackets',
    displayName: 'Brackets',
    shortDescription: 'Create and run tournament brackets.',
    featureType: 'utility',
    importance: 'important',
    version: 1,
    iconKey: 'Trophy',
    tags: ['Tournament', 'Voting'],
    onboardingTitle: 'Welcome to Brackets',
    onboardingSummary: 'Build single or double-elimination brackets your club can fill out.',
    onboardingSteps: [
      { title: 'Anything you can rank', body: 'Sports, music, hot takes, holiday movies — set up entries and seed them.', iconKey: 'Trophy' },
      { title: 'Lock time matters', body: 'Members submit their brackets before lock. Late entries are ignored.', iconKey: 'Lock' },
      { title: 'Live standings', body: 'As rounds resolve, the leaderboard updates so members can see who picked best.', iconKey: 'TrendingUp' },
    ],
    primaryCta: { label: 'Open Brackets', route: '/brackets' },
  },

  'portfolio-wars': {
    featureKey: 'portfolio-wars',
    displayName: 'Portfolio Wars',
    shortDescription: 'Build a virtual portfolio across quarterly seasons.',
    featureType: 'game',
    importance: 'standard',
    version: 2,
    iconKey: 'TrendingUp',
    tags: ['Trading', 'Seasons', 'Finance'],
    onboardingTitle: 'Welcome to Portfolio Wars',
    onboardingSummary: 'Trade stocks, manage your holdings, and climb your club’s quarterly standings.',
    onboardingSteps: [
      { title: 'Build your portfolio', body: 'Start each season with your club’s virtual cash balance. Use the trade desk to buy and sell stocks as market prices move.', iconKey: 'TrendingUp' },
      { title: 'Plan your next trade', body: 'Follow symbols in watchlists and stock details. Place market or target-price orders and review their status in Orders.', iconKey: 'Clock' },
      { title: 'Follow your returns', body: 'Track your portfolio value, club activity and season history. Standings rank your club by total portfolio value.', iconKey: 'Trophy' },
    ],
    primaryCta: { label: 'Open Portfolio Wars', route: '/portfolio-wars' },
  },

  'lockbox': {
    featureKey: 'lockbox',
    displayName: 'Lockbox',
    shortDescription: 'Your single most confident daily pick.',
    featureType: 'game',
    importance: 'standard',
    version: 1,
    iconKey: 'Lock',
    tags: ['Daily', 'Sports'],
    onboardingTitle: 'Welcome to Lockbox',
    onboardingSummary: 'One lock a day. A clear yes/no outcome. Accuracy tracked over time.',
    onboardingSteps: [
      { title: 'One pick a day', body: 'Your single most confident prediction — a game, a hot take, anything yes/no.', iconKey: 'Lock' },
      { title: 'Accuracy beats volume', body: 'Hit rate is what scores. Skip a day rather than throw away a bad lock.', iconKey: 'Trophy' },
    ],
    primaryCta: { label: 'Open Lockbox', route: '/lockbox' },
  },

  'chat': {
    featureKey: 'chat',
    displayName: 'Club Chat',
    shortDescription: 'Real-time channel-based messaging.',
    featureType: 'social',
    importance: 'important',
    version: 1,
    iconKey: 'MessageSquareText',
    tags: ['Realtime', 'Channels'],
    onboardingTitle: 'Your club has chat',
    onboardingSummary: 'Channel-based messaging, threads, reactions, and typing indicators.',
    onboardingSteps: [
      { title: 'Channels per topic', body: 'Spin up channels for games, off-topic, planning — whatever your club needs.', iconKey: 'MessageSquareText' },
      { title: 'Threads, reacts, mentions', body: 'Standard chat affordances. Mentions ping the person directly.', iconKey: 'AtSign' },
    ],
    primaryCta: { label: 'Open Chat', route: '/chat' },
  },

  'events': {
    featureKey: 'events',
    displayName: 'Events',
    shortDescription: 'Club event calendar with RSVPs.',
    featureType: 'social',
    importance: 'standard',
    version: 1,
    iconKey: 'CalendarDays',
    tags: ['Calendar', 'RSVP'],
    onboardingTitle: 'Your club has events',
    onboardingSummary: 'Game nights, watch parties, IRL meetups — all in one place with RSVPs.',
    onboardingSteps: [
      { title: 'See what\'s coming up', body: 'A scrollable calendar of upcoming club events with date, time, and location.', iconKey: 'CalendarDays' },
      { title: 'RSVP', body: 'Mark attending, maybe, or skip. Hosts see the count in real time.', iconKey: 'Check' },
    ],
    primaryCta: { label: 'Open Events', route: '/events' },
  },

  'feed': {
    featureKey: 'feed',
    displayName: 'Feed',
    shortDescription: 'Scrollable club activity stream.',
    featureType: 'social',
    importance: 'standard',
    version: 1,
    iconKey: 'Newspaper',
    onboardingTitle: 'Your club has a feed',
    onboardingSummary: 'A scrollable timeline of club activity — picks, wins, posts, events.',
    onboardingSteps: [
      { title: 'See everything at a glance', body: 'Draft completions, brackets locked in, new events — the feed has it all.', iconKey: 'Newspaper' },
    ],
    primaryCta: { label: 'Open Feed', route: '/feed' },
  },

  'polls': {
    featureKey: 'polls',
    displayName: 'Polls',
    shortDescription: 'Quick club polls on anything.',
    featureType: 'social',
    importance: 'standard',
    version: 1,
    iconKey: 'MessageCircle',
    onboardingTitle: 'Your club has polls',
    onboardingSummary: 'Settle debates, plan hangouts, take quick reads on what the club thinks.',
    onboardingSteps: [
      { title: 'Spin one up in seconds', body: 'Title, 2+ options, optional close time. Results visible after voting.', iconKey: 'MessageCircle' },
    ],
    primaryCta: { label: 'Open Polls', route: '/polls' },
  },

  'rankings': {
    featureKey: 'rankings',
    displayName: 'Rankings',
    shortDescription: 'Power rankings and topic lists for club debates.',
    featureType: 'utility',
    importance: 'standard',
    version: 2,
    iconKey: 'BarChart3',
    onboardingTitle: 'Your club has rankings',
    onboardingSummary: 'Create a topic, rank the entries, and compare the club’s takes.',
    onboardingSteps: [
      { title: 'Make a list', body: 'Choose a topic and entries for your club to rank.', iconKey: 'BarChart3' },
      { title: 'Submit your order', body: 'Arrange the entries in your preferred order, then submit while the ranking is open.', iconKey: 'Check' },
      { title: 'Compare the results', body: 'See participation and the club’s average order for the same entries.', iconKey: 'Users' },
    ],
    primaryCta: { label: 'Open Rankings', route: '/rankings' },
  },

  'daily-find': {
    featureKey: 'daily-find',
    displayName: 'The Drop',
    shortDescription: 'Thoughts, links, photos and videos from your club.',
    featureType: 'social',
    importance: 'minor',
    version: 2,
    iconKey: 'Sparkles',
    tags: ['Sharing', 'Photos', 'Video'],
    onboardingTitle: 'Welcome to The Drop',
    onboardingSummary: 'Share the good stuff with your club.',
    onboardingSteps: [
      { title: 'Make a Drop', body: 'Post a thought, link or photo. Paste a link into the composer without writing a separate headline.', iconKey: 'Sparkles' },
      { title: 'Keep it going', body: 'Like, reply and share to Chat from the feed. Search past posts or browse the archive by day.', iconKey: 'MessageSquareText' },
      { title: 'Watch inline', body: 'Tap a video to play in the feed. Opening another player or a sharing sheet stops the current one.', iconKey: 'Play' },
    ],
    primaryCta: { label: 'Open The Drop', route: '/finds' },
  },

  'lore': {
    featureKey: 'lore',
    displayName: 'Club Lore',
    shortDescription: 'Club history, rivalries, running jokes.',
    featureType: 'social',
    importance: 'minor',
    version: 1,
    iconKey: 'ScrollText',
    onboardingTitle: 'Your club has lore',
    onboardingSummary: 'A living document of your club\'s greatest moments and inside jokes.',
    onboardingSteps: [
      { title: 'Write your history', body: 'Admins write entries; members read and relive the lore.', iconKey: 'ScrollText' },
    ],
    primaryCta: { label: 'Open Lore', route: '/lore' },
  },

  'posts': {
    featureKey: 'posts',
    displayName: 'Discussions',
    shortDescription: 'Club discussions, recaps and announcements.',
    featureType: 'social',
    importance: 'standard',
    version: 2,
    iconKey: 'FileText',
    onboardingTitle: 'Your club has discussions',
    onboardingSummary: 'Start a conversation and keep the club’s replies together.',
    onboardingSteps: [
      { title: 'Start a discussion', body: 'Add a title and message for your club. Open any discussion to read and add replies.', iconKey: 'FileText' },
      { title: 'Keep key posts visible', body: 'Pinned discussions stay at the top so announcements are easy to find.', iconKey: 'Pin' },
    ],
    primaryCta: { label: 'Open Discussions', route: '/posts' },
  },

  'shared-media': {
    featureKey: 'shared-media',
    displayName: 'Shared Media',
    shortDescription: 'Links and media shared in club Chat.',
    featureType: 'social',
    importance: 'minor',
    version: 2,
    iconKey: 'Link2',
    onboardingTitle: 'Your club has shared media',
    onboardingSummary: 'Find the links, images and clips from your club’s conversations.',
    onboardingSteps: [
      { title: 'Browse the collection', body: 'Shared Media collects links and previews from Chat. Filter by media type or channel to find a source again.', iconKey: 'Link2' },
    ],
    primaryCta: { label: 'Open Shared Media', route: '/shared' },
  },

  'birthdays-milestones': {
    featureKey: 'birthdays-milestones',
    displayName: 'Celebrations',
    shortDescription: 'Birthdays and milestones for your club.',
    featureType: 'social',
    importance: 'standard',
    version: 1,
    iconKey: 'PartyPopper',
    tags: ['Birthdays', 'Milestones', 'Reminders'],
    onboardingTitle: 'Celebrations are on',
    onboardingSummary: 'Track birthdays and club milestones so your group never misses a moment.',
    onboardingSteps: [
      {
        title: 'Add your birthday',
        body: 'Year is optional and stays private unless you opt in. You can also hide your birthday or share it with admins only.',
        iconKey: 'Cake',
      },
      {
        title: 'See what\'s coming up',
        body: 'Today\'s celebrations and the next few upcoming ones appear right on Home.',
        iconKey: 'CalendarHeart',
      },
      {
        title: 'Toast and wish',
        body: 'On a celebration day, tap to post a quick message to your club.',
        iconKey: 'PartyPopper',
      },
    ],
    primaryCta: { label: 'Open Celebrations', route: '/celebrations' },
  },

  'readshift': {
    featureKey: 'readshift',
    displayName: 'READSHIFT',
    shortDescription: 'Async social deduction — read the room, shift your voice.',
    featureType: 'game',
    importance: 'important',
    version: 1,
    iconKey: 'VenetianMask',
    tags: ['Async', 'Multiplayer', 'Deduction'],
    onboardingTitle: 'Welcome to READSHIFT',
    onboardingSummary: 'Answer a prompt in a secret style, then read who wrote what. Play at your own pace across a few rounds.',
    onboardingSteps: [
      { title: 'Shift your voice', body: 'Each round you get a secret Signal — Tell (be yourself), Blur (be unreadable), or Frame (write like a specific player). Answer the prompt to match it.', iconKey: 'VenetianMask' },
      { title: 'Read the room', body: 'Everyone\'s answers appear anonymously. Guess who wrote each one — mark your most confident call as a Strong Read for bonus points.', iconKey: 'Eye' },
      { title: 'Reveal & score', body: 'Authors, Signals, and guesses are revealed together. Points come from good reads and from nailing your Signal. React and roast in the recap.', iconKey: 'Sparkles' },
    ],
    primaryCta: { label: 'Open READSHIFT', route: '/readshift' },
  },

  'narrative-rpg': {
    featureKey: 'narrative-rpg',
    displayName: 'Narrative RPG',
    shortDescription: 'Run cinematic text-based RPG campaigns with Game Master tools.',
    featureType: 'social',
    importance: 'important',
    version: 1,
    iconKey: 'ScrollText',
    tags: ['RPG', 'Storytelling', 'Game Master', 'Campaigns'],
    onboardingTitle: 'Narrative RPG is live',
    onboardingSummary: 'Propose a campaign, get club-owner approval, then play out cinematic story scenes with dice rolls, clues, and a living campaign log.',
    onboardingSteps: [
      {
        title: 'Propose a campaign',
        body: 'Any member can pitch a campaign — pick a template (Blank or The Flamingo Protocol), set the tone, and submit for club-owner approval.',
        iconKey: 'ScrollText',
      },
      {
        title: 'Play through Story Chat',
        body: 'Approved campaigns open into a premium story chat: narration, NPC dialogue, dice rolls, scene cards, and clues all live in one feed.',
        iconKey: 'MessageSquareText',
      },
      {
        title: 'Game Masters get a full console',
        body: 'GMs run scenes, manage clues + factions + clocks, and review AI suggestions — nothing changes the campaign until the GM approves it.',
        iconKey: 'Sparkles',
      },
    ],
    primaryCta: { label: 'Open Narrative RPG', route: '/narrative' },
  },

  'splendid-journey': {
    featureKey: 'splendid-journey',
    displayName: 'The Splendid Journey',
    shortDescription: 'A handcrafted choice-driven RPG set in the world of Mesoplasia.',
    featureType: 'game',
    importance: 'important',
    version: 1,
    iconKey: 'ScrollText',
    tags: ['RPG', 'Story', 'Single player', 'Choices'],
    onboardingTitle: 'The Splendid Journey awaits',
    onboardingSummary: 'A written adventure of unimaginable consequence. Read, choose, and live with what follows — every path is authored by hand.',
    onboardingSteps: [
      {
        title: 'Take up a hero',
        body: 'Name your traveller and step into Mesoplasia. Your stats, bonds, and reputation are yours alone — each journey is a separate save.',
        iconKey: 'ScrollText',
      },
      {
        title: 'Choices carry weight',
        body: 'Scenes end in decisions. Some paths stay locked until you have the right item, skill, or ally — and majors ones are marked before you commit.',
        iconKey: 'Sparkles',
      },
      {
        title: 'Keep the record',
        body: 'Your Journal tracks quests and every decision made; the Codex fills in only with the lore, places, and people you actually discover.',
        iconKey: 'BookOpen',
      },
    ],
    primaryCta: { label: 'Begin the Journey', route: '/journey' },
  },

  'workout-competition': {
    featureKey: 'workout-competition',
    displayName: 'FORGE',
    shortDescription: 'A weekly at-home fitness gauntlet you play by exercising.',
    featureType: 'game',
    importance: 'important',
    version: 1,
    iconKey: 'Flame',
    tags: ['Fitness', 'Weekly', 'Competition', 'Leaderboard'],
    onboardingTitle: 'FORGE is live',
    onboardingSummary: 'Every Monday a fresh gauntlet drops. Log push-ups, planks and runs in seconds, climb the leaderboard, and forge streaks, records and badges that never reset.',
    onboardingSteps: [
      { title: 'Log in seconds', body: 'Each workout hands you the right tool — a tap counter for push-ups, a persistent timer for planks, a round tracker for circuits. No forms.', iconKey: 'Timer' },
      { title: 'A new gauntlet every Monday', body: 'Competitions run Monday to Monday. Your activity earns points toward the weekly leaderboard before the clock runs out.', iconKey: 'Flame' },
      { title: 'Forge lasting progress', body: 'Weekly score resets, but XP, records, streaks and badges keep building the whole time you play.', iconKey: 'TrendingUp' },
    ],
    primaryCta: { label: 'Enter FORGE', route: '/workouts' },
  },
};

/* ─── Selectors ─────────────────────────────────────────────────────── */

export function getOnboarding(featureKey: string): FeatureOnboarding | undefined {
  return REGISTRY[featureKey];
}

/**
 * Best-effort fallback when a PlatformAsset has no registered onboarding.
 * Builds a single-step tutorial from the asset's own metadata so the system
 * never has to display nothing — but signals 'minor' importance so it
 * won't trigger New Feature prompts on its own.
 */
export function deriveFallbackOnboarding(asset: PlatformAsset, route?: string): FeatureOnboarding {
  return {
    featureKey: asset.slug,
    displayName: asset.name,
    shortDescription: asset.short_description,
    featureType: 'plugin',
    importance: 'minor',
    version: 1,
    onboardingTitle: `Welcome to ${asset.name}`,
    onboardingSummary: asset.short_description,
    onboardingSteps: [
      { title: asset.name, body: asset.full_description || asset.short_description, iconKey: asset.icon_name },
    ],
    primaryCta: { label: `Open ${asset.name}`, route: route ?? '/' },
    iconKey: asset.icon_name,
  };
}

/**
 * Resolve onboarding for any asset — registered entry if present, otherwise
 * the fallback. Pass an optional `route` for the fallback's primary CTA.
 */
export function resolveOnboarding(asset: PlatformAsset, route?: string): FeatureOnboarding {
  return getOnboarding(asset.slug) ?? deriveFallbackOnboarding(asset, route);
}

/** Importance gate — only features at or above this level trigger prompts. */
export function isPromptable(o: FeatureOnboarding): boolean {
  return o.importance !== 'minor';
}

/** Filter helper — drops features the role can't access. */
export function isVisibleToRole(o: FeatureOnboarding, isAdmin: boolean): boolean {
  if (!o.requiredRole) return true;
  if (o.requiredRole === 'admin') return isAdmin;
  if (o.requiredRole === 'member') return !isAdmin;
  return true;
}
