'use client';
import { useEffect, useRef } from 'react';
import { zoneValue, pickDoor, doorShift, isShut, meterLit, sectorDigits, lockText, setDoorsHandle, doorsTimed, type DoorLabel } from '@/lib/transitions/doors';
import { useScrollFrame } from '@/lib/useScrollFrame';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { sfx } from '@/lib/sound';
import s from './BlastDoors.module.css';

export function BlastDoors() {
  const root = useRef<HTMLDivElement>(null), top = useRef<HTMLDivElement>(null), bot = useRef<HTMLDivElement>(null);
  const seam = useRef<HTMLDivElement>(null), lock = useRef<HTMLDivElement>(null);
  const sec = useRef<HTMLSpanElement>(null), num = useRef<HTMLDivElement>(null), name = useRef<HTMLDivElement>(null), state = useRef<HTMLSpanElement>(null);
  const meter = useRef<(HTMLElement | null)[]>([]);
  const shut = useRef(false);
  const zones = useRef<HTMLElement[] | null>(null); // door zones are static: cached, refreshed on resize
  const reduce = useReducedMotion();
  const reduceRef = useRef(reduce); reduceRef.current = reduce;

  const set = (pos: number, label: DoorLabel | null, unlocked: boolean) => {
    if (!top.current || !bot.current || !root.current) return;
    if (reduceRef.current) { root.current.style.opacity = String(pos); top.current.style.transform = bot.current.style.transform = 'none'; }
    else { root.current.style.opacity = '1'; const d = doorShift(pos); top.current.style.transform = d.top; bot.current.style.transform = d.bottom; }
    if (label) { sec.current!.textContent = label.sector; num.current!.textContent = sectorDigits(label.sector); name.current!.textContent = label.name; }
    const sh = isShut(pos);
    seam.current!.style.opacity = lock.current!.style.opacity = sh ? '1' : '0';
    lock.current!.textContent = lockText(unlocked); lock.current!.dataset.open = String(unlocked);
    state.current!.textContent = unlocked ? 'opening' : 'sealing';
    meter.current.forEach((m, k) => m?.classList.toggle(s.on, k < meterLit(pos)));
    if (sh && !shut.current) {
      shut.current = true; sfx.clunk();
      if (!reduceRef.current) [top.current, bot.current].forEach((d, k) => d.animate?.([{ translate: '0 0' }, { translate: `0 ${k ? 3 : -3}px` }, { translate: '0 0' }], { duration: 180 }));
    }
    if (!sh) shut.current = false;
  };
  useEffect(() => { setDoorsHandle({ set }); return () => setDoorsHandle(null); }, []);
  useEffect(() => { const clear = () => { zones.current = null; }; addEventListener('resize', clear); return () => removeEventListener('resize', clear); }, []);
  useScrollFrame(() => {
    if (doorsTimed()) return;
    if (!zones.current?.length) zones.current = [...document.querySelectorAll<HTMLElement>('[data-door-zone]')];
    const zs = zones.current.map((z) => { const r = z.getBoundingClientRect();
      return { v: zoneValue(r.top, r.height, innerHeight), label: { sector: z.dataset.sector!, name: z.dataset.name! } }; });
    const d = pickDoor(zs); set(d.pos, d.label, d.unlocked);
  });
  return (
    <>
      <div ref={root} className={s.doors} aria-hidden>
        <div ref={top} data-door="top" className={`${s.door} ${s.top}`}><div className={s.rivets} /><div className={s.hz} />
          <div ref={name} className={s.name}>Missions</div>
          <div className={s.lab}><b>SECTOR <span ref={sec}>04</span></b> · bulkhead A · YOGX mission control</div>
          <div ref={num} className={s.num}>04</div>
          <div className={s.meter}>SEAL {[0, 1, 2, 3, 4].map((k) => <i key={k} ref={(e) => { meter.current[k] = e; }} />)}</div></div>
        <div ref={bot} data-door="bot" className={`${s.door} ${s.bot}`}><div className={s.hz} /><div className={s.rivets} />
          <div className={s.lab}>Pressure nominal · bulkhead B · <span ref={state}>sealing</span></div>
          <div className={s.meter} style={{ top: 'auto', bottom: 62 }}>O₂ <i className={s.on} /><i className={s.on} /><i className={s.on} /><i className={s.on} /><i /></div></div>
      </div>
      <div ref={seam} data-seam className={s.seam} aria-hidden />
      <div ref={lock} data-lock className={s.lock} aria-hidden>⛒ SEALED</div>
    </>
  );
}
