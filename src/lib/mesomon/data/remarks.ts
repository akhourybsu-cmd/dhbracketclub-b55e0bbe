import type { NarrativeVariant } from '../types';
import { bramGateReport, closingEvidence, closingSupper, DIALOGUES, say } from './dialogue';

const line = (speaker: string, ...text: string[]): NarrativeVariant => ({ lines: say(speaker, ...text) });
const after = (fact: string, speaker: string, ...text: string[]): NarrativeVariant => ({
  when: { all: [fact] }, lines: say(speaker, ...text),
});

export const REMARKS: Record<string, NarrativeVariant[]> = {
  'nia-repeat': [line('Nia', 'Past the market, on the left. I’ve got her spare key.')],
  'workshop-nia': [
    after('clues_complete', 'Nia', 'I’ll meet you at the barrier. East quay, where Bram keeps his pumps.'),
    { when: { all: ['clue_map', 'clue_hook'] }, lines: say('Nia', 'East stairs, and she took the case. Can you make out the chart?') },
    { when: { all: ['clue_chart', 'clue_hook'] }, lines: say('Nia', 'Have a look at the map. She usually pencils in where she took a reading.') },
    { when: { all: ['clue_chart', 'clue_map'] }, lines: say('Nia', 'There’s a hook by the door. Do you remember what she hung there?') },
    after('clue_hook', 'Nia', 'That’s a heavy case for a quick reading. Where was she taking it?'),
    after('clue_map', 'Nia', 'So she went to the stairs. I’d like to know what she took with her.'),
    after('clue_chart', 'Nia', 'I can see those pinholes now. Where did she make the readings?'),
    line('Nia', 'You know her things better than I do. Start with whatever looks out of place.'),
  ],
  'bram-early': [
    { when: { all: ['clue_map'] }, lines: [
      ...say('Tavian', 'Edda circled these stairs on her map.'),
      ...say('Bram', 'Keep that map handy. I’ll need a minute. I’m counting the men below.'),
    ] },
    after('visited:bram', 'Bram', 'Two more men on the pumps. Let me get them up first.'),
    { lines: [...say('Bram', 'Behind the chain, please. I’ve got men on the pumps.'), ...say('Tavian', 'Have you seen Edda today?'), ...say('Bram', 'Today? No. Try her workshop while I get these stairs clear.')] },
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
    after('rift_sealed', 'Bram', 'There’s my chalk mark. First time today I’ve had to look down to see it.'),
    { when: { all: ['heard:edda-lamp-oil'] }, once: 'bram-lamp',
      lines: [...say('Tavian', 'Seli sold Edda a bottle of lamp oil. Was her lamp lit when she passed you?'),
        ...say('Bram', 'No. She waited till the first dark step. I remember the match.')] },
    after('gate_opened', 'Bram', 'I heard the gate lift. That little scrabbling noise has stopped. Thank you.'),
    line('Bram', 'Through here, down the stairs. Keep one hand on the rail.'),
  ],
  chart: [{
    when: { all: ['visited:bell-worker'] },
    lines: [
      ...say('Tavian', 'The long curve’s the tide. Each pinhole marks a sound under the quay.'),
      ...say('Nia', 'Like a bell?'),
      ...say('Tavian', 'That’s what the rigger heard. Look how evenly she spaced these.'),
    ],
  }],
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
  'tressel-retry': [line('Port Marche', 'Tressel has one foot on the wet splinters. It draws them in as Tavian comes closer.')],
  'boss-retry': [line('Tavian', 'Still hanging on. Watch the hand on the stone before it strikes.')],
  'page-repeat': [
    after('chapter_complete', 'Tavian', 'Here’s the crease her paper made in the wax. I could have walked right past it.'),
    line('Tavian', 'The page is safe inside my coat. Back to Edda’s workshop.'),
  ],
  closing: [{
    when: { all: ['heard:flour-carter'] },
    lines: [
      ...closingEvidence,
      ...say('Tavian', 'The road keeper said to ask the flour carter.'),
      ...say('Nia', 'I know him. We can catch him loading up in the morning.'),
      ...closingSupper,
    ],
  }],
  'closing-after': [
    { when: { tone: 'warm' }, lines: [...say('Nia', 'I missed you too. Give me the map after supper.'), ...DIALOGUES['closing-after']] },
    { when: { tone: 'wry' }, lines: [...say('Nia', 'Two rolls, then. Knock hard. I sleep over the smithy.'), ...DIALOGUES['closing-after']] },
    { when: { tone: 'direct' }, lines: [...say('Nia', 'First cart comes through at six. I’ll bring my boots.'), ...DIALOGUES['closing-after']] },
  ],
  'closing-repeat': [line('Nia', 'I kept the chair beside me. There’s more in the pot if you’re hungry.')],
  'fisher-early': [
    after('visited:fisher', 'Fisher', 'See that loop round the ankle? I’ve cut two meshes already. Still tight.'),
    line('Fisher', 'A Muddren in a shrimp net. That’s a first.', 'Easy, love. I can buy another net.'),
  ],
  'fisher-repeat': [line('Fisher', 'Four little tracks through the mud. Put its weight on every foot.')],
  'pell-pending': [line('Pell', 'Just below the market. I hung on to the reeds and dropped the whistle. Should’ve done it the other way round.')],
  'pell-repeat': [
    after('whistle_imitation', 'Pell', 'I’m keeping the squeak. Makes it our tune.'),
    line('Pell', 'Look. String through the hole, string round my wrist. Go on, give it a tug.'),
  ],
  'seli-gift': [
    { when: { all: ['whistle_returned'] }, once: 'seli-whistle',
      lines: say('Seli', 'Tav! I heard that whistle from here. Pell says you fished it out.', 'Here. Another tincture for your bag.') },
    after('rift_sealed', 'Seli', 'Tav! Come here and let me look at you. You used to fit under this counter.', 'Here’s a tincture. Bring me the empty jar when you’ve done.'),
    line('Seli', 'Tav! I’ve still got a jar with your name scratched into the lid.', 'Here, take it. Fresh tincture. Brush those midges off first. They’ve left the water and settled on my counter.'),
  ],
  'seli-rest': [
    { when: { all: ['whistle_returned'] }, once: 'seli-whistle',
      lines: say('Seli', 'Sit a minute. Pell’s been playing outside my stall since you found that whistle.', 'I’ll fill the blue bowl.') },
    line('Seli', 'Take the shady side. I’ll fill the blue bowl.', 'There. Stay as long as you like.'),
  ],
  'seli-repeat': [
    { when: { all: ['whistle_returned'] }, once: 'seli-whistle',
      lines: say('Seli', 'I can tell where Pell is with my eyes shut again. I suppose I have you to thank.') },
    { once: 'edda-lamp-oil', lines: say('Seli', 'Edda bought a whole bottle of lamp oil yesterday. Held it up to the light, like I’d sold her soup.') },
    line('Seli', 'Leave the empty jars on the bottom shelf, love. I’ll wash them when the counter’s quiet.'),
  ],
  'ship-rail': [
    after('visited:ship-rail', 'Tavian', 'From the top of that crane you can see clear over the sea wall. Nia always went up first.'),
    line('Tavian', 'There’s the crane. You used to see its shadow before you could see the roofs.'),
  ],
  dockworker: [
    after('rift_sealed', 'Dock worker', 'Feet dry, line slack. I’ve got time to tie a proper knot now.'),
    { when: { all: ['visited:merchant'] }, once: 'onion-lighter',
      lines: [...say('Tavian', 'Are those the onions for the market?'), ...say('Dock worker', 'Aye. Tell her she can charge them mooring fees. They’ve been alongside all morning.')] },
    after('visited:dockworker', 'Dock worker', 'Look at this wet stripe on my sleeve. Had my hand on the bollard when the water came up.'),
    line('Dock worker', 'Would you stand clear of that line? If the water drops again it’ll take your legs out.'),
  ],
  'bell-worker': [
    after('rift_sealed', 'Crane rigger', 'Hear the block creak? I can lift by ear again. Never knew I’d miss that noise.'),
    after('visited:bell-worker', 'Crane rigger', 'Our bell rings twice for a lift. That one down there rings once. Nobody takes the slack.'),
    line('Crane rigger', 'I had the hook halfway down when I heard a bell under the boards.', 'This is the lift bell, up here. I’d my hand on the rope.'),
  ],
  'lamp-keeper': [
    after('rift_sealed', 'Lamp keeper', 'Little wing marks in the soot. I’ve never been so pleased to have to clean the glass.'),
    after('visited:lamp-keeper', 'Lamp keeper', 'Same oil, same wick. It’s the water they won’t cross.'),
    line('Lamp keeper', 'I leave one pane dirty for the moths to cling to. Haven’t had a single one today.'),
  ],
  merchant: [
    after('rift_sealed', 'Merchant', 'Look at that sling. Full of onions and hardly swinging. I can get the scales out.'),
    after('visited:merchant', 'Merchant', 'I’d take a basket down myself, but the last woman who tried is still looking for her shoe.'),
    line('Merchant', 'See those onions sitting alongside? I’ve sold half of them. Just need the crane to get them ashore.'),
  ],
  'rope-worker': [
    {
      when: { all: ['visited:harbor-crane'] },
      once: 'crane-bearing',
      lines: [
        ...say('Tavian', 'Nia’s crane tag says somebody took a bearing for a pie weight.'),
        ...say('Rope maker', 'Apple pie. Tell Nia there’s a slice on my sill. She can have the bearing back when it cools.'),
      ],
    },
    after('visited:rope-worker', 'Rope maker', 'That short hank is Nia’s. She sews a blue thread through the end so I’ll know whose it is.'),
    line('Rope maker', 'Here, roll that bit between your fingers. Left-handed lay. My gran taught me on this very hook.'),
  ],
  'harbor-sign': [line('Harbor board', 'North to the market. Northwest to Venn’s workshop.', 'Old tide stairs on the east quay. Arrival pier to the south.')],
  'inland-gate': [
    { when: { all: ['page_found'] }, once: 'flour-carter', lines: [
      ...say('Tavian', 'Who would’ve seen a woman walking inland with a long case?'),
      ...say('Road keeper', 'Try the flour carter in the morning. He stops for anybody carrying a load.'),
    ] },
    after('heard:flour-carter', 'Road keeper', 'Look for the canvas covers. Keeps the flour dry.'),
    line('Road keeper', 'We’re tapping the causeway stones. That hollow sound means there’s a gap underneath. Give us till morning.'),
  ],
  'harbor-crane': [line('Nia’s repair tag', 'New bearing fitted. Whoever took the old one for a pie weight, please wash it. — Nia')],
  'departure-pier': [
    after('page_found', 'Tavian', 'The road she marked starts north of here. My bag can stay ashore.'),
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
    after('gate_opened', 'Nia', 'There. By the lower walkway. It came back.'),
    after('brace_found', 'Nia', 'Slide that timber under the wheel. I’ve got the weight.'),
    line('Nia', 'Bring the timber here. I can take the weight while you turn the wheel.'),
  ],
  'maintenance-plaque': [line('Maintenance marks', 'Lift counterweight before lowering handle. Keep crossing clear while draining.')],
  'chamber-markings': [
    after('rift_sealed', 'Tavian', 'Water’s down to the old survey mark. I can see the date under it.'),
    line('Tavian', 'Three cuts in the stone. The bottom one is crooked. That was my first survey with Edda.'),
  ],
};
