'use client';
import { useRef } from 'react';
import { manifesto } from '@/content/site';
import { manifestoState, quoteSizeVw } from '@/lib/chapters/tunnel';
import { sectionProgress } from '@/lib/scroll';
import { useScrollFrame } from '@/lib/useScrollFrame';
import { useReducedMotion } from '@/lib/useReducedMotion';
import s from './Manifesto.module.css';

const N = manifesto.quotes.length;
const pad = (n: number) => String(n).padStart(2, '0');
const SIZES = manifesto.quotes.map((q) => quoteSizeVw([q[0], q[2]]));

export function Manifesto() {
  const sec = useRef<HTMLElement>(null), count = useRef<HTMLSpanElement>(null);
  const qs = useRef<(HTMLLIElement | null)[]>([]);
  const last = useRef('');
  const reduce = useReducedMotion();
  useScrollFrame(() => {
    const el = sec.current; if (!el) return;
    const r = el.getBoundingClientRect(), st = manifestoState(sectionProgress(r.top, r.height, innerHeight), N, reduce);
    const key = `${st.active}|${st.quotes.map((q) => `${q.opacity.toFixed(3)}${q.t1}${q.t2Opacity.toFixed(3)}`).join('|')}`;
    if (key === last.current) return;
    last.current = key;
    st.quotes.forEach((q, i) => {
      const li = qs.current[i]; if (!li) return;
      const [l1, l2, l3] = li.children as unknown as HTMLElement[];
      li.style.opacity = String(q.opacity);
      l1.style.transform = q.t1; l3.style.transform = q.t3;
      l2.style.opacity = String(q.t2Opacity); l2.style.transform = q.t2Transform;
    });
    if (count.current) count.current.textContent = `${pad(st.active + 1)} / ${pad(N)}`;
  }, sec);
  return (
    // auto tone: the HUD frame follows the day/night breaker here
    <section ref={sec} id="c2" data-tone="auto" className={s.tunnel} aria-label="Manifesto">
      <div className={s.sticky}>
        <span className={`mono ${s.label}`}>{manifesto.label}</span>
        <span ref={count} className={`mono ${s.count}`} aria-hidden>{`${pad(1)} / ${pad(N)}`}</span>
        <h2 className="sr-only">Manifesto</h2>
        <ol role="list" className={s.tun}>
          {manifesto.quotes.map(([a, b, c], i) => (
            <li key={a} ref={(el) => { qs.current[i] = el; }} className={s.q} style={{ '--q': SIZES[i], opacity: i === 0 ? 1 : 0 } as React.CSSProperties}>
              <span data-tl="1" className={`${s.tl} ${s.t1}`}>{a}</span>
              <span data-tl="2" className={`${s.tl} ${s.t2}`}>{b}</span>
              <span data-tl="3" className={`${s.tl} ${s.t3}`}>{c}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
