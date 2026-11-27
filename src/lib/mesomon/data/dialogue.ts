import type { DialogueChoice, DialogueLine } from '../types';

export const say = (speaker: string, ...text: string[]): DialogueLine[] =>
  text.map(line => ({ speaker, text: line }));

export const bramGateReport: DialogueLine[] = [
  ...say('Bram', 'Saw her go down with a lamp. Never saw her come up. I was on the pumps.'),
  ...say('Port Marche', 'Metal rings below the steps. The water falls away from the bars.'),
  ...say('Bram', 'See the blue paw? That Rillik takes the drop every time.'),
  ...say('Nia', 'Let me under there. I can hold the frame while Tav turns the wheel.'),
  ...say('Bram', 'Go on, both of you. I’ll keep the steps clear.'),
];

export const closingEvidence: DialogueLine[] = [
  ...say('Nia', 'Kettle’s on. Here, put that wet coat on my chair. What did you find?'),
  ...say('Tavian', 'Her field sheet. A mile inland, after the tremor. She made it out, Nia.'),
  ...say('Nia', 'Oh, thank goodness. Let me see where she went.'),
];

export const closingSupper: DialogueLine[] = [
  ...say('Port Marche', 'Nia sets out two bowls. She draws Tavian’s chair up beside hers.'),
  ...say('Nia', 'Last time you left, I heard it from the ferry cook. Will you wake me this time?'),
];

export const DIALOGUES: Record<string, DialogueLine[]> = {
  captain: [
    ...say('Captain', 'Port Marche.'),
    ...say('Tavian', 'Is that a grey coat on the steps? She wears a lamp at her belt.'),
    ...say('Captain', 'That’s a gull on a post, lad. Who am I looking for?'),
    ...say('Tavian', 'Edda Venn. She taught me to read the tides here. Sent for me herself.'),
    ...say('Port Marche', 'Tavian smooths her letter against the rail. The crease runs through his name.'),
    ...say('Edda’s letter', 'Come home. Bring the core. The harbor is singing in two voices.'),
    ...say('Captain', 'There’s somebody waving now. Your bag’s by the gangplank.'),
  ],
  nia: [
    ...say('Nia', 'Tav! Here, give me that wet bag.'),
    ...say('Port Marche', 'He holds it out. She gets both arms round him.'),
    ...say('Tavian', 'There’s a letter for you in there. I started it three ports ago.'),
    ...say('Nia', 'I’d like to read it. Any sign of Edda from up there?'),
    ...say('Tavian', 'I kept looking for her lamp. I thought she’d be here.'),
    ...say('Nia', 'She missed supper, and now your boat. I went by at midnight. Her lamp was still on.'),
    ...say('Nia', 'Come on. I’ve got her spare key. Northwest, past the market.'),
  ],
  workshop: [
    ...say('Tavian', 'Edda? It’s Tav.'),
    ...say('Port Marche', 'Under the bench sits his old chair. A new peg holds the bad leg straight.'),
    ...say('Nia', 'She made me fix that leg twice. Said you’d notice a wobble.'),
    ...say('Nia', 'Her chart and field map are here. What did she keep on that hook?'),
  ],
  chart: [
    ...say('Tavian', 'That curve is a full tide. She pricked the chart each time she heard the other beat.'),
    ...say('Nia', 'My dividers fit every gap. Look, I haven’t touched the screw.'),
    ...say('Tavian', 'Even when the tide turns. She must’ve sat here for hours.'),
  ],
  'field-map': [
    ...say('Nia', 'The paper’s stuck to the bench. Here, lift the dry corner.'),
    ...say('Tavian', 'She circled the old tide stairs. Look where the pencil goes under the wharf.'),
    ...say('Nia', 'We’ll need Bram. He keeps the key to those stairs.'),
  ],
  'satchel-hook': [
    ...say('Nia', 'See the dents? Her case buckles used to knock against the wall.'),
    ...say('Tavian', 'She took the satchel and the long case. That’s the one that fits a whole chart.'),
    ...say('Nia', 'She even put her tools away. Whatever she went to do, she packed for it.'),
  ],
  'clues-complete': [
    ...say('Tavian', 'Hold the map up to the window. There’s writing on the back.'),
    ...say('Edda’s note', 'The second voice is not echo. Echo follows. This one waits.'),
    ...say('Quay runner', 'Nia! Bram needs you. His inlet’s gone dry and the tide’s still coming in.'),
    ...say('Nia', 'Right where she drew that circle. Come on, Tav. East quay.'),
  ],
  bram: [
    ...say('Bram', 'Hold up there. Boards are slick. Tav Merrow? Been a while.'),
    ...say('Tavian', 'Edda marked these stairs on her map. Did you see her come back?'),
    ...bramGateReport,
  ],
  'gate-blocked': [
    ...say('Nia', 'Take your weight off the wheel a second. See that bracket straighten?'),
    ...say('Tavian', 'It’ll bend again as soon as I turn. We need a brace under here.'),
    ...say('Nia', 'There’s a length of timber farther down. I’ve got the frame.'),
  ],
  'gate-opened': [
    ...say('Nia', 'Brace is in. Turn it now, Tav.'),
    ...say('Port Marche', 'The gate lifts. Rillik squeezes under the last bar and dives.'),
    ...say('Tavian', 'Did you see its back foot? It’s keeping the weight off it.'),
    ...say('Nia', 'Tav, your board!'),
    ...say('Port Marche', 'The clang comes again. The plank drops with the water and splits.'),
    ...say('Nia', 'I can hold this end. Take the lower walkway.'),
  ],
  'first-bond': [
    ...say('Port Marche', 'Rillik hooks a wet paw over the split plank and hauls itself up beside Tavian.'),
    ...say('Tavian', 'You came back. Here, I’ll sit down.'),
    ...say('Port Marche', 'His cuff ticks. Rillik draws back. Tavian lays his wrist on the plank.'),
    ...say('Tavian', 'Startled me the first time, too.'),
    ...say('Port Marche', 'Rillik comes closer and rests a paw on the brass. A crystal buds beneath its toes.'),
    ...say('Tavian', 'There it is again, under the wharf. Want to come and listen?'),
    ...say('Field note', 'Rillik walks beside you. In Start, open Companions to call it to rest or release it again.'),
  ],
  'whistle-accepted': [
    ...say('Pell', 'Seen a silver whistle? Well, tin. Looks silver wet.'),
    ...say('Tavian', 'I’ll keep an eye out. Where were you standing?'),
    ...say('Pell', 'In the reeds below the market. The water folded right over my boots. I let go.'),
  ],
  'whistle-returned': [
    ...say('Pell', 'That’s mine. See the tooth mark? Listen.'),
    ...say('Port Marche', 'Two bright notes. On the third, a little plug of mud lands on Tavian’s boot.'),
    ...say('Pell', 'Sorry about the boot. Here, Seli left a tincture for whoever found it.'),
  ],
  'whistle-imitation': [
    ...say('Port Marche', 'Pell plays two notes and a squeak. Rillik flattens its ears, then squeaks back.'),
    ...say('Pell', 'That last one was a mistake.'),
    ...say('Port Marche', 'Rillik squeaks again. Pell takes a breath and joins in.'),
  ],
  'wrong-catch': [
    ...say('Fisher', 'Hold this edge for me? Every time I lift the net, its foot twists.'),
    ...say('Tavian', 'Let’s lay it flat. I can get a finger under that loop.'),
    ...say('Port Marche', 'Rillik hums. The Muddren uncurls its toes. Tavian slips the loop free.'),
    ...say('Fisher', 'There you go, love. Mud’s all yours.'),
  ],
  gleamwing: [
    ...say('Port Marche', 'Each time Gleamwing beats against the lantern, its shadow jumps up the wall.'),
    ...say('Tavian', 'Easy. You’ll wear yourself out on that glass. There’s room on the ledge.'),
    ...say('Field note', 'Resonant Cry can calm Gleamwing. Once it settles, offer a bond with Resonate.'),
  ],
  'sense-eddy': [
    ...say('Port Marche', 'Rillik lays its cheek to the wall. Water threads into a seam by its whiskers.'),
    ...say('Tavian', 'I can hear it through the stone. That lever should drain the crossing.'),
  ],
  sluice: [
    ...say('Tavian', 'Up with the weight. Now the handle.'),
    ...say('Port Marche', 'The lever catches. As the water drains, a bootprint shows in the silt.'),
    ...say('Tavian', 'Square heel. I wish that narrowed it down.'),
  ],
  tressel: [
    ...say('Port Marche', 'Tressel drags a mouthful of splinters onto the boards. Its nest is soaked.'),
    ...say('Tavian', 'It’s trying to get the nest dry. Come back a step, Rillik.'),
    ...say('Port Marche', 'Water knocks against the boards. Tressel drops the splinters and springs.'),
    ...say('Field note', 'Resonant Cry lowers agitation. When Tressel settles, choose Resonate to offer a bond.'),
  ],
  'sense-channel': [
    ...say('Port Marche', 'A line of foam climbs past the tide mark. Rillik follows it to the chamber door.'),
    ...say('Tavian', 'Uphill, all the way to that door. No tide I know runs like that.'),
  ],
  'boss-intro': [
    ...say('Port Marche', 'A violet shard slips through a tear above the basin. It strikes the rim and rings.'),
    ...say('Tavian', 'There. That’s the sound we heard on the steps.'),
    ...say('Port Marche', 'More shards gather round a narrow mask. The water lifts clear of the stone.'),
    ...say('Field note', 'Bring the Rift Wretch’s Stability to zero to drive it back. Demons cannot bond.'),
  ],
  'boss-defeated': [
    ...say('Port Marche', 'The last shard slips back through the tear. The ringing stops. The gap stays open.'),
    ...say('Tavian', 'The water’s still climbing. Rillik? Same as on the plank.'),
    ...say('Port Marche', 'He holds out his wrist. Rillik lays a paw on the brass. The two beats fall together.'),
    ...say('Field note', 'Send three pulses through the cuff to seal the rift.'),
  ],
  sealed: [
    ...say('Port Marche', 'The tear closes. Water lands in the basin with a slap and starts to run downhill.'),
    ...say('Tavian', 'The cuff’s still ticking. One beat inland. A fainter one to the north.'),
    ...say('Port Marche', 'A third fades before he can place it. Rillik scratches at a loose stone by the basin.'),
  ],
  page: [
    ...say('Port Marche', 'Under the stone is a waxed bundle. The paper inside is dry. Tavian knows that hand.'),
    ...say('Edda’s page', 'Not all doors are opened from the other side.'),
    ...say('Edda’s page', 'After the tremor. One mile up the inland road. Same beat, twice as strong.'),
    ...say('Edda’s page', 'Back at the basin. Tav, I’ve marked your copy. I’ll go inland again at low water. E. Venn.'),
    ...say('Tavian', 'She came back to leave me this. Wait till Nia sees it.'),
    ...say('Port Marche', 'He slips the field sheet inside Edda’s letter.'),
  ],
  closing: [
    ...closingEvidence,
    ...say('Nia', 'I know the carters on that road. We can ask them in the morning.'),
    ...closingSupper,
  ],
  'closing-after': [
    ...say('Port Marche', 'Tavian takes the unfinished letter from his bag. Nia sees her name and pockets it.'),
    ...say('Port Marche', 'He sets the crystal by Edda’s map. Rillik slips out and circles twice on the rope.'),
    ...say('Nia', 'There goes my good rope. Oh, let it sleep.'),
    ...say('Port Marche', 'Rillik tucks its nose in and sleeps. On the map, a point along the inland road pulses once.'),
  ],
};

export const CLOSING_CHOICES: DialogueChoice[] = [
  { id: 'warm', label: 'Warm', text: 'I missed you, Nia. I’d like you there when we find her.' },
  { id: 'wry', label: 'Wry', text: 'Wake you? For one of your hot rolls, I’ll knock twice.' },
  { id: 'direct', label: 'Direct', text: 'First light, then. We’ll ask the carters together.' },
];
