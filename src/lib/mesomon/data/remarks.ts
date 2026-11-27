import type { NarrativeVariant } from '../types';
import { bramGateReport, closingEvidence, closingSupper, DIALOGUES, say } from './dialogue';

const line = (speaker: string, ...text: string[]): NarrativeVariant => ({ lines: say(speaker, ...text) });
const after = (fact: string, speaker: string, ...text: string[]): NarrativeVariant => ({
  when: { all: [fact] }, lines: say(speaker, ...text),
});

export const REMARKS: Record<string, NarrativeVariant[]> = {
  'nia-repeat': [line('Nia', 'Left past the market. Edda gave me a key the third time I climbed in the window.')],
  'workshop-nia': [
    after('clues_complete', 'Nia', 'East quay. Go ahead, I’ll pull the door shut.'),
    { when: { all: ['clue_map', 'clue_hook'] }, lines: say('Nia', 'East stairs. Big case. Tav, what was she measuring on that chart?') },
    { when: { all: ['clue_chart', 'clue_hook'] }, lines: say('Nia', 'Have a look at the map. She usually pencils in where she took a reading.') },
    { when: { all: ['clue_chart', 'clue_map'] }, lines: say('Nia', 'Before we go, look at the hook by the door. What’s missing?') },
    after('clue_hook', 'Nia', 'That’s a heavy case for a quick reading. Where was she taking it?'),
    after('clue_map', 'Nia', 'We know which stairs. Think she meant to be gone long?'),
    after('clue_chart', 'Nia', 'I can see those pinholes now. Where did she make the readings?'),
    line('Nia', 'I can mend anything on that bench. Her field work’s your department. What catches your eye?'),
  ],
  'bram-early': [
    { when: { all: ['clue_map'] }, lines: [
      ...say('Tavian', 'Edda circled these stairs on her map.'),
      ...say('Bram', 'Keep the map dry. I sent three people down. I want to see three come back up.'),
    ] },
    after('visited:bram', 'Bram', 'Still waiting on the pump crew. Try the workshop, Tav.'),
    { lines: [...say('Bram', 'Mind the chain. Pump crew’s coming up.'), ...say('Tavian', 'Did Edda come up this way?'), ...say('Bram', 'Haven’t seen her come up today. Have you tried her workshop?')] },
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
      lines: [...say('Tavian', 'Seli sold Edda lamp oil. Did you see where the light went?'),
        ...say('Bram', 'Lost it at the first bend. She struck the match on my rail.')] },
    after('rift_sealed', 'Bram', 'There’s the chalk line. First time all day the water’s stayed below it.'),
    after('gate_opened', 'Bram', 'Heard the wheel catch. Haven’t heard claws on those bars since. Good work.'),
    line('Bram', 'Through here, down the stairs. Keep one hand on the rail.'),
  ],
  chart: [{
    when: { all: ['visited:bell-worker'] },
    lines: [
      ...say('Tavian', 'The curve’s the tide. She pricked a hole each time she heard the other beat.'),
      ...say('Nia', 'Even here, where the tide turns?'),
      ...say('Tavian', 'Same spacing. The rigger heard it too. Thought it was the lift bell.'),
    ],
  }],
  'chart-repeat': [line('Tavian', 'I can put a finger between any two holes. Even here, at slack water.')],
  'field-map-repeat': [line('Tavian', 'She circled the eastern tide stairs. The pencil line continues under the wharf.')],
  'satchel-hook-repeat': [line('Tavian', 'Those dents fit the brass buckles on her long case. I used to carry it for her.')],
  'sense-eddy-repeat': [
    after('sluice_open', 'Tavian', 'Only a trickle through the seam now. The crossing’s dry.'),
    line('Tavian', 'Same pull through the wall. The sluice controls this channel.'),
  ],
  'sense-channel-repeat': [
    after('rift_sealed', 'Tavian', 'Foam’s coming down over the lip again.'),
    line('Tavian', 'Still running up toward the chamber.'),
  ],
  'tressel-retry': [line('Port Marche', 'Tressel hooks its tail around the wet nest. Its claws dig into the boards.')],
  'boss-retry': [line('Tavian', 'Watch its lowest shard, Rillik. There, it’s lifting clear of the rim again.')],
  'page-repeat': [
    after('chapter_complete', 'Tavian', 'I’d have stepped straight over it. Rillik knew to look under the stone.'),
    line('Tavian', 'The page is safe inside my coat. Back to Edda’s workshop.'),
  ],
  closing: [{
    when: { all: ['heard:flour-carter'] },
    lines: [
      ...closingEvidence,
      ...say('Tavian', 'The road keeper said to ask the flour carter.'),
      ...say('Nia', 'I know his cart. White flour on the seat, even when he’s hauling turnips.'),
      ...closingSupper,
    ],
  }],
  'closing-after': [
    { when: { tone: 'warm' }, lines: [...say('Nia', 'I missed you too. Of course I’m coming.'), ...DIALOGUES['closing-after']] },
    { when: { tone: 'wry' }, lines: [...say('Nia', 'Two rolls. Knock loud, though. I can sleep through a hammer on an anvil.'), ...DIALOGUES['closing-after']] },
    { when: { tone: 'direct' }, lines: [...say('Nia', 'I’ll have my boots on. First cart goes through at six.'), ...DIALOGUES['closing-after']] },
  ],
  'closing-repeat': [line('Nia', 'Come sit. Tell me about one of those ports I only ever saw on an envelope.')],
  'fisher-early': [
    after('visited:fisher', 'Fisher', 'See how it curls its toes? That last loop’s caught under its foot.'),
    line('Fisher', 'Watch its throat. Hardly a pause between breaths.', 'Easy, love. I can buy another net.'),
  ],
  'fisher-repeat': [line('Fisher', 'Look at the prints. That sore foot went just as deep as the others.')],
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
    line('Tavian', 'There’s the crane. I drew it on every school slate I ever owned.'),
  ],
  dockworker: [
    after('rift_sealed', 'Dock worker', 'You can cross the line now. First time all morning I’ve had slack to spare.'),
    { when: { all: ['visited:merchant'] }, once: 'onion-lighter',
      lines: [...say('Tavian', 'Are those the onions for the market?'), ...say('Dock worker', 'Aye. She sold me a sack. I’m still standing here holding the boat it’s on.')] },
    after('visited:dockworker', 'Dock worker', 'See my cuff? Wet to the elbow, and I’ve had both feet on this dock all morning.'),
    line('Dock worker', 'Step over here, clear of the line. See it jump when the water drops?'),
  ],
  'bell-worker': [
    after('rift_sealed', 'Crane rigger', 'Hear the creak as the load comes up? I can work by ear again.'),
    after('visited:bell-worker', 'Crane rigger', 'Two rings for a lift. That one under our feet only rings once.'),
    line('Crane rigger', 'Heard the lift bell with my thumb still on the clapper. Put my ear to the deck.', 'Whatever’s ringing, it’s down there.'),
  ],
  'lamp-keeper': [
    after('rift_sealed', 'Lamp keeper', 'A little dusting of wings on the glass. I might leave that pane till tomorrow.'),
    after('visited:lamp-keeper', 'Lamp keeper', 'They’ll cross the street for this wick. Today they won’t cross the water.'),
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
    after('rift_sealed', 'Rope maker', 'Feel that? Dry on the inside. We can save this whole hank if we spread it out.'),
    after('visited:rope-worker', 'Rope maker', 'Blue thread in the end means Nia’s. She got tired of buying her own rope back.'),
    line('Rope maker', 'Roll it between your fingers. Left-handed lay. My gran taught me on this hook.'),
  ],
  'harbor-sign': [line('Harbor board', 'North to the market. Northwest to Venn’s workshop.', 'Old tide stairs on the east quay. Arrival pier to the south.')],
  'inland-gate': [
    { when: { all: ['page_found'] }, once: 'flour-carter', lines: [
      ...say('Tavian', 'Who takes this road often enough to remember a woman with a long case?'),
      ...say('Road keeper', 'Ask the flour carter in the morning. He offers people lifts.'),
    ] },
    after('heard:flour-carter', 'Road keeper', 'Canvas hood on his cart. White handprints all along the back.'),
    line('Road keeper', 'Hear that hollow knock? There’s a gap under this stone. Road stays shut till we lift it.'),
  ],
  'harbor-crane': [line('Nia’s repair tag', 'New bearing fitted. Whoever took the old one for a pie weight, please wash it. — Nia')],
  'departure-pier': [
    after('page_found', 'Tavian', 'The road on her page starts north of here. My bag can stay ashore.'),
    line('Tavian', 'There’s still tar in the grain where I sat waiting for my first ship.'),
  ],
  'workshop-note': [
    after('clues_complete', 'Edda’s note', 'The second voice is not echo. Echo follows. This one waits.'),
    line('Edda’s note', 'Recheck at slack water. Bring a dry pencil this time.'),
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
    after('rillik_bonded', 'Nia', 'I’ve tied off the bad board. Keep to the wall on your way back.'),
    after('gate_opened', 'Nia', 'By the lower walkway, Tav. Look who’s come back.'),
    after('brace_found', 'Nia', 'Slide that timber under the wheel. I’ve got the weight.'),
    line('Nia', 'See the loose timber down the steps? Bring it here. I can hold the wheel till then.'),
  ],
  'maintenance-plaque': [line('Maintenance marks', 'Raise counterweight. Lower handle. Keep off crossing until boards drain.')],
  'chamber-markings': [
    after('rift_sealed', 'Tavian', 'The date’s clear again. I had to stand on Edda’s case to cut that last digit.'),
    line('Tavian', 'That crooked cut’s mine. Edda let me mark the water myself on my first survey.'),
  ],
};
