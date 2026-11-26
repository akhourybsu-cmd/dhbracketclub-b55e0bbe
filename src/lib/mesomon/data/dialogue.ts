import type { DialogueChoice, DialogueLine } from '../types';

export const say = (speaker: string, ...text: string[]): DialogueLine[] =>
  text.map(line => ({ speaker, text: line }));

export const bramGateReport: DialogueLine[] = [
  ...say('Bram', 'Saw her go down with a lamp. I was on the pumps after that.'),
  ...say('Port Marche', 'Metal rings below the steps. The inlet drains.'),
  ...say('Bram', 'Every time it rings, the water drops that Rillik onto the bars.'),
  ...say('Nia', 'I can hold the frame. Tav knows the wheel.'),
  ...say('Bram', 'Down you go. I’ll keep the steps clear.'),
];

export const closingEvidence: DialogueLine[] = [
  ...say('Nia', 'Kettle’s on. What have you got there?'),
  ...say('Tavian', 'Her field sheet. She felt it inland too. Look where she marked the road.'),
];

export const closingSupper: DialogueLine[] = [
  ...say('Port Marche', 'Nia sets out two bowls and pulls up the spare chair.'),
  ...say('Nia', 'Last time, the ferry cook told me you’d gone. Wake me this time?'),
];

export const DIALOGUES: Record<string, DialogueLine[]> = {
  captain: [
    ...say('Captain', 'Port Marche.'),
    ...say('Tavian', 'Can you see Edda? Grey coat, lamp on her belt.'),
    ...say('Captain', 'Only a gull on those steps. Who’s Edda?'),
    ...say('Tavian', 'Taught me to survey this coast. She sent for me.'),
    ...say('Port Marche', 'Tavian flattens her letter against the rail.'),
    ...say('Edda’s letter', 'Come home. Bring the core. The harbor is singing in two voices.'),
    ...say('Captain', 'There’s somebody waving now. Your bag’s by the gangplank.'),
  ],
  nia: [
    ...say('Nia', 'I wore my good coat. Is that bag wet?'),
    ...say('Tavian', 'Hello, Nia. Your stitching held.'),
    ...say('Nia', 'I’d have settled for a letter.'),
    ...say('Port Marche', 'He holds the bag out. She goes straight past it and hugs him.'),
    ...say('Tavian', 'I know. Where’s Edda?'),
    ...say('Nia', 'She missed our supper yesterday. I saw her workshop lamp burning all night.'),
    ...say('Nia', 'Let’s try her place. Northwest, past the market.'),
  ],
  workshop: [
    ...say('Tavian', 'Edda? It’s Tav.'),
    ...say('Port Marche', 'Her chair sits under the bench. Salt crusts the edge of a map.'),
    ...say('Nia', 'Four years. She still keeps that chair for you.'),
    ...say('Nia', 'Let’s look. Her chart, the field map, the hook by the door.'),
  ],
  chart: [
    ...say('Tavian', 'The long curve’s the tide. Those pinholes mark the second pulse.'),
    ...say('Nia', 'The tide turns here. The holes keep going.'),
    ...say('Tavian', 'Same gap, all the way across.'),
  ],
  'field-map': [
    ...say('Nia', 'It’s stuck. Here, take the dry corner.'),
    ...say('Tavian', 'She circled the old tide stairs. That pencil line runs under the wharf.'),
    ...say('Nia', 'Bram has the key to those stairs.'),
  ],
  'satchel-hook': [
    ...say('Nia', 'There’s the dent her chart case used to knock in the wall.'),
    ...say('Tavian', 'Case and satchel both gone. She packed the big sheets.'),
    ...say('Nia', 'Her tools are put away, too. She had time to pack.'),
  ],
  'clues-complete': [
    ...say('Tavian', 'There’s a note on the back.'),
    ...say('Edda’s note', 'The second voice is not echo. Echo follows. This one waits.'),
    ...say('Quay runner', 'Nia! The tide’s coming in and Bram’s inlet just emptied. He needs a hand.'),
    ...say('Nia', 'That’s the inlet on her map. Come on, Tav. East quay.'),
  ],
  bram: [
    ...say('Bram', 'Hold there. Nia! Is that young Merrow with you?'),
    ...say('Tavian', 'Edda came this way. Did you see her come up?'),
    ...bramGateReport,
  ],
  'gate-blocked': [
    ...say('Nia', 'Stop. See the bracket bend when you pull?'),
    ...say('Tavian', 'The gate’s hanging on it. We need a brace under the wheel.'),
    ...say('Nia', 'There’s a length of timber farther down. I’ll hold this.'),
  ],
  'gate-opened': [
    ...say('Nia', 'Brace is in. You’ve got the wheel.'),
    ...say('Port Marche', 'The gate lifts. A small blue body slides between the bars and dives.'),
    ...say('Tavian', 'Did you see its left foot? It’s limping.'),
    ...say('Nia', 'Easy, Tav. Your board—'),
    ...say('Port Marche', 'The clang comes again. The plank drops with the water and splits.'),
    ...say('Nia', 'I’ll hold this side. Take the lower walkway.'),
  ],
  'first-bond': [
    ...say('Port Marche', 'A wet paw hooks the split plank. Rillik pulls itself up beside Tavian.'),
    ...say('Tavian', 'That’s the sore one. You can lean on me.'),
    ...say('Port Marche', 'Rillik sniffs his sleeve. His cuff ticks under its nose.'),
    ...say('Tavian', 'You hear it too?'),
    ...say('Port Marche', 'Its tail ring lights. Nose to cuff, Rillik holds still. A crystal forms.'),
    ...say('Field note', 'Release to walk with Rillik. Call to let it rest in its crystal.'),
    ...say('Tavian', 'There it is again, under the wharf. Can you show me?'),
  ],
  'whistle-accepted': [
    ...say('Pell', 'Seen a silver whistle? Well, tin. Looks silver wet.'),
    ...say('Tavian', 'Where did it get wet?'),
    ...say('Pell', 'Below the market. The water folded over my boots. I dropped it in the reeds.'),
  ],
  'whistle-returned': [
    ...say('Pell', 'That’s the dent! I did that with my tooth. Listen.'),
    ...say('Port Marche', 'Two bright notes. On the third, a little plug of mud lands on Tavian’s boot.'),
    ...say('Pell', 'Sorry about your boot. Seli said whoever found it gets this tincture.'),
  ],
  'whistle-imitation': [
    ...say('Port Marche', 'Pell plays two clear notes and a squeak. Rillik tips its head and gives the squeak back.'),
    ...say('Pell', 'That last one was a mistake.'),
    ...say('Port Marche', 'Rillik squeaks again. Pell takes a breath and joins in.'),
  ],
  'wrong-catch': [
    ...say('Fisher', 'Every time I lift the net, its foot twists.'),
    ...say('Tavian', 'Lay the net flat. I can get a finger under that loop.'),
    ...say('Port Marche', 'Rillik hums. The Muddren uncurls its toes and Tavian slips the loop off.'),
    ...say('Fisher', 'There you go. Mud’s all yours.'),
  ],
  gleamwing: [
    ...say('Port Marche', 'Gleamwing beats its wings against the lantern glass.'),
    ...say('Tavian', 'There’s a dry ledge behind you. Easy. You can land.'),
    ...say('Field note', 'Use Resonant Cry to calm it. Then offer a bond with Resonate.'),
  ],
  'sense-eddy': [
    ...say('Port Marche', 'Rillik noses a wet seam. A bead of water slips into the wall.'),
    ...say('Tavian', 'There’s the drain. That lever should empty the crossing.'),
  ],
  sluice: [
    ...say('Tavian', 'Weight up. Handle down.'),
    ...say('Port Marche', 'The lever catches. The boards drain. A bootprint shows in the silt.'),
    ...say('Tavian', 'Square heel. Too smeared to tell whose.'),
  ],
  tressel: [
    ...say('Port Marche', 'A Tressel hauls a mouthful of splinters up onto the crossing. Its nest is soaked.'),
    ...say('Tavian', 'We can give you room. Come back a step, Rillik.'),
    ...say('Port Marche', 'Water knocks against the boards. Tressel drops the splinters and springs.'),
    ...say('Field note', 'Resonant Cry lowers agitation. When Tressel settles, use Resonate to offer a bond.'),
  ],
  'sense-channel': [
    ...say('Port Marche', 'Foam climbs past the tide mark. Rillik follows it to the chamber door.'),
    ...say('Tavian', 'The sea never gets that high. It’s coming from in there.'),
  ],
  'boss-intro': [
    ...say('Port Marche', 'A hand reaches through a slit above the basin. Its knuckles ring on stone.'),
    ...say('Tavian', 'That’s what we heard on the steps. Watch the water.'),
    ...say('Port Marche', 'A second hand takes hold. The water lifts clear of the bottom.'),
    ...say('Field note', 'Drive the Rift Wretch’s Stability to zero to push it back. Demons cannot bond.'),
  ],
  'boss-defeated': [
    ...say('Port Marche', 'The Wretch slips back. The ringing stops. The slit stays open.'),
    ...say('Tavian', 'Water’s still rising. Rillik, give me your paw?'),
    ...say('Port Marche', 'Rillik rests a paw on the cuff. The beats fall together.'),
    ...say('Field note', 'Press A when the rings meet. Three pulses close the rift.'),
  ],
  sealed: [
    ...say('Port Marche', 'The slit closes. Water drops into the basin. Tavian hears it running downhill again.'),
    ...say('Tavian', 'There’s still a beat on the inland side. And a faint one north.'),
    ...say('Port Marche', 'A third fades before he can place it. Rillik scratches at a loose stone by the basin.'),
  ],
  page: [
    ...say('Port Marche', 'Under the stone, a waxed cloth keeps a field sheet dry.'),
    ...say('Edda’s page', 'Not all doors are opened from the other side.'),
    ...say('Edda’s page', 'After the tremor. Pulse stronger inland. Try the road at low water. E. Venn.'),
    ...say('Tavian', 'She felt it too. Wait till Nia sees this.'),
    ...say('Port Marche', 'He tucks the page inside her letter.'),
  ],
  closing: [
    ...closingEvidence,
    ...say('Nia', 'I know the carters on that run. We can ask them in the morning.'),
    ...closingSupper,
  ],
  'closing-after': [
    ...say('Port Marche', 'Tavian lays the crystal by the map. Rillik slips out and circles the rope twice.'),
    ...say('Nia', 'Well, there goes my good rope.'),
    ...say('Port Marche', 'Rillik falls asleep. On the map, a point along the inland road pulses once.'),
  ],
};

export const CLOSING_CHOICES: DialogueChoice[] = [
  { id: 'warm', label: 'Warm', text: 'Yes. I missed you, Nia. Come with me?' },
  { id: 'wry', label: 'Wry', text: 'Yes. Breakfast at yours. Let the cook find out last.' },
  { id: 'direct', label: 'Direct', text: 'I’ll knock at first light. We’ll ask the carters together.' },
];
