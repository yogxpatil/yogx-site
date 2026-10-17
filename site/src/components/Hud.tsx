'use client';
import { useEffect, useRef, useState } from 'react';
import { chapters, type Tone } from '@/content/site';
import { useScrollFrame } from '@/lib/useScrollFrame';
import { formatClock, formatCoords, toneAt, hudInk } from '@/lib/hud';
import { currentIndex } from '@/lib/dial';
import { clamp } from '@/lib/math';
import { emitRobo } from '@/lib/robo/bus';
import { tapCounter } from '@/lib/robo/signals';
import { goFastLane } from '@/lib/fastLane';
import { VisitDeploy } from '@/components/visit/VisitDeploy';
import s from './Hud.module.css';

export function Hud() {
  const [clock, setClock] = useState({ ist: '--:--:--', utc: '--:--' });
  const [coords, setCoords] = useState({ x: '0.00', y: '0.00' });
  const [alt, setAlt] = useState(0);
  const [tone, setTone] = useState<Tone>('light');
  const [night, setNight] = useState(false);
  const [ch, setCh] = useState(chapters[0].name);
  const [deploy, setDeploy] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const taps = useRef(tapCounter(3, 1500));
  const xv = useRef<HTMLDivElement>(null), xh = useRef<HTMLDivElement>(null);

  useScrollFrame(() => {
    const total = document.documentElement.scrollHeight - innerHeight;
    setAlt(Math.round(clamp(scrollY / Math.max(total, 1)) * 100));
    const els = [...document.querySelectorAll<HTMLElement>('[data-tone]')];
    setTone(toneAt(els.map((el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, tone: el.dataset.tone as Tone }; })));
    const tops = chapters.map((c) => document.getElementById(c.id)?.getBoundingClientRect().top ?? Infinity);
    setCh(chapters[currentIndex(tops, innerHeight)].name);
  });

  useEffect(() => {
    // 'auto' chapters change colour with the breaker even while the page is standing still
    const html = document.documentElement, sync = () => setNight(html.classList.contains('night'));
    sync(); const mo = new MutationObserver(sync); mo.observe(html, { attributes: true, attributeFilter: ['class'] });
    const tick = () => { const d = new Date(); setClock({ ist: formatClock(d, 330), utc: formatClock(d, 0).slice(0, 5) }); };
    tick(); const id = setInterval(tick, 1000);
    // one update per animation frame, however fast the pointer fires
    let raf = 0, px = 0, py = 0;
    const apply = () => {
      raf = 0;
      setCoords(formatCoords(px, py, innerWidth, innerHeight));
      if (xv.current) xv.current.style.transform = `translateX(${px}px)`;
      if (xh.current) xh.current.style.transform = `translateY(${py}px)`;
    };
    const move = (e: PointerEvent) => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(apply); };
    addEventListener('pointermove', move);
    return () => { mo.disconnect(); clearInterval(id); if (raf) cancelAnimationFrame(raf); removeEventListener('pointermove', move); };
  }, []);

  return (
    <>
      <div ref={xv} className={`${s.xh} ${s.v}`} aria-hidden /><div ref={xh} className={`${s.xh} ${s.h}`} aria-hidden />
      <div className={`${s.hud} ${{ cream: s.dark, ink: s.ink, theme: '' }[hudInk(tone, night)]}`} aria-hidden>
        <div className={s.frame} /><i className={`${s.cn} ${s.tl}`} /><i className={`${s.cn} ${s.tr}`} /><i className={`${s.cn} ${s.bl}`} /><i className={`${s.cn} ${s.br}`} />
        <span className={`${s.t} ${s.keep}`} style={{ left: 28, top: 14 }}><i style={{ pointerEvents: 'auto' }} onPointerDown={() => { if (taps.current(Date.now())) emitRobo({ type: 'egg', id: 'yogx' }); }}>MC-01</i>YOGX MISSION CONTROL</span>
        <span className={s.t} style={{ left: '50%', top: 14, transform: 'translateX(-50%)' }}><i>IST</i>{clock.ist}&nbsp;&nbsp;<i>UTC</i>{clock.utc}</span>
        <span className={s.t} style={{ right: 28, top: 14 }}><span className={s.live} />SYS <b>NOMINAL</b> · 6 ENVS · 100+ SVC</span>
        <div className={s.ruler} data-robo-avoid=""><span className={s.mk} style={{ top: `${alt}%` }}>ALT {String(alt).padStart(2, '0')}%</span></div>
        <span className={s.t} style={{ left: 28, bottom: 14 }}><i>CURSOR</i>X·STABILITY <b>{coords.x}</b>&nbsp;&nbsp;Y·CREATIVITY <b>{coords.y}</b></span>
        <span className={s.t} style={{ left: '50%', bottom: 14, transform: 'translateX(-50%)' }}><i>CH</i>{ch.toUpperCase()}</span>
      </div>
      <nav aria-label="Shortcut" className={`${s.hud} ${s.quiet} ${{ cream: s.dark, ink: s.ink, theme: '' }[hudInk(tone, night)]}`}>
        <div className={s.links}>
        <a className={s.fast} href="/fast-lane/" onClick={(e) => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); goFastLane(); } }}>Fast lane <span aria-hidden>→</span></a>
        <button type="button" className={`${s.fast} ${s.deploy}`} aria-haspopup="dialog" onPointerDown={(e) => { opener.current = e.currentTarget; }} onClick={(e) => { opener.current = e.currentTarget; setDeploy(true); }}>Your deploy <span aria-hidden>↗</span></button>
        </div>
      </nav>
      {deploy && <VisitDeploy opener={opener.current} onClose={() => setDeploy(false)} />}
    </>
  );
}
