import type { NarrativeVariant } from '../types';
import { bramGateReport, closingEvidence, closingSupper, DIALOGUES, say } from './dialogue';

const line = (speaker: string, ...text: string[]): NarrativeVariant => ({ lines: say(speaker, ...text) });
const after = (fact: string, speaker: string, ...text: string[]): NarrativeVariant => ({
  when: { all: [fact] }, lines: say(speaker, ...text),
});

export const REMARKS: Record<string, NarrativeVariant[]> = {
  'nia-repeat': [line('Nia', 'Left past the market. Edda gave me a key the third time I climbed in the window.')],
  'workshop-nia': [
    after('clues_complete', 'Nia', 'Bram’s on the east quay. Go ahead. I’ll lock up.'),
    { when: { all: ['clue_map', 'clue_hook'] }, lines: say('Nia', 'She took her case to the tide stairs. What was she measuring on that chart?') },
    { when: { all: ['clue_chart', 'clue_hook'] }, lines: say('Nia', 'Try the map on the bench. She marks the spot every time she takes a reading.') },
    { when: { all: ['clue_chart', 'clue_map'] }, lines: say('Nia', 'Before we go, look at the hook by the door. What’s missing?') },
    after('clue_hook', 'Nia', 'If she took the long case, she meant to work a while. Where did she go?'),
    after('clue_map', 'Nia', 'We know which stairs she went to. What did she take with her?'),
    after('clue_chart', 'Nia', 'All those pinholes. I wonder where she stood to listen.'),
    line('Nia', 'I know where she keeps her tools. You worked on these charts with her. Take a look?'),
  ],
  'bram-early': [
    { when: { all: ['clue_map'] }, lines: [
      ...say('Tavian', 'Edda circled these stairs on her map.'),
      ...say('Bram', 'Keep that map dry. I’ve got three people on the pumps. Give them room to come up.'),
    ] },
    after('visited:bram', 'Bram', 'Still waiting on the pump crew. Try the workshop, Tav.'),
    { lines: [...say('Bram', 'Mind the chain. I need these steps clear for the pump crew.'), ...say('Tavian', 'Did Edda come up this way?'), ...say('Bram', 'I’ve been watching the pumps. Have you tried her workshop?')] },
  ],
  bram: [{
    when: { all: ['visited:bram'] },
    lines: [
      ...say('Bram', 'There you are. What did you find at the workshop?'),
      ...say('Tavian', 'She marked these stairs. Did you see her come back?'),
      ...bramGateReport,
    ],
  }],
  'bram-repeat': [
    { when: { all: ['heard:edda-lamp-oil'] }, once: 'bram-lamp',
      lines: [...say('Tavian', 'Seli filled Edda’s lamp yesterday. Was it lit when you saw her?'),
        ...say('Bram', 'Struck the match on this rail. I watched her lamp go round the first bend.')] },
    after('rift_sealed', 'Bram', 'There’s the chalk line. First time all day the water’s stayed below it.'),
    after('gate_opened', 'Bram', 'Heard the wheel catch. Those paws are off the bars now. Good work.'),
    line('Bram', 'Through here, down the stairs. Keep one hand on the rail.'),
  ],
  chart: [{
    when: { all: ['visited:bell-worker'] },
    lines: [
      ...say('Tavian', 'This line is the tide. See the pinholes? Edda made one each time she heard that second beat.'),
      ...say('Nia', 'There’s one here, even where the tide turns.'),
      ...say('Tavian', 'They’re all the same distance apart. I wonder if that’s what the rigger mistook for his bell.'),
    ],
  }],
  'chart-repeat': [line('Tavian', 'When the tide stopped moving, she kept making marks. Same space between each pair.')],
  'field-map-repeat': [line('Tavian', 'She circled the eastern tide stairs. The pencil line continues under the wharf.')],
  'satchel-hook-repeat': [line('Tavian', 'Those dents fit the brass buckles on her long case. I used to carry it for her.')],
  'sense-eddy-repeat': [
    after('sluice_open', 'Tavian', 'Only a trickle through the seam now. The crossing’s dry.'),
    line('Tavian', 'Water’s pushing through this wall. Opening the sluice should drain the boards.'),
  ],
  'sense-channel-repeat': [
    after('rift_sealed', 'Tavian', 'Foam’s coming down over the lip again.'),
    line('Tavian', 'Still running up toward the chamber.'),
  ],
  'tressel-retry': [line('Port Marche', 'Tressel hooks its tail around the wet nest. Its claws dig into the boards.')],
  'boss-retry': [line('Tavian', 'Watch that bottom shard, Rillik. Hear it scrape the basin?')],
  'page-repeat': [
    after('chapter_complete', 'Tavian', 'I’d have stepped straight over it. Rillik knew to look under the stone.'),
    line('Tavian', 'The page is safe inside my coat. Back to Edda’s workshop.'),
  ],
  closing: [{
    when: { all: ['heard:flour-carter'] },
    lines: [
      ...closingEvidence,
      ...say('Tavian', 'The road keeper said to ask the flour carter.'),
      ...say('Nia', 'I know his cart. Even when he hauls turnips, he leaves white handprints on the reins.'),
      ...closingSupper,
    ],
  }],
  'closing-after': [
    { when: { tone: 'warm' }, lines: [...say('Nia', 'I missed you too. I still have your first letter. Half of it’s about being seasick.'), ...DIALOGUES['closing-after']] },
    { when: { tone: 'wry' }, lines: [...say('Nia', 'Knock on my shutters. I’ll bring the rolls.'), ...DIALOGUES['closing-after']] },
    { when: { tone: 'direct' }, lines: [...say('Nia', 'I’ll have my boots on. First cart goes through at six.'), ...DIALOGUES['closing-after']] },
  ],
  'closing-repeat': [line('Nia', 'Come sit. I’ve had four years of harbor names on envelopes. What was it like out there?')],
  'fisher-early': [
    after('visited:fisher', 'Fisher', 'See how it curls its toes? That last loop’s caught under its foot.'),
    line('Fisher', 'Poor thing’s breathing so fast. That loop’s tight around its foot.', 'Easy, love. I can buy another net.'),
  ],
  'fisher-repeat': [line('Fisher', 'See those tracks? It’s putting weight on that foot again.')],
  'pell-pending': [line('Pell', 'In the reeds below the market. I’d show you where, but my boots are still full.')],
  'pell-repeat': [
    after('whistle_imitation', 'Pell', 'I can play the last note properly. I just like it better how Rillik does it.'),
    line('Pell', 'Look. String through the hole, string round my wrist. Go on, give it a tug.'),
  ],
  'seli-gift': [
    { when: { all: ['whistle_returned'] }, once: 'seli-whistle',
      lines: say('Seli', 'There’s that whistle again. Pell told me who got their boots wet.', 'This tincture’s yours, Tav. Keep the lid on tight.') },
    after('rift_sealed', 'Seli', 'Tav! Come here and let me look at you. You used to fit under this counter.', 'Here’s a tincture. Bring me the empty jar when you’ve done.'),
    line('Seli', 'Here’s your old jar, Tav. I can still read your name under the lid.', 'Fresh tincture. Shoo those midges off first. They’ve left the water for my counter.'),
  ],
  'seli-rest': [
    { when: { all: ['whistle_returned'] }, once: 'seli-whistle',
      lines: say('Seli', 'Hear Pell out front? Bring your lot round to the quiet side.', 'I’ll fill the blue bowl. Let them have a good drink.') },
    line('Seli', 'Bring them round to the shade. The blue bowl’s clean.', 'There. Let them drink their fill.'),
  ],
  'seli-repeat': [
    { when: { all: ['whistle_returned'] }, once: 'seli-whistle',
      lines: say('Seli', 'I can tell where Pell is with my eyes shut again. I hear that’s your doing.') },
    { once: 'edda-lamp-oil', lines: say('Seli', 'Edda filled her lamp here yesterday. Paid for the rest of the bottle too.') },
    after('rift_sealed', 'Seli', 'The midges are back over the water. I can leave my jars out to dry again.'),
    line('Seli', 'Leave the empty jars on the bottom shelf, love. I’ll wash them when the counter’s quiet.'),
  ],
  'ship-rail': [
    after('visited:ship-rail', 'Tavian', 'From the top of that crane you can see clear over the sea wall. Nia always went up first.'),
    line('Tavian', 'A deckhand once asked what home looked like. I drew him that crane.'),
  ],
  dockworker: [
    after('rift_sealed', 'Dock worker', 'You can cross the line now. First time today I’ve had slack to spare.'),
    { when: { all: ['visited:merchant'] }, once: 'onion-lighter',
      lines: [...say('Tavian', 'Are those the onions for the market?'), ...say('Dock worker', 'Aye. Mine’s the sack on top. I’d fetch it if somebody else would hold this rope.')] },
    after('visited:dockworker', 'Dock worker', 'See my cuff? Wet to the elbow, and I’ve had both feet on this dock all morning.'),
    line('Dock worker', 'Step over here, clear of the line. See it jump when the water drops?'),
  ],
  'bell-worker': [
    after('rift_sealed', 'Crane rigger', 'Hear the creak as the load comes up? I can work by ear again.'),
    after('visited:bell-worker', 'Crane rigger', 'Two rings means lift. What I heard came from under the boards.'),
    line('Crane rigger', 'Thought I heard the lift bell. Had my hand on it at the time.', 'Put my ear to the boards. The sound’s coming from below us.'),
  ],
  'lamp-keeper': [
    after('rift_sealed', 'Lamp keeper', 'Moths on the lamp again. I’ll leave that pane till tomorrow.'),
    after('visited:lamp-keeper', 'Lamp keeper', 'See them over the shop lamps? Usually half of them are down here by the water.'),
    line('Lamp keeper', 'I use this brush to shoo the moths off the glass. Haven’t needed it once today.'),
  ],
  merchant: [
    after('rift_sealed', 'Merchant', 'Smell the onions? One sack split on the way up. Those go in my own pot.'),
    after('visited:merchant', 'Merchant', 'I’ve told three customers their supper’s still on a boat. You try the fourth.'),
    line('Merchant', 'Half those onions are sold. I’d quite like them ashore before the other half sprout.'),
  ],
  'rope-worker': [
    {
      when: { all: ['visited:harbor-crane'] },
      once: 'crane-bearing',
      lines: [
        ...say('Tavian', 'A crane bearing for a pie weight. Would that be your pie?'),
        ...say('Rope maker', 'Apple. Tell Nia her slice is on the sill. I washed the bearing.'),
      ],
    },
    after('rift_sealed', 'Rope maker', 'Feel the middle of that coil. Still dry. Help me lay it out and we can save the rope.'),
    after('visited:rope-worker', 'Rope maker', 'Blue thread in the end means Nia’s. She got tired of buying her own rope back.'),
    line('Rope maker', 'Roll it between your fingers. Twists to the left, see? My gran taught me on this very hook.'),
  ],
  'harbor-sign': [line('Harbor board', 'North to the market. Northwest to Venn’s workshop.', 'Old tide stairs on the east quay. Arrival pier to the south.')],
  'inland-gate': [
    { when: { all: ['page_found'] }, once: 'flour-carter', lines: [
      ...say('Tavian', 'Edda took this road with her long case. Who might’ve passed her?'),
      ...say('Road keeper', 'Ask the flour carter in the morning. He offers people lifts.'),
    ] },
    after('heard:flour-carter', 'Road keeper', 'Canvas hood on his cart. White handprints all along the back.'),
    line('Road keeper', 'Hear that hollow knock? There’s a gap under this stone. Road stays shut till we lift it.'),
  ],
  'harbor-crane': [line('Nia’s repair tag', 'New bearing fitted. Whoever took the old one for a pie weight, please wash it. — Nia')],
  'departure-pier': [
    after('chapter_complete', 'Tavian', 'My bag can stay at Edda’s tonight. I don’t have a ship to catch.'),
    after('page_found', 'Tavian', 'The road on her page starts north of here. I should show Nia where Edda went.'),
    line('Tavian', 'I sat on my bag right here the day I left. Kept looking for Nia. I hadn’t told her when I sailed.'),
  ],
  'workshop-note': [
    after('clues_complete', 'Edda’s note', 'The second voice is not echo. Echo follows. This one waits.'),
    line('Edda’s note', 'Listen again when the tide stops. Bring a dry pencil this time.'),
  ],
  kettle: [
    after('page_found', 'Tavian', 'The lid’s rattling again. Nia must’ve got the fire to draw.'),
    line('Tavian', 'Bone dry. Edda always left enough in here for my cup.'),
  ],
  'tide-lattice': [
    after('gate_opened', 'Tavian', 'Blue fur on the bars. The gap underneath is clear.'),
    line('Port Marche', 'A paw comes through the bars, feeling for a foothold. The water falls away beneath it.'),
  ],
  'nia-stairs': [
    after('rift_sealed', 'Nia', 'There. The boards are staying put. I’ll get the kettle on at Edda’s.'),
    { when: { all: ['rillik_bonded'] }, once: 'nia-sees-crystal', lines: [
      ...say('Nia', 'Hold your wrist up, Tav. I know the green stone. Where’d the blue one come from?'),
      ...say('Tavian', 'Down on the plank. Rillik put its paw there.'),
      ...say('Nia', 'Whole harbor to swim in, and it came back to you.'),
    ] },
    after('rillik_bonded', 'Nia', 'I’ve tied off the bad board. Keep to the wall on your way back.'),
    after('gate_opened', 'Nia', 'By the lower walkway, Tav. Look who’s come back.'),
    after('brace_found', 'Nia', 'Slide that timber under the wheel. I’ve got the weight.'),
    line('Nia', 'See the loose timber down the steps? Bring it here. I can hold the wheel till then.'),
  ],
  'maintenance-plaque': [line('Maintenance marks', 'Lift the weight. Pull the handle down. Wait for the boards to drain before crossing.')],
  'chamber-markings': [
    after('rift_sealed', 'Tavian', 'The date’s clear again. I had to stand on Edda’s case to cut that last digit.'),
    line('Tavian', 'That crooked cut’s mine. Edda let me mark the water myself on my first survey.'),
  ],
};
