import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, PartyPopper } from 'lucide-react';
import { Confetti } from '@/components/Confetti';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import cake from '@/assets/celebrations/kris-cake.webp';
import monogram from '@/assets/dh-monogram.png';
import './krisBirthday.css';

export default function KrisBirthdayOpening({ onDismiss }: { onDismiss: () => void }) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [cheers, setCheers] = useState(0);
  const enter = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="kris-birthday-backdrop" />
        <Dialog.Content className="kris-birthday"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            enter.current?.focus({ preventScroll: true });
          }}>
          <div className="kris-birthday-poster">
            <div className="kris-birthday-photo"><img src={cake} alt="" width="900" height="900" /></div>
            <div className="kris-birthday-copy">
              <div className="kris-birthday-club"><img src={monogram} alt="" width="34" height="34" /> DH Club</div>
              <Dialog.Title className="kris-birthday-title"><span>Happy birthday,</span> <strong>Kris!</strong></Dialog.Title>
              <Dialog.Description className="kris-birthday-wish">Love, your DH crew.</Dialog.Description>
              <div className="kris-birthday-actions">
                <Dialog.Close asChild>
                  <button type="button" ref={enter}>Enter DH Club <ArrowRight aria-hidden="true" size={18} /></button>
                </Dialog.Close>
                {!reducedMotion && <button type="button" className="kris-birthday-cheer" onClick={() => setCheers(count => count + 1)}>
                  <PartyPopper aria-hidden="true" size={18} /> Throw confetti
                </button>}
              </div>
            </div>
          </div>
          {!reducedMotion && <div aria-hidden="true"><Confetti key={cheers} active duration={2600} particleCount={96} /></div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
