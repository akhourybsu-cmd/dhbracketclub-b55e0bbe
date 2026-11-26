import type { NarrativeVariant } from '../types';
import { bramGateReport, DIALOGUES, say } from './dialogue';

const line = (speaker: string, ...text: string[]): NarrativeVariant => ({ lines: say(speaker, ...text) });
const after = (fact: string, speaker: string, ...text: string[]): NarrativeVariant => ({
  when: { all: [fact] }, lines: say(speaker, ...text),
});

export const REMARKS: Record<string, NarrativeVariant[]> = {
  'nia-repeat': [line('Nia', 'Northwest, past the market. I kept the spare key.')],
  'workshop-nia': [
    after('clues_complete', 'Nia', 'I know a short way. Meet me at Bram’s barrier on the eastern quay.'),
    { when: { all: ['clue_map', 'clue_hook'] }, lines: say('Nia', 'We know where she went and what she took. What’s on the chart?') },
    after('clue_map', 'Nia', 'The map gives us a place. I’d like to know what she carried down there.'),
    line('Nia', 'Start with the chart, map and satchel hook. Leave the tools where she likes them.'),
  ],
  'bram-early': [
    after('visited:bram', 'Bram', 'Still closed. Edda may have left her route in the workshop.'),
    line('Bram', 'Barrier stays shut while I check the inlet. Looking for Edda? Try her workshop.'),
  ],
  bram: [{
    when: { all: ['visited:bram'] },
    lines: [
      ...say('Bram', 'There you are again. What did the workshop turn up?'),
      ...say('Tavian', 'She marked these stairs. Did you see her come back?'),
      ...bramGateReport,
    ],
  }],
  'bram-repeat': [
    after('rift_sealed', 'Bram', 'Marked the waterline with chalk. Ten minutes now and it hasn’t jumped once.'),
    after('gate_opened', 'Bram', 'I heard the gate lift. That little scrabbling noise has stopped. Thank you.'),
    line('Bram', 'Through here, down the stairs. Keep one hand on the rail.'),
  ],
  'chart-repeat': [line('Tavian', 'The pinholes keep time right across the turn of the tide.')],
  'field-map-repeat': [line('Tavian', 'She circled the eastern tide stairs. The pencil line continues under the wharf.')],
  'satchel-hook-repeat': [line('Tavian', 'She packed the long case. Those two dents in the wall are where the buckles sat.')],
  'sense-eddy-repeat': [
    after('sluice_open', 'Tavian', 'Only a trickle through the seam now. The crossing’s dry.'),
    line('Tavian', 'Same pull through the wall. The sluice controls this channel.'),
  ],
  'sense-channel-repeat': [
    after('rift_sealed', 'Tavian', 'Foam’s coming down over the lip again.'),
    line('Tavian', 'Still running up toward the chamber.'),
  ],
  'tressel-retry': [line('Port Marche', 'Tressel has dragged the nest another plank uphill. Its tail snaps tight as footsteps approach.')],
  'boss-retry': [line('Tavian', 'Still hanging on. Watch the hand on the stone before it strikes.')],
  'page-repeat': [
    after('chapter_complete', 'Tavian', 'Here’s the crease her paper made in the wax. I could have walked right past it.'),
    line('Tavian', 'The page is safe inside my coat. Back to Edda’s workshop.'),
  ],
  'closing-after': [
    { when: { tone: 'warm' }, lines: [...say('Nia', 'I missed you too. Give me the map after supper.'), ...DIALOGUES['closing-after']] },
    { when: { tone: 'wry' }, lines: [...say('Nia', 'Two rolls, then. Knock hard. I sleep over the smithy.'), ...DIALOGUES['closing-after']] },
    { when: { tone: 'direct' }, lines: [...say('Nia', 'First cart comes through at six. I’ll bring my boots.'), ...DIALOGUES['closing-after']] },
  ],
  'closing-repeat': [line('Nia', 'I kept the chair beside me. There’s more in the pot if you’re hungry.')],
  'fisher-early': [
    after('visited:fisher', 'Fisher', 'I’ve got water over its gills. It starts kicking every time I touch that knot.'),
    line('Fisher', 'A Muddren this far off the mud flats! Got a foot through my net. Hold still, love.'),
  ],
  'fisher-repeat': [line('Fisher', 'See that trail along the bank? All four feet working. I counted.')],
  'pell-pending': [line('Pell', 'The reeds just below the market. If you put a foot in the mud, hang on to your boot.')],
  'pell-repeat': [
    after('whistle_imitation', 'Pell', 'I’m keeping the squeaky note. It’s part of the tune now.'),
    line('Pell', 'I put a string on it. Want to hear? Oh, you’ve heard.'),
  ],
  'seli-gift': [
    after('rift_sealed', 'Seli', 'Tavian! Take a tincture for the road.', 'Had midges for company all morning. They’ve gone back to the water now.'),
    line('Seli', 'Tavian! There’s a face I used to have to wash.', 'Put this tincture in your bag. See those midges on the lid? Haven’t seen one touch the water all day.'),
  ],
  'seli-rest': [line('Seli', 'Sit your friends down in the shade. There’s clean water in the blue bowl.', 'There. Breathing easy again.')],
  'seli-repeat': [line('Seli', 'Edda bought oil here yesterday. Paid for the whole bottle in little ferry coins.')],
  'ship-rail': [
    after('visited:ship-rail', 'Tavian', 'There’s Nia’s crane. I used to climb high enough to see over the sea wall.'),
    line('Tavian', 'Our wake stops at the channel stakes. Beyond them a gull is standing ankle-deep.'),
  ],
  dockworker: [
    after('rift_sealed', 'Dock worker', 'Look along the hull. One wet stripe, straight as a string. I can load her now.'),
    after('visited:dockworker', 'Dock worker', 'Watch the tar line on the hull. When it dips, the rope should slacken. Watch.'),
    line('Dock worker', 'I let out rope for the flood tide. Had to haul it in again before I’d put my gloves down.'),
  ],
  'bell-worker': [
    after('rift_sealed', 'Crane rigger', 'Quiet under there now. Glad of it. I need to hear the lift bell.'),
    after('visited:bell-worker', 'Crane rigger', 'A dropped hook rings once. This went on ringing while I counted to eight.'),
    line('Crane rigger', 'Someone rang for a lift from under the pier. Took my pole down. There’s no bell there.'),
  ],
  'lamp-keeper': [
    after('rift_sealed', 'Lamp keeper', 'Look at the soot. Little wing marks all through it again.'),
    after('visited:lamp-keeper', 'Lamp keeper', 'That wick usually needs picking clean twice a night. Haven’t touched it today.'),
    line('Lamp keeper', 'I polish one side of the lamp and leave the moths the other. Today they’ve left me both.'),
  ],
  merchant: [
    after('visited:merchant', 'Merchant', 'Hold that corner a second? Thanks. These awnings shrink every time they dry.'),
    line('Merchant', 'First barge brought onions. Second’s got my sacks. If you see a rolling onion, do me a kindness.'),
  ],
  'rope-worker': [
    {
      when: { all: ['visited:harbor-crane'], none: ['visited:rope-worker'] },
      lines: [
        ...say('Tavian', 'Nia’s crane tag says somebody took a bearing for a pie weight.'),
        ...say('Rope maker', 'Did the job, too. Tell her it’s cooling on my sill. Apple, if she wants a slice.'),
      ],
    },
    after('visited:rope-worker', 'Rope maker', 'That short length is for Nia. She can splice two ends in a space I can barely get my hand into.'),
    line('Rope maker', 'Feel the twist in that one. Came in from the Isles of Dawn. Left-handed, like my gran used to lay it.'),
  ],
  'harbor-sign': [line('Harbor board', 'North to the market. Northwest to Venn’s workshop.', 'Old tide stairs on the east quay. Arrival pier to the south.')],
  'inland-gate': [
    after('page_found', 'Road keeper', 'First cart out is the flour cart. The driver sleeps over the stables till morning.'),
    line('Road keeper', 'Causeway closed for inspection. They’re sounding under the stones one by one.'),
  ],
  'harbor-crane': [line('Nia’s repair tag', 'New bearing fitted. Whoever took the old one for a pie weight, please wash it. — Nia')],
  'departure-pier': [
    after('page_found', 'Tavian', 'My bag can stay ashore. Edda went out by road.'),
    line('Tavian', 'Salt-stiff rope. A little of it stayed in my hands for weeks after I first left.'),
  ],
  'workshop-note': [
    after('clues_complete', 'Edda’s note', 'The second voice is not echo. Echo follows. This one waits.'),
    line('Edda’s note', 'Recheck at slack water. Bring a dry pencil this time.'),
  ],
  kettle: [
    after('page_found', 'Tavian', 'Warm handle. Nia’s been in.'),
    line('Tavian', 'Dry inside. She always left me enough water for a second cup.'),
  ],
  'tide-lattice': [
    after('gate_opened', 'Tavian', 'Blue fur on the bars. The gap underneath is clear.'),
    line('Port Marche', 'A paw comes through the bars, feeling for a foothold. The water falls away beneath it.'),
  ],
  'nia-stairs': [
    after('rift_sealed', 'Nia', 'Water’s holding. I’ll go up to the workshop once you’re clear.'),
    after('rillik_bonded', 'Nia', 'I’ve tied off the bad board. Keep to the wall on your way back.'),
    after('gate_opened', 'Nia', 'Something’s back on the lower walkway. Move slowly.'),
    line('Nia', 'Bring the timber here. I can take the weight while you turn the wheel.'),
  ],
  'maintenance-plaque': [line('Maintenance marks', 'Lift counterweight before lowering handle. Keep crossing clear while draining.')],
  'chamber-markings': [
    after('rift_sealed', 'Tavian', 'Water’s down to the old survey mark. I can see the date under it.'),
    line('Tavian', 'Three cuts in the stone. The bottom one is crooked. That was my first survey with Edda.'),
  ],
};
