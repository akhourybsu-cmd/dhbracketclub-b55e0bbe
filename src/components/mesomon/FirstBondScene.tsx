import { useState } from 'react';
import { BOND_ART } from '@/lib/mesomon/assets';
import type { BondShot } from '@/lib/mesomon/types';
import './firstBondScene.css';

type Plate = keyof typeof BOND_ART;
const PLATES = ['return', 'offer', 'touch'] as const satisfies readonly Plate[];
const SHOTS: Record<BondShot, { plate: Plate; description: string }> = {
  return: { plate: 'return', description: 'On the broken walkway, Rillik climbs back onto the plank beside Tavian.' },
  glow: { plate: 'offer', description: 'The green stone on Tavian’s wrist lights up. A ring of light answers at the tip of Rillik’s tail.' },
  offer: { plate: 'offer', description: 'Tavian rests his open hand on the boards. Rillik watches from a paw’s length away.' },
  touch: { plate: 'touch', description: 'Rillik sets its front paw on the brass cuff around Tavian’s wrist.' },
  bond: { plate: 'touch', description: 'A small blue crystal catches the light beside the green stone. Rillik keeps its paw on the cuff.' },
};

/** The saved line chooses the shot. Reading speed, input and story completion stay with the dialogue. */
export function FirstBondScene({ shot, reducedMotion, paused }: {
  shot: BondShot;
  reducedMotion: boolean;
  paused: boolean;
}) {
  const [loaded, setLoaded] = useState<Partial<Record<Plate, boolean>>>({});
  const { plate, description } = SHOTS[shot];
  const visible = !!loaded[plate];
  return (
    <div className="mm-bond-scene" data-bond-shot={shot} data-ready={visible}
      data-still={reducedMotion || undefined} data-paused={paused || undefined}
      role="img" aria-label={description} aria-hidden={visible ? undefined : true}>
      <div className="mm-bond-plate" aria-hidden="true">
        {PLATES.map(key => (
          <img key={key} src={BOND_ART[key]} width={640} height={480} alt="" draggable={false}
            data-active={key === plate && visible}
            onLoad={() => setLoaded(previous => ({ ...previous, [key]: true }))}
            onError={() => setLoaded(previous => ({ ...previous, [key]: false }))} />
        ))}
        {visible && plate === 'touch' && (
          <div className="mm-bond-setting" style={{ backgroundImage: `url(${BOND_ART.touch})` }} />
        )}
        {visible && (
          <div className="mm-bond-light" key={shot}>
            {shot === 'glow' && <><span className="mm-bond-core" /><span className="mm-bond-tail" /></>}
            {plate === 'touch' && <><span className="mm-bond-contact" /><span className="mm-bond-tail-linked" /></>}
            {shot === 'bond' && <span className="mm-bond-crystal" />}
          </div>
        )}
      </div>
    </div>
  );
}
