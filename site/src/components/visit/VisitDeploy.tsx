'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { collectVisit, stage, type StageName, type Visit } from '@/lib/visit/metrics';
import { emitRobo } from '@/lib/robo/bus';
import { setScrollEnabled } from '@/lib/scroll';
import { prefersReducedMotion } from '@/lib/useReducedMotion';
import s from './VisitDeploy.module.css';

const STAGES: { name: StageName; label: string; verb: string }[] = [
  { name: 'build', label: 'BUILD', verb: 'what you downloaded' },
  { name: 'ship', label: 'SHIP', verb: 'how fast it arrived' },
  { name: 'run', label: 'RUN', verb: 'how it feels live' },
  { name: 'env', label: 'ENV', verb: 'where it runs' },
];
const TICK_MS = 350;
const MARK = { green: '✓', amber: '!', na: '–' } as const;
const NA_NOTE = 'not exposed by this browser';

/** Your visit as a CI/CD run. Every number is read from this browser and goes nowhere. */
export function VisitDeploy({ onClose, opener: given = null, collect = () => collectVisit() }: { onClose: () => void; opener?: HTMLElement | null; collect?: () => Promise<Visit> }) {
  const [visit, setVisit] = useState<Visit | null>(null);
  const [shown, setShown] = useState(0);
  const title = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const collectRef = useRef(collect);
  collectRef.current = collect;

  // focus in, trap Tab, Esc closes, focus goes back to whatever opened us
  useEffect(() => {
    const opener = given ?? (document.activeElement as HTMLElement | null); // Safari does not focus buttons on click: the caller passes the element
    close.current?.focus();
    setScrollEnabled(false); // the page stays put under the open panel
    emitRobo({ type: 'visitOpen' });
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const f = [...(panel.current?.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])') ?? [])];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (i < 0 || (!e.shiftKey && i === f.length - 1) || (e.shiftKey && i === 0)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); setScrollEnabled(true); opener?.focus?.(); };
  }, []);

  useEffect(() => {
    let live = true;
    collectRef.current().then((v) => { if (live) setVisit(v); }).catch(() => { if (live) setVisit(null); });
    return () => { live = false; };
  }, []);

  // stages tick in order once the readings are in; instant under reduced motion
  useEffect(() => {
    if (!visit) return;
    if (prefersReducedMotion()) { setShown(STAGES.length); return; }
    const id = setInterval(() => setShown((n) => { if (n >= STAGES.length) { clearInterval(id); return n; } return n + 1; }), TICK_MS);
    return () => clearInterval(id);
  }, [visit]);

  const results = visit ? STAGES.map((st) => stage(st.name, visit)) : [];
  const finished = !!visit && shown >= STAGES.length;
  const warnings = results.filter((r) => r.ok === 'amber').length;

  useEffect(() => { if (finished && warnings > 0) emitRobo({ type: 'visitAmber' }); }, [finished, warnings]);

  return (
    <div className={s.scrim} data-testid="visit-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} className={s.panel} role="dialog" aria-modal="true" aria-labelledby={title}>
        <i className={`${s.cn} ${s.tl}`} aria-hidden /><i className={`${s.cn} ${s.tr}`} aria-hidden /><i className={`${s.cn} ${s.bl}`} aria-hidden /><i className={`${s.cn} ${s.br}`} aria-hidden />
        <header className={s.head}>
          <div>
            <p className={s.kicker}>MC-01 · PIPELINE · THIS TAB</p>
            <h2 id={title} className={s.title}>Your visit, <em>deployed.</em></h2>
          </div>
          <button ref={close} type="button" className={s.x} onClick={onClose} aria-label="Close your deploy"><span aria-hidden>ESC ✕</span></button>
        </header>

        <ol className={s.rail}>
          {STAGES.map((st, i) => {
            const done = !!visit && i < shown, r = results[i];
            const state = done ? r.ok : 'pending';
            return (
              <li key={st.name} className={s.row} data-stage={st.name} data-state={state} data-active={!done && i === shown ? 'true' : undefined}>
                <span className={s.node} aria-hidden>{done ? MARK[r.ok] : ''}</span>
                <div className={s.body}>
                  <div className={s.meta}><span className={s.no}>{String(i + 1).padStart(2, '0')}</span><b className={s.name}>{st.label}</b><span className={s.verb}>{st.verb}</span></div>
                  {done ? (
                    <p className={s.read}>{r.ok === 'na' ? NA_NOTE : r.lines.map((l, j) => <span key={j} className={s.val}>{l}</span>)}</p>
                  ) : (
                    <p className={s.read} aria-hidden><span className={s.wait}>{i === shown && visit ? 'running' : 'queued'}</span></p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <p className={s.verdict} data-final={finished ? 'true' : 'false'} data-warn={warnings > 0 ? 'true' : undefined} role="status">
          {finished ? (warnings ? `Your visit is running in prod. ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}, 0 incidents.` : 'Your visit is running in prod. 0 incidents.') : 'Reading your browser…'}
        </p>
        <footer className={s.foot}>Measured in your browser. Never sent anywhere.</footer>
      </div>
    </div>
  );
}
