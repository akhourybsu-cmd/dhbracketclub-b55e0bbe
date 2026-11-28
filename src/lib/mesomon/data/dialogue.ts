import type { DialogueChoice, DialogueLine } from '../types';

export const say = (speaker: string, ...text: string[]): DialogueLine[] =>
  text.map(line => ({ speaker, text: line }));

export const bramGateReport: DialogueLine[] = [
  ...say('Bram', 'I saw her go down with her lamp. Then the pump jammed. If she came back up, I missed her.'),
  ...say('Port Marche', 'Metal rings below the steps. The water falls away from the bars.'),
  ...say('Bram', 'See the blue paw? Every time Rillik gets a grip, the water drops.'),
  ...say('Nia', 'Let me under there. I can hold the frame while Tav turns the wheel.'),
  ...say('Bram', 'Go on, both of you. I’ll keep the steps clear.'),
];

export const closingEvidence: DialogueLine[] = [
  ...say('Nia', 'Kettle’s on. Here, put that wet coat on my chair. What did you find?'),
  ...say('Tavian', 'Her field sheet. A mile inland, after the tremor. She made it out, Nia.'),
  ...say('Nia', 'Oh, thank goodness. Let me see where she went.'),
];

export const closingSupper: DialogueLine[] = [
  ...say('Port Marche', 'Nia sets out two bowls. Tavian puts his bag under the bench.'),
  ...say('Tavian', 'The captain can give my bunk to somebody else. I’m staying to find her.'),
  ...say('Nia', 'Last time you left, I heard it from the ferry cook. Will you wake me this time?'),
];

export const DIALOGUES: Record<string, DialogueLine[]> = {
  captain: [
    ...say('Captain', 'Shall I save you a bunk for the trip back?'),
    ...say('Tavian', 'Please. My old teacher wants a tide reading. I told the survey crew I’d only be a day.'),
    ...say('Port Marche', 'Tavian hands him Edda’s letter. She usually writes on both sides. This one fits in three lines.'),
    ...say('Edda’s letter', 'Come home. Bring the core. The harbor is singing in two voices.'),
    ...say('Captain', 'This core she wants. Is that the green stone on your wrist?'),
    ...say('Tavian', 'Put your thumb on it. Feel the tide? Four years charting the coast and I’ve only felt one beat.'),
    ...say('Tavian', 'Can you see Edda on the steps? She’ll have a lamp on her belt.'),
    ...say('Captain', 'I can see somebody waving both arms. Take your bag, lad.'),
  ],
  nia: [
    ...say('Nia', 'Tav! Here, give me that wet bag.'),
    ...say('Port Marche', 'He holds it out. She gets both arms round him.'),
    ...say('Tavian', 'There’s a letter for you in there. I started it three ports ago.'),
    ...say('Nia', 'Save it for supper. Did you see Edda from the boat?'),
    ...say('Tavian', 'I kept looking for her lamp. I thought she’d be here.'),
    ...say('Nia', 'So did I. She checked your landing time twice. Missed supper last night, too.'),
    ...say('Nia', 'I knocked at midnight. Her bench lamp was on. Come on, I’ve got her key. Northwest, past the market.'),
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
    ...say('Nia', 'I’ve got this end. Take the gangway to the lower landing.'),
  ],
  'first-bond': [
    { bondShot: 'return', speaker: 'Port Marche', text: 'The plank tips. Rillik lands on the far end. Tavian gets one knee up and grabs the rail.' },
    { bondShot: 'return', speaker: 'Tavian', text: 'You came back for me.' },
    { bondShot: 'glow', speaker: 'Port Marche', text: 'Green light shines through his wet sleeve. A beat later, the ring on Rillik’s tail lights up.' },
    { bondShot: 'glow', speaker: 'Tavian', text: 'Wait. My Edenite bracelet… I felt that. Was that you?' },
    { bondShot: 'offer', speaker: 'Port Marche', text: 'He rests his open hand on the plank. Rillik sniffs his wrist. Tavian holds still.' },
    { bondShot: 'touch', speaker: 'Port Marche', text: 'One webbed paw settles on the brass. The green stone and the tail ring pulse together.' },
    { bondShot: 'bond', speaker: 'Port Marche', text: 'A little blue crystal grows beside the green one. Rillik lifts its paw. Tavian can still feel its heartbeat.' },
    { bondShot: 'bond', speaker: 'Tavian', text: 'There you are. Come on, then. Let’s find Edda.' },
    { bondShot: 'bond', speaker: 'Field note', text: 'You and Rillik are bonded. Open Companions in Start to call Rillik to rest or walk together.' },
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
    ...say('Tavian', 'It’s still rising. Rillik, can you feel my heartbeat? Same as on the plank.'),
    ...say('Port Marche', 'Tavian holds out his wrist. Rillik presses its paw to the blue crystal. The two beats fall together.'),
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
    ...say('Port Marche', 'Tavian takes the unfinished letter from his bag. This time he puts it in Nia’s hand.'),
    ...say('Port Marche', 'While Nia reads, Rillik pulls a coil of clean rope under the bench and climbs into the middle.'),
    ...say('Nia', 'There goes my good rope. Oh, let it sleep.'),
    ...say('Port Marche', 'Rillik falls asleep against his boot. The blue crystal slows with its breathing. On Edda’s map, the inland road pulses once.'),
  ],
};

export const CLOSING_CHOICES: DialogueChoice[] = [
  { id: 'warm', label: 'Warm', text: 'I missed you, Nia. I’d like you there when we find her.' },
  { id: 'wry', label: 'Wry', text: 'Wake you? For one of your hot rolls, I’ll knock twice.' },
  { id: 'direct', label: 'Direct', text: 'First light, then. We’ll ask the carters together.' },
];
