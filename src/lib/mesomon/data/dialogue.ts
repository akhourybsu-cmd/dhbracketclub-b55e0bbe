import type { DialogueChoice, DialogueLine } from '../types';

export const say = (speaker: string, ...text: string[]): DialogueLine[] =>
  text.map(line => ({ speaker, text: line }));

export const bramGateReport: DialogueLine[] = [
  ...say('Bram', 'Saw her go down with a lamp. After that I was on the pumps.'),
  ...say('Port Marche', 'Below the steps, claws scrape metal. Then the sound drops out.'),
  ...say('Bram', 'Rillik behind the lower gate. Each time the water drops it lands on those bars.'),
  ...say('Nia', 'I can hold the frame. Tav knows the wheel.'),
  ...say('Bram', 'Down you go. I’ll keep the steps clear.'),
];

export const DIALOGUES: Record<string, DialogueLine[]> = {
  captain: [
    ...say('Captain', 'Port Marche.'),
    ...say('Tavian', 'Could you hold off a minute? There should be a woman on the quay.'),
    ...say('Captain', 'We can lie here till supper. You’ll still see better from the pier.'),
    ...say('Port Marche', 'Tavian unfolds the letter against the rail. The creases have gone soft.'),
    ...say('Edda’s letter', 'Come home. Bring the core.', 'The harbor is singing in two voices.'),
    ...say('Captain', 'Your bag’s by the gangplank. Mind the third board.'),
  ],
  nia: [
    ...say('Nia', 'Same bag. I mended that strap the night you left.'),
    ...say('Tavian', 'Still holds. Hello, Nia.'),
    ...say('Nia', 'Four years and I get a review of the stitching. Come here.'),
    ...say('Port Marche', 'She pulls him close, then takes the bag off his shoulder.'),
    ...say('Tavian', 'Where’s Edda?'),
    ...say('Nia', 'Missed supper yesterday. Missed your boat today. Her workshop lamp burned all night.'),
    ...say('Tavian', 'I thought she’d be here to tell me what she needed the core for.'),
    ...say('Nia', 'Come on. We’ll try her workshop. Northwest, just past the market.'),
  ],
  workshop: [
    ...say('Nia', 'Yesterday she had that chair wedged under the door.'),
    ...say('Tavian', 'It’s back at the bench. She put her tools away too.'),
    ...say('Nia', 'You can sit in it, Tav. Your hands are shaking.'),
    ...say('Tavian', 'Help me look first? You know what was here yesterday.'),
    ...say('Nia', 'I’ll take this end. Check her chart, her field map and the hook by the door.'),
  ],
  chart: [
    ...say('Tavian', 'These wide curves are the tide. She’s put a pinhole at every extra pulse.'),
    ...say('Nia', 'You could lay a comb over those holes.'),
    ...say('Tavian', 'Yes. Even where the tide turns, the spacing holds.'),
  ],
  'field-map': [
    ...say('Nia', 'Lift the corner. It’s sticking to the bench.'),
    ...say('Tavian', 'Salt water. She’s circled the old tide stairs and drawn in the passage below.'),
    ...say('Nia', 'Bram has the key to that barrier.'),
  ],
  'satchel-hook': [
    ...say('Tavian', 'Both pegs bare. Her oilskin bag and the long field case.'),
    ...say('Nia', 'She took the case? She makes me carry that thing with both hands.'),
    ...say('Tavian', 'It holds a week’s worth of charts. She packed for a trip.'),
  ],
  'clues-complete': [
    ...say('Nia', 'There’s writing on the back of her last reading.'),
    ...say('Edda’s note', 'The second voice is not echo. Echo follows. This one waits.'),
    ...say('Port Marche', 'A runner knocks twice on the open door.'),
    ...say('Quay runner', 'Nia! Bram needs hands. The inlet’s draining and the tide’s still coming in.'),
    ...say('Nia', 'We’re coming. Tav, east quay. The stairs she marked.'),
  ],
  bram: [
    ...say('Bram', 'Stay this side till I’ve counted you. Nia. And young Merrow?'),
    ...say('Tavian', 'Edda came this way. Did you see her come up?'),
    ...bramGateReport,
  ],
  'gate-blocked': [
    ...say('Nia', 'Stop. See the bracket bend when you pull?'),
    ...say('Tavian', 'The gate’s hanging on it. We need a brace under the wheel.'),
    ...say('Nia', 'There’s a length of timber farther down. I’ll hold this.'),
  ],
  'gate-opened': [
    ...say('Nia', 'Timber’s in. Turn it now.'),
    ...say('Port Marche', 'The lattice rises a handspan. Blue fur flashes through the gap.'),
    ...say('Tavian', 'It scraped its foot. Did you see where it went?'),
    ...say('Nia', 'Let it get its breath. Tav, your board—'),
    ...say('Port Marche', 'Water sucks out between the piles. A plank splits under his heel.'),
    ...say('Nia', 'I’ll stay on this side. Keep your weight on the lower walkway.'),
  ],
  'first-bond': [
    ...say('Port Marche', 'Rillik climbs back onto the boards. One wet paw rests on Tavian’s sleeve.'),
    ...say('Tavian', 'I saw you get that foot caught. Can I look?'),
    ...say('Port Marche', 'It draws the paw back. Tavian opens his hand and waits.'),
    ...say('Nia', 'Tav. Look at your wrist.'),
    ...say('Port Marche', 'The ring on its tail glows. Rillik leans in until its nose touches the Edenite cuff.'),
    ...say('Tavian', 'Feel that? There’s your beat, just under mine.'),
    ...say('Port Marche', 'A crystal forms against the brass. Rillik lifts its nose and the beat holds.'),
    ...say('Field note', 'Each companion has a resting crystal. Release lets Rillik walk beside you. Call brings it back.'),
    ...say('Nia', 'I’ll see to the boards. Where are you two going?'),
    ...say('Tavian', 'Under the wharf. That’s where the water went.'),
  ],
  'whistle-accepted': [
    ...say('Pell', 'If anybody says they found a silver whistle, it’s mine. It’s tin. Looks silver when it’s wet.'),
    ...say('Tavian', 'Where did it get wet?'),
    ...say('Pell', 'In the reeds below the market. The mud went up over my toes. I left in a hurry.'),
  ],
  'whistle-returned': [
    ...say('Pell', 'That’s the dent! I did that with my tooth. Listen.'),
    ...say('Port Marche', 'Two bright notes. On the third, a little plug of mud lands on Tavian’s boot.'),
    ...say('Pell', 'Oh. Here’s the tincture Seli gave me for whoever went in after it.'),
  ],
  'whistle-imitation': [
    ...say('Port Marche', 'Pell plays two clear notes and a squeak. Rillik tips its head and gives the squeak back.'),
    ...say('Pell', 'That last one was a mistake.'),
    ...say('Port Marche', 'Rillik squeaks again. Pell takes a breath and joins in.'),
  ],
  'wrong-catch': [
    ...say('Fisher', 'Every time I lift the net, that foot twists round with it.'),
    ...say('Tavian', 'Lay the net flat. I can get a finger under that loop.'),
    ...say('Port Marche', 'Rillik hums against the wet cord. The Muddren uncurls one toe, then the next.'),
    ...say('Fisher', 'There you go. Mud’s all yours.'),
    ...say('Port Marche', 'Two eyes and a ridge of mud travel slowly out to the bank.'),
  ],
  gleamwing: [
    ...say('Port Marche', 'A Gleamwing fans its wings against the lantern glass. The water below trembles with each stroke.'),
    ...say('Tavian', 'There’s a dry ledge behind you. Easy. You can land.'),
    ...say('Field note', 'Resonant Cry can settle a wild Mesomon. Offer Resonate when its agitation falls.'),
  ],
  'sense-eddy': [
    ...say('Port Marche', 'Rillik taps a wet seam. A thread of foam slips sideways through the stone.'),
    ...say('Tavian', 'There’s a drain behind this wall. That sluice will empty the crossing.'),
  ],
  sluice: [
    ...say('Tavian', 'Weight up. Handle down.'),
    ...say('Port Marche', 'The wheel catches. Water peels off the crossing and leaves a bootprint in the silt.'),
    ...say('Tavian', 'Square heel. Too smeared to tell whose.'),
  ],
  tressel: [
    ...say('Port Marche', 'A Tressel hauls a mouthful of splinters up onto the crossing. Its nest is soaked.'),
    ...say('Tavian', 'We can give you room. Come back a step, Rillik.'),
    ...say('Port Marche', 'Water knocks against the boards. Tressel drops the splinters and springs.'),
    ...say('Field note', 'Resonant Cry lowers agitation. When Tressel settles, use Resonate to offer a bond.'),
  ],
  'sense-channel': [
    ...say('Port Marche', 'Foam runs up the channel. Rillik follows it to the chamber and waits for Tavian.'),
    ...say('Tavian', 'That lip’s above the high-water mark. What’s pulling it up there?'),
  ],
  'boss-intro': [
    ...say('Port Marche', 'A slit hangs above the basin. Water rises to meet a hand reaching through.'),
    ...say('Tavian', 'Rillik, back. There’s something coming through with it.'),
    ...say('Port Marche', 'The thing plants a second hand beside the first. The stone cracks under its grip.'),
    ...say('Field note', 'Drive the Rift Wretch’s Stability to zero to push it back. Demons cannot bond.'),
  ],
  'boss-defeated': [
    ...say('Port Marche', 'The Wretch loses its hold. Its fingers slip back through the slit.'),
    ...say('Tavian', 'The water’s still rising. Help me close it?'),
    ...say('Port Marche', 'Rillik puts one paw on the cuff. Its crystal beats against the brass.'),
    ...say('Field note', 'Confirm when the rings meet. Match three pulses to seal the rift. Seal Assist accepts any timing.'),
  ],
  sealed: [
    ...say('Port Marche', 'The slit draws shut. Water falls into the basin with a single slap.'),
    ...say('Tavian', 'Another beat when I turn inland. A weaker one north.'),
    ...say('Port Marche', 'A third brushes his wrist and fades before he can place it. Rillik noses a loose stone.'),
  ],
  page: [
    ...say('Port Marche', 'Under the stone, a folded survey page sits dry in a skin of wax.'),
    ...say('Edda’s page', 'Not all doors are opened from the other side.'),
    ...say('Edda’s page', 'First tremor at low water. Took the inland road on foot. E. Venn.'),
    ...say('Tavian', 'Her little square full stops. Nia, you ought to see this.'),
    ...say('Port Marche', 'He folds the page along its old crease and slips it inside his coat.'),
  ],
  closing: [
    ...say('Nia', 'Set the map here. I wiped the table twice.'),
    ...say('Tavian', 'She dated this after the tremor. Look where she went.'),
    ...say('Nia', 'The inland road. I know the carters on that run. We can ask who saw her.'),
    ...say('Port Marche', 'Nia slides a bowl across the table. A second spoon sticks out of her pocket.'),
    ...say('Nia', 'Last time you took off I heard it from the ferry cook. Will you wake me this time?'),
  ],
  'closing-after': [
    ...say('Port Marche', 'Tavian lays Rillik’s crystal beside Edda’s map. Rillik noses the paper, then circles twice on a coil of rope.'),
    ...say('Nia', 'Well, somebody likes the bed.'),
    ...say('Port Marche', 'By the time he picks up his spoon, Rillik is asleep. A point on the inland road pulses once.'),
  ],
};

export const CLOSING_CHOICES: DialogueChoice[] = [
  { id: 'warm', label: 'Warm', text: 'I missed you. I’d like you to come with me.' },
  { id: 'wry', label: 'Wry', text: 'I’ll bring breakfast. You can send the cook my regards.' },
  { id: 'direct', label: 'Direct', text: 'Yes. We’ll ask the carters together in the morning.' },
];
