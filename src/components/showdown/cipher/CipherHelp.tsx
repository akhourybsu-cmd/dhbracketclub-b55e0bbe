import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, HelpCircle, LockKeyhole } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CipherCode } from '@/lib/showdown/cipher/types';
import { CipherPeg } from './CipherPeg';
import './cipherGame.css';

interface CipherHelpProps { preferenceKey?: string; autoShow?: boolean }
const SECRET: CipherCode = ['red', 'red', 'blue', 'green'];
const GUESS: CipherCode = ['red', 'blue', 'red', 'yellow'];
const STEPS = [
  { title: 'Make a secret.', detail: 'Choose four pegs. Your opponent builds a secret for you, too.', eyebrow: '01 / THE SETUP' },
  { title: 'Repeats are welcome.', detail: 'A color can appear more than once. Four of the same color is a valid code.', eyebrow: '02 / SIX COLORS, FOUR SPACES' },
  { title: 'Put a guess on the board.', detail: 'Tap a space, then a color. You can change every peg until you submit.', eyebrow: '03 / YOUR FIRST MOVE' },
  { title: 'Read the little clues.', detail: 'Black: right color, right space. White: right color, different space. Clues never point to a particular peg.', eyebrow: '04 / EVERY PEG COUNTS ONCE' },
  { title: 'Ten guesses. One code.', detail: 'Four black clues crack the code. That winning guess counts toward your total.', eyebrow: '05 / BREAK THE COMBINATION' },
  { title: 'Play on your own time.', detail: 'Fewer guesses wins when both players solve. A solve beats an unbroken code; two failed attempts draw. Both secrets stay hidden until the result.', eyebrow: '06 / THE DUEL' },
];
function needsGuide(key?: string) {
  if (!key) return false;
  try { return localStorage.getItem(key) !== '1'; } catch { return true; }
}
function ExampleCode({ code, label }: { code: CipherCode; label: string }) {
  return <div className="cipher-help-code" role="img" aria-label={`${label}: ${code.join(', ')}`}><span aria-hidden="true">{label}</span><div>{code.map((color, index) => <span className="cipher-example-socket" key={index}><CipherPeg color={color} decorative /></span>)}</div></div>;
}

/** A short visual tour using public examples, never a live opponent's code. */
export function CipherHelp({ preferenceKey, autoShow = true }: CipherHelpProps) {
  const [open, setOpen] = useState(() => autoShow && needsGuide(preferenceKey));
  const [step, setStep] = useState(0);
  useEffect(() => { setStep(0); setOpen(autoShow && needsGuide(preferenceKey)); }, [preferenceKey, autoShow]);
  const current = STEPS[step];
  function finish() {
    if (preferenceKey) { try { localStorage.setItem(preferenceKey, '1'); } catch { /* The tour remains available without device storage. */ } }
    setOpen(false); setStep(0);
  }
  return <>
    <button type="button" className="cipher-icon-button" aria-label="How to play Cipher Duel" onClick={() => { setStep(0); setOpen(true); }}><HelpCircle size={19} aria-hidden="true" /></button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="cipher-help-dialog" data-testid="cipher-help">
        <DialogHeader><p className="cipher-eyebrow">{current.eyebrow}</p><DialogTitle>{current.title}</DialogTitle><DialogDescription className="cipher-dialog-description">{current.detail}</DialogDescription></DialogHeader>
        <div className="cipher-help-visual" key={step}>
          {step <= 1 ? <><LockKeyhole className="cipher-help-lock" size={32} aria-hidden="true" /><ExampleCode code={step === 1 ? ['red', 'red', 'red', 'red'] : SECRET} label="YOUR SECRET" />{step === 1 && <p>Same color. Different spaces.</p>}</> : step <= 3 ? <><ExampleCode code={SECRET} label="EXAMPLE SECRET" /><ExampleCode code={GUESS} label="EXAMPLE GUESS" />{step === 3 && <div className="cipher-help-feedback" aria-label="One exact match and two color matches in different positions"><span className="cipher-clue is-exact" aria-hidden="true" /><span className="cipher-clue is-color" aria-hidden="true" /><span className="cipher-clue is-color" aria-hidden="true" /><div><b>1 black · 2 white</b><span>The second red still counts.</span></div></div>}</> : step === 4 ? <><div className="cipher-help-perfect"><ExampleCode code={SECRET} label="A CRACKED CODE" /><div aria-label="Four exact matches">{[0, 1, 2, 3].map(index => <span className="cipher-clue is-exact" key={index} aria-hidden="true" />)}</div></div><div className="cipher-help-ten" aria-label="Ten guesses available">{Array.from({ length: 10 }, (_, index) => <span key={index}>{index + 1}</span>)}</div></> : <><div className="cipher-help-versus"><span>YOU<strong>4</strong><small>guesses</small></span><i>vs</i><span>RIVAL<strong>6</strong><small>guesses</small></span></div><p className="cipher-help-winner"><Check size={16} aria-hidden="true" />You cracked it in fewer guesses.</p></>}
        </div>
        <footer className="cipher-help-footer"><div aria-label={`Tutorial step ${step + 1} of 6`}>{STEPS.map((_, index) => <i className={index === step ? 'is-current' : ''} key={index} />)}</div><div>{step > 0 && <button type="button" className="cipher-secondary" onClick={() => setStep(value => value - 1)}><ArrowLeft size={15} aria-hidden="true" />Back</button>}<button type="button" className="cipher-primary" onClick={() => step === 5 ? finish() : setStep(value => value + 1)}>{step === 5 ? 'Let’s play' : 'Next'}<ArrowRight size={15} aria-hidden="true" /></button></div></footer>
      </DialogContent>
    </Dialog>
  </>;
}
