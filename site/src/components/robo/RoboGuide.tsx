'use client';
import { memo, useEffect, useRef, useState } from 'react';
import { chapters } from '@/content/site';
import { appStore } from '@/lib/appState';
import { useStore } from '@/lib/store';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useScrollFrame } from '@/lib/useScrollFrame';
import { currentIndex } from '@/lib/dial';
import { doorsTimed } from '@/lib/transitions/doors';
import { EGGS, initialBrain, pendingDue, think, type BrainState, type ChapterId, type Gag, type RoboEvent, type Say } from '@/lib/robo/brain';
import { loadRobo, saveRobo } from '@/lib/robo/persist';
import { cardBox, cardWidths, choose, readMs, spots, type Box } from '@/lib/robo/place';
import { isLite } from '@/lib/tier';
import { crosses, gaitFor, margins, pickPerch, route, travelMs, type Perch, type Pt } from '@/lib/robo/roam';
import { onRobo, emitRobo } from '@/lib/robo/bus';
import { gagMood, type Mood } from '@/lib/robo/moods';
import { RoboChibi } from './RoboChibi';
import { goFastLane } from '@/lib/fastLane';
import { useRoboSignals } from './useRoboSignals';
import { cancelFrame, nextFrame } from '@/lib/frame';
import s from './RoboGuide.module.css';

const FADE_MS = 400, GAG_MS = 2000, GIVE_UP_MS = 6000, NUDGE_MS = 600, LISTEN_MS = 2500;
/** hide: how long he stands sad with the goodbye line before shuffling off; back: how long the happy jump lasts */
const SAD_MS = 1600, JUMP_MS = 700;
/** Scroll quiet this long = settled: Robo re-picks his perch. Content entering after an arrival is re-checked later. */
const SETTLE_MS = 250, RECHECK_MS = 1200, SCAN_TTL_MS = 10000, SPEED_WINDOW_MS = 1500, BEAM_MS = 220;
type Line = { text: string; link?: Say['link']; ch: number; k: number; announce: boolean };

function channelNow(): number {
  if (typeof document === 'undefined') return 1;
  const tops = chapters.map((c) => document.getElementById(c.id)?.getBoundingClientRect().top ?? Infinity);
  return currentIndex(tops, innerHeight) + 1;
}

type Vis = (o?: Record<string, boolean>) => boolean;
const visible = (el: Element | null) => {
  if (!el) return false;
  const cv = (el as Element & { checkVisibility?: Vis }).checkVisibility;
  if (cv) return cv.call(el, { opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true });
  const st = getComputedStyle(el);
  return st.visibility !== 'hidden' && st.opacity !== '0';
};
/** Elements with a running animation/transition: text under one that is invisible now is about to appear (a reveal). */
const animating = (): Set<Element> => {
  const out = new Set<Element>();
  if (typeof document.getAnimations !== 'function') return out;
  for (const a of document.getAnimations()) {
    const tg = a.playState === 'running' ? (a.effect as KeyframeEffect | null)?.target : null;
    if (tg) out.add(tg);
  }
  return out;
};
const revealing = (el: Element | null, anim: Set<Element>) => {
  if (!anim.size) return false;
  for (let e = el; e; e = e.parentElement) {
    if (anim.has(e)) return getComputedStyle(el!).visibility !== 'hidden';
  }
  return false;
};
const onScreen = (r: Box & { width: number; height: number }) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

/** Text nodes on the page outside Robo himself: chapters, HUD readouts, the Dial's labels. Chapters far off screen are
 *  not walked at all (measuring every text run on the page cost ~100 ms on a weak PC, in the frame the site opens). */
function textNodes(skip: Element | null): Text[] {
  const out: Text[] = [];
  if (!document.body) return out;
  const main = document.querySelector('main'), vh = innerHeight;
  const far = (el: Element) => { const r = el.getBoundingClientRect(); return r.bottom < -vh / 2 || r.top > vh * 1.5; };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => {
      if (skip && skip.contains(n)) return NodeFilter.FILTER_REJECT;
      if (n.nodeType !== Node.TEXT_NODE) return n.parentElement === main && far(n as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue && n.nodeValue.trim()) out.push(n as Text);
  return out;
}

/** Everything Robo and his card must never cover: every visible run of text, panels, media, the Dial, and HUD
 *  decorations with no text in them (marked data-robo-avoid, e.g. the ALT ruler). */
function obstacles(skip: Element | null): Box[] {
  const out: Box[] = [], range = document.createRange(), anim = animating();
  for (const t of textNodes(skip)) {
    range.selectNodeContents(t);
    const r = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : t.parentElement?.getBoundingClientRect();
    // screen-reader-only text is a 1 px box: not something anyone sees. A glyph taller than the screen (the hero's
    // zoom through the "O") is a backdrop, not text to read: it would leave him nowhere to stand.
    const backdrop = r && r.height > innerHeight;
    if (r && r.width > 2 && r.height > 2 && !backdrop && onScreen(r) && (visible(t.parentElement) || revealing(t.parentElement, anim))) out.push(r);
  }
  for (const el of document.querySelectorAll('main [data-panel], main img, main video, main figure, [data-dial], [data-robo-avoid]')) {
    const r = el.getBoundingClientRect();
    if (onScreen(r) && visible(el)) out.push(r);
  }
  return out;
}

// plain click remembers the place, then goes; modified clicks (new tab) keep the real href
function laneClick(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  goFastLane();
}

/** The line's text, with the "Fast lane" part turned into the link when the line carries one. */
function LineText({ line, plain }: { line: Line; plain?: boolean }) {
  if (line.link !== 'fastLane') return <>{line.text}</>;
  const at = line.text.indexOf('Fast lane');
  const before = at >= 0 ? line.text.slice(0, at) : `${line.text} `;
  const label = at >= 0 ? line.text.slice(at) : 'Fast lane →';
  if (plain) return <>{before}<span className={s.lane}>{label}</span></>;
  return <>{before}<a className={s.lane} href="/fast-lane/" onClick={laneClick}>{label}</a></>;
}

/** The card's inside (header + line). Also used, unlinked, for the measuring copies. */
function CardBody({ line, plain }: { line: Line; plain?: boolean }) {
  return (
    <>
      <div className={s.head} aria-hidden>
        <span className={s.dot} />
        <span data-robo-channel={plain ? undefined : ''}>{`ROBO · CH-${String(line.ch).padStart(2, '0')}`}</span>
        <span className={s.bars}><b /><b /><b /><b /></span>
      </div>
      <p className={s.text} data-robo-text={plain ? undefined : ''} aria-hidden={plain || !line.announce ? true : undefined}><LineText line={line} plain={plain} /></p>
    </>
  );
}

type CardProps = { line: Line; onHold(): void; onFree(): void };
/** The card on screen. Memoised: only a new line re-renders it, nothing else the guide does. */
const Card = memo(function Card({ line, onHold, onFree }: CardProps) {
  return (
    <div
      className={s.card} data-robo-card=""
      onPointerEnter={onHold} onPointerLeave={onFree}
      onFocus={onHold}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onFree(); }}
    >
      <CardBody line={line} />
      <span className={s.carrier} aria-hidden />
    </div>
  );
});

/** Hidden copies of the card at every width it may get, rendered with the line: the guide reads all their sizes in one
 *  layout pass instead of resizing the real card and measuring it again and again. */
const Measure = memo(function Measure({ line, widths }: { line: Line; widths: number[] }) {
  return (
    <div className={s.measure} aria-hidden inert>
      {widths.map((w) => (
        <div key={w} className={s.measureAt} style={{ maxWidth: w }} data-robo-measure={w}>
          <div className={s.card}><CardBody line={line} plain /></div>
        </div>
      ))}
    </div>
  );
});


type Ctl = { perch(): void; scrolled(y: number): void; pause(): void; resume(): void; end(): void };
type Move = 'idle' | 'sit' | 'walk' | 'run' | 'sad' | 'sadWalk' | 'jump';
/** here = on screen; leaving = the sad goodbye and walk-off; gone = hidden, only the edge tab shows */
type Phase = 'here' | 'leaving' | 'gone';
type Tab = { edge: 'left' | 'right'; y: number };

/** Robo, the site-wide guide: roams to empty space on each screen and speaks one line at a time in a
 *  radio-transmission card that always opens right beside him. */
export function RoboGuide() {
  useRoboSignals();
  const entered = useStore(appStore, (x) => x.entered);
  const reduce = useReducedMotion();
  const brain = useRef<BrainState | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [on, setOn] = useState(false);
  const [live, setLive] = useState('');
  const [gag, setGag] = useState<Gag | null>(null);
  const [hushed, setHushed] = useState(false);
  const [eggs, setEggs] = useState(0);
  const [sparks, setSparks] = useState(0);
  const [phone, setPhone] = useState(false);
  const [away, setAway] = useState(false);
  const [paused, setPaused] = useState(false);
  const [move, setMove] = useState<Move>('idle');
  const [phase, setPhase] = useState<Phase>('here');
  const [tab, setTab] = useState<Tab | null>(null);
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [gait, setGait] = useState(0.62);
  const awayRef = useRef(false);
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const rootRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const ctl = useRef<Ctl | null>(null);
  // stable handlers, so the memoised card does not re-render when the guide does
  const hold = useRef(() => ctl.current?.pause()).current;
  const free = useRef(() => ctl.current?.resume()).current;

  const getBrain = () => {
    if (!brain.current) brain.current = initialBrain(loadRobo(undefined, typeof location === 'undefined' ? '' : location.search));
    return brain.current;
  };

  useEffect(() => {
    const b0 = getBrain();
    setHushed(b0.hushed);
    // hidden from a previous visit: straight to the tab, no goodbye
    let phase: Phase = b0.hushed ? 'gone' : 'here';
    setPhase(phase);
    setEggs(b0.eggs.length);
    type T = ReturnType<typeof setTimeout> | 0;
    const t = { hide: 0 as T, clear: 0 as T, gag: 0 as T, fallback: 0 as T, release: 0 as T, arrive: 0 as T, settle: 0 as T, recheck: 0 as T, nudge: 0 as T, leave: 0 as T };
    const stop = (k: keyof typeof t) => { if (t[k]) clearTimeout(t[k]); t[k] = 0; };
    // the card on screen: its text, whether its reading timer has started, is held (hover/focus), time left
    // sizes: the card measured at each max width (keyed by width and screen size), kept for the line so trying many
    // perches does not re-measure (each measure forces a layout)
    // fit: there is room for it beside Robo right now (it is only ever shown when there is)
    const card = { text: '', ch: 0, up: false, started: false, held: false, fit: false, left: 0, deadline: 0, spot: '', stowed: false, sizes: new Map<string, { w: number; h: number }>() };
    // where Robo stands (top-left of his box, viewport px; NaN until first placed) and the scroll speed lately
    const me = { x: NaN, y: NaN, peek: false, moving: false, scrolling: false }, leg = { x: NaN, y: NaN }; // leg = the stop he is heading to right now
    const speed = { y: NaN, t: 0, peak: 0, at: -Infinity };
    // obstacle boxes, measured once per settled scroll position (and screen size), not on every frame
    const scan = { key: '', at: -Infinity, boxes: [] as Box[] };
    // content reveals are listened for only just after an arrival / settle / new line (and while a line waits for
    // room): the page's own endless animations must not trigger scans the rest of the time
    let listenUntil = -Infinity;
    const listen = () => { listenUntil = Date.now() + LISTEN_MS; };
    // hide / come back: the edge he left by (and how high), whether he is mid walk-off, and the jump's end
    let tabAt: Tab | null = null, walkingOff = false, holdUntil = 0;
    let k = 0;

    const step = (e: RoboEvent) => {
      const prev = getBrain();
      const { state, say } = think(prev, e, Date.now());
      brain.current = state;
      if (state.seen !== prev.seen || state.eggs !== prev.eggs || state.hushed !== prev.hushed) saveRobo(state);
      setHushed(state.hushed);
      setEggs(state.eggs.length);
      if (state.hushed !== prev.hushed) { if (state.hushed) leave(); else back(); }
      if (say) show(say, e);
      if (!state.cardUp) scheduleRelease();
    };

    // A chapter line held back (gap or card up) is offered again once the gap is over and no card is up.
    const scheduleRelease = () => {
      const due = pendingDue(getBrain());
      stop('release');
      if (due === null || card.up) return;
      t.release = setTimeout(() => dispatch({ type: 'release', current: `c${channelNow()}` as ChapterId }), Math.max(0, due - Date.now()));
    };

    // The reading clock runs only while the card is actually readable: up, shown (room beside Robo, not tucked away)
    // and not held by hover/focus. Otherwise it is stopped with the time left kept.
    const sync = () => {
      const go = card.up && card.started && card.fit && !card.stowed && !card.held;
      if (go && !t.hide) { card.deadline = Date.now() + card.left; t.hide = setTimeout(end, card.left); }
      if (!go && t.hide) { stop('hide'); card.left = Math.max(0, card.deadline - Date.now()); }
    };
    const start = () => {
      if (card.started) return;
      card.started = true;
      card.left = readMs(card.text);
      const b = bubbleRef.current;
      if (b) { b.style.setProperty('--read', `${card.left}ms`); b.dataset.run = 'true'; }
      sync();
    };
    const pause = () => {
      if (!card.up || card.held) return;
      card.held = true;
      if (bubbleRef.current) bubbleRef.current.dataset.held = 'true';
      sync();
    };
    const resume = () => {
      if (!card.held) return;
      card.held = false;
      if (bubbleRef.current) delete bubbleRef.current.dataset.held;
      sync();
    };
    // Stowed = the card is tucked away (faded out) while Robo moves or the page scrolls under it, so it never slides
    // over content. Its reading clock stops while stowed and resumes, with the time left, once it is back.
    const stow = () => {
      const b = bubbleRef.current;
      if (!card.up || card.stowed) return;
      card.stowed = true;
      if (b) b.dataset.stow = 'true';
      sync();
    };
    const unstow = () => {
      if (!card.stowed || me.moving || me.scrolling) return;
      card.stowed = false;
      if (bubbleRef.current) bubbleRef.current.dataset.stow = 'false';
      sync();
    };
    const end = () => {
      stop('hide'); stop('fallback');
      if (!card.up) return;
      card.up = false; card.held = false; card.stowed = false; card.fit = false;
      if (bubbleRef.current) bubbleRef.current.dataset.stow = 'false';
      setOn(false);
      t.clear = setTimeout(() => setLine(null), FADE_MS);
      step({ type: 'card', up: false });
    };

    const seenObstacles = (fresh = false) => {
      const key = `${Math.round(scrollY)}|${innerWidth}|${innerHeight}`, now = Date.now();
      if (fresh || key !== scan.key || now - scan.at > SCAN_TTL_MS) Object.assign(scan, { key, at: now, boxes: obstacles(rootRef.current) });
      return scan.boxes;
    };
    // his size only changes at the phone breakpoint: read it once per screen width, never right after a write
    let sized = { vw: -1, w: 0, h: 0 };
    const roboSize = () => {
      if (sized.vw === innerWidth && sized.w) return { w: sized.w, h: sized.h };
      const r = rootRef.current?.getBoundingClientRect();
      const z = r && r.width && r.height ? { w: r.width, h: r.height } : innerWidth > 760 ? { w: 64, h: 78 } : { w: 46, h: 56 };
      sized = { vw: innerWidth, ...z };
      return z;
    };
    const boxAt = (p: Pt, sz = roboSize()): Box => ({ left: p.x, top: p.y, right: p.x + sz.w, bottom: p.y + sz.h });
    const home = (sz = roboSize()): Pt => ({ x: margins(innerWidth).side, y: innerHeight - margins(innerWidth).bottom - sz.h });
    const view = () => ({ w: innerWidth, h: innerHeight });

    // the card's best spot beside Robo standing at `at` (sizes measured on the real card at each max width)
    const fitAt = (at: Box, obs: Box[]) => {
      const b = bubbleRef.current, el = b?.querySelector<HTMLElement>('[data-robo-card]');
      if (!b || !el) return null;
      const list = spots(innerWidth, innerHeight, at);
      const sizeOf = (w: number) => {
        const sk = `${w}|${innerWidth}|${innerHeight}`;
        let z = card.sizes.get(sk);
        if (!z) {
          // layout size (offset*), not the on-screen box: the bubble's entry scale(.97) must not shrink what is kept.
          // The measuring copy at this width is read without writing anything (no layout thrash).
          const copy = rootRef.current?.querySelector<HTMLElement>(`[data-robo-measure="${w}"] > *`);
          if (copy && copy.offsetWidth) z = { w: copy.offsetWidth, h: copy.offsetHeight };
          else {
            b.style.maxWidth = `${w}px`;
            const r = el.getBoundingClientRect();
            z = { w: el.offsetWidth || r.width, h: el.offsetHeight || r.height };
          }
          card.sizes.set(sk, z);
        }
        return z;
      };
      const key = (sp: (typeof list)[number]) => `${sp.kind}|${sp.bottom}|${sp.maxW}`;
      const { i, clear } = choose(list, sizeOf, at, obs, Math.max(0, list.findIndex((sp) => key(sp) === card.spot)), view());
      return i < 0 ? null : { sp: list[i], size: sizeOf(list[i].maxW), clear, key: key(list[i]) };
    };

    // Put the card beside Robo in the first spot that covers no content. It is never shown over content: with no room
    // it waits out of sight (data-fit=false, reading clock stopped) until a re-check finds room; if none comes within
    // GIVE_UP_MS the line is dropped. All reads happen before the writes below.
    const place = (obs = seenObstacles()) => {
      const b = bubbleRef.current;
      if (!card.up || !b || Number.isNaN(me.x)) return;
      const at = boxAt(me), f = fitAt(at, obs);
      card.fit = !!f?.clear;
      if (f && f.clear) {
        const box = cardBox(f.sp, f.size, at);
        b.style.left = `${box.left - at.left}px`; b.style.bottom = `${at.bottom - box.bottom}px`; b.style.maxWidth = `${f.sp.maxW}px`;
        b.dataset.spot = f.sp.kind;
        card.spot = f.key;
      }
      b.dataset.fit = card.fit ? 'true' : 'false';
      b.inert = !card.fit;
      if (card.fit) { stop('fallback'); start(); }
      else if (!t.fallback) t.fallback = setTimeout(end, GIVE_UP_MS);
      sync();
    };

    // Walk (or run, if the visitor scrolled fast lately) to perch `p` along the band and gutters (route), facing the
    // way each leg goes; then rest: sit on the bottom band, stand elsewhere. The whole trip is timed by travelMs.
    // If any leg would sweep him across content, he does not walk through it: he beams (blinks out, reappears there).
    const go = (p: Perch, obs: Box[]) => {
      const root = rootRef.current;
      if (!root) return;
      const from = Number.isNaN(me.x) ? null : { x: leg.x, y: leg.y };
      if (Math.abs(me.x - p.x) < 1 && Math.abs(me.y - p.y) < 1) return;
      Object.assign(me, p);
      root.dataset.peek = p.peek ? 'true' : 'false';
      const band = innerHeight - margins(innerWidth).bottom - roboSize().h;
      const rest: Move = !p.peek && p.y >= band - 1 ? 'sit' : 'idle';
      const g = gaitFor(Date.now() - speed.at < SPEED_WINDOW_MS ? speed.peak : 0, isLite());
      const stops = from && !reduceRef.current ? route(from, p, band) : [p];
      const lens = stops.map((q, i) => { const a = i ? stops[i - 1] : from ?? q; return Math.hypot(q.x - a.x, q.y - a.y); });
      const dist = lens.reduce((a, b) => a + b, 0), total = from && !reduceRef.current ? travelMs({ x: 0, y: 0 }, { x: dist, y: 0 }, g.mood) : 0;
      stop('arrive');
      root.dataset.beam = 'false'; // a beam cut short by a newer trip must not leave him invisible
      me.moving = !!total;
      if (total) stow();
      const arrive = () => { me.moving = false; setMove(rest); unstow(); };
      if (from && total && crosses(from, stops, roboSize(), obs)) {
        Object.assign(leg, { x: p.x, y: p.y });
        root.dataset.beam = 'true';
        setMove('idle');
        t.arrive = setTimeout(() => {
          root.style.setProperty('--travel', '0ms');
          root.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
          t.arrive = setTimeout(() => { root.dataset.beam = 'false'; arrive(); }, 40);
        }, BEAM_MS);
        return;
      }
      const step = (i: number) => {
        const q = stops[i], ms = dist ? Math.round((total * lens[i]) / dist) : 0, a = i ? stops[i - 1] : from;
        Object.assign(leg, { x: q.x, y: q.y });
        root.style.setProperty('--travel', `${ms}ms`);
        root.style.transform = `translate(${Math.round(q.x)}px, ${Math.round(q.y)}px)`;
        if (a && Math.abs(q.x - a.x) >= 1) setFacing(q.x < a.x ? 'left' : 'right');
        t.arrive = setTimeout(() => (i + 1 < stops.length ? step(i + 1) : arrive()), ms);
      };
      if (total) { setGait(g.cycle); setMove(g.mood); } else setMove(rest);
      step(0);
    };

    // Pick a perch on this screen: the nearest spot where Robo covers nothing and, while a line is up, where his card
    // fits beside him too. If no spot holds both, he still stands clear and the line waits (see place).
    // Stays put while a door jump runs or the CommandCenter scene has the stage.
    const perch = (fresh = false) => {
      if (!rootRef.current || awayRef.current || doorsTimed()) return;
      if (phase === 'gone' || walkingOff || Date.now() < holdUntil) return;
      const obs = seenObstacles(fresh), sz = roboSize(), prefer = Number.isNaN(me.x) ? home(sz) : { x: me.x, y: me.y };
      const fits = (q: Pt) => !!fitAt(boxAt(q, sz), obs)?.clear;
      let p = pickPerch(obs, innerWidth, innerHeight, sz, prefer, card.up ? fits : undefined);
      if (card.up && p.peek && !fits(p)) p = pickPerch(obs, innerWidth, innerHeight, sz, prefer);
      go(p, obs);
      place(obs);
      // still on the move (or the page still scrolling): the card stays tucked away until he has arrived
      if (me.moving) stow(); else unstow();
    };

    // Hide: he looks sad and says goodbye (the hush line), then shuffles off to the nearest side edge and the edge tab
    // takes his place. Reduced motion: no walk, the tab simply replaces him.
    const leave = () => {
      const root = rootRef.current;
      phase = 'leaving'; setPhase('leaving');
      stop('arrive'); stop('leave'); me.moving = false;
      setMove('sad');
      t.leave = setTimeout(() => {
        end();
        const sz = roboSize(), h0 = home(sz), x0 = Number.isNaN(leg.x) ? h0.x : leg.x, y = Number.isNaN(leg.y) ? h0.y : leg.y;
        const toLeft = x0 + sz.w / 2 < innerWidth / 2, x = toLeft ? -sz.w - 6 : innerWidth + 6;
        tabAt = { edge: toLeft ? 'left' : 'right', y: Math.round(y + sz.h / 2) };
        const ms = reduceRef.current || !root ? 0 : Math.round(travelMs({ x: x0, y }, { x, y }, 'walk') * 1.4);
        const gone = () => { walkingOff = false; phase = 'gone'; setPhase('gone'); setTab(tabAt); setMove('idle'); };
        walkingOff = true;
        if (ms && root) {
          setFacing(toLeft ? 'left' : 'right'); setGait(1); setMove('sadWalk');
          root.style.setProperty('--travel', `${ms}ms`);
          root.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        }
        Object.assign(me, { x, y, peek: true }); Object.assign(leg, { x, y });
        t.leave = setTimeout(gone, ms);
      }, SAD_MS);
    };

    // Back (the tab, or pressing hush again): he pops in at the edge he left by with a happy jump, then finds a spot.
    const back = () => {
      const root = rootRef.current;
      stop('leave'); walkingOff = false;
      phase = 'here'; setPhase('here'); setTab(null);
      const sz = roboSize(), h0 = home(sz), tb = tabAt ?? { edge: 'left', y: h0.y + sz.h / 2 };
      const x = tb.edge === 'left' ? -sz.w / 2 : innerWidth - sz.w / 2;
      const y = Math.max(72, Math.min(h0.y, tb.y - sz.h / 2));
      if (root) { root.style.setProperty('--travel', '0ms'); root.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; }
      Object.assign(me, { x, y, peek: true, moving: false }); Object.assign(leg, { x, y });
      holdUntil = Date.now() + JUMP_MS;
      setMove('jump');
      t.leave = setTimeout(() => { holdUntil = 0; setMove('idle'); perch(true); }, JUMP_MS);
    };

    // content can still be coming in (reveal animations, fonts) after an arrival: look again once, fresh
    const recheck = () => { listen(); stop('recheck'); t.recheck = setTimeout(() => perch(true), RECHECK_MS); };

    // every scroll frame: note the speed; once it has been quiet for SETTLE_MS, re-perch
    const scrolled = (y: number) => {
      const now = performance.now();
      if (!Number.isNaN(speed.y) && now > speed.t && y !== speed.y) {
        const v = (Math.abs(y - speed.y) / (now - speed.t)) * 1000;
        if (v > speed.peak || Date.now() - speed.at > SPEED_WINDOW_MS) { speed.peak = v; speed.at = Date.now(); }
      }
      // the page moved under a card that is up: tuck it away now (once, not per frame) and bring it back after re-perching
      if (!Number.isNaN(speed.y) && y !== speed.y && card.up) { me.scrolling = true; stow(); }
      speed.y = y; speed.t = now;
      stop('settle');
      t.settle = setTimeout(() => { me.scrolling = false; perch(); recheck(); }, SETTLE_MS);
    };

    const show = (say: Say, e: RoboEvent) => {
      const ch = e.type === 'chapter' ? Number(e.id.slice(1)) : channelNow();
      stop('hide'); stop('clear'); stop('fallback');
      Object.assign(card, { text: say.text, ch, up: true, started: false, held: false, fit: false, spot: '', stowed: false, sizes: new Map() });
      const b = bubbleRef.current;
      if (b) { b.dataset.run = 'false'; delete b.dataset.held; b.dataset.fit = 'false'; b.dataset.stow = 'false'; }
      setLine({ text: say.text, link: say.link, ch, k: ++k, announce: say.announce });
      setOn(true);
      t.fallback = setTimeout(end, GIVE_UP_MS);
      if (say.announce) setLive(say.text);
      if (say.gag !== 'none') {
        stop('gag');
        setGag(say.gag);
        t.gag = setTimeout(() => setGag(null), GAG_MS);
      }
      if (e.type === 'egg') setSparks((n) => n + 1);
      step({ type: 'card', up: true });
    };

    const dispatch = (e: RoboEvent) => {
      // Some emitters (HUD label, OG seal, radar, blob) are not gated themselves: nothing counts before entry.
      if (!appStore.get().entered) return;
      // A Dial / number-key jump passes chapters behind the doors: only the landing one, after the jump, may speak.
      if (e.type === 'chapter' && doorsTimed()) return;
      // In the CommandCenter scene the scene's own Robo talks; the guide only keeps counting eggs and takes hush.
      if (awayRef.current && e.type !== 'egg' && e.type !== 'hush') return;
      // the visitor has moved on: a card still up from another chapter (or one a door jump is about to leave) goes now,
      // so an old chapter's line never resumes on the new screen
      if (card.up && (e.type === 'jump' || (e.type === 'chapter' && Number(e.id.slice(1)) !== card.ch))) end();
      // a new screen: find an empty spot on it now, and look again once its content has finished coming in
      if (e.type === 'chapter') { perch(true); recheck(); }
      step(e);
    };

    // Content that starts or finishes animating (a reveal, a panel opening) may change what is free: look again, fresh,
    // at most once per NUDGE_MS. Event-driven, nothing polls; only page content counts, and only while listening.
    let nudgeAt = -Infinity;
    const nudge = (e: Event) => {
      const tg = e.target as Element | null;
      if (!rootRef.current || me.scrolling || t.nudge) return;
      if (Date.now() > listenUntil && !(card.up && !card.fit)) return;
      if (!tg || typeof tg.closest !== 'function' || !tg.closest('main, [data-dial]')) return;
      const wait = Math.max(0, nudgeAt + NUDGE_MS - Date.now());
      t.nudge = setTimeout(() => { t.nudge = 0; nudgeAt = Date.now(); perch(true); }, Math.max(120, wait));
    };
    const kinds = ['transitionrun', 'transitionend', 'animationstart', 'animationend'] as const;
    kinds.forEach((k) => document.addEventListener(k, nudge, { capture: true, passive: true }));

    ctl.current = {
      perch: () => perch(),
      scrolled,
      pause, resume, end,
    };
    const off = onRobo(dispatch);
    return () => {
      off();
      kinds.forEach((k) => document.removeEventListener(k, nudge, { capture: true }));
      (Object.keys(t) as (keyof typeof t)[]).forEach(stop);
      ctl.current = null;
    };
  }, []);

  // Robo mounts on his home spot (the CSS transform, where the intro left him), then picks his perch two frames later:
  // the site opening is the heaviest commit of the visit, and scanning the page for text inside it made one ~100 ms
  // frame on a weak PC
  useEffect(() => {
    if (!entered) return;
    let id = 0;
    id = nextFrame(() => { id = nextFrame(() => ctl.current?.perch()); });
    return () => cancelFrame(id);
  }, [entered]);
  // The card and its measuring copies mount on the render after a line is set (hidden: data-fit=false). Placing it waits
  // for the next frame, so this commit's DOM writes and the reads that placing needs never share a frame.
  useEffect(() => {
    if (!on || !line) return;
    // two frames: the first paints the new (hidden) card, the second measures and places it
    let id = 0;
    id = nextFrame(() => { id = nextFrame(() => ctl.current?.perch()); });
    return () => cancelFrame(id);
  }, [on, line]);

  // pause CSS loops while the tab is hidden; the chibi is smaller on phones
  useEffect(() => {
    const vis = () => setPaused(document.visibilityState === 'hidden');
    vis();
    document.addEventListener('visibilitychange', vis);
    const mq = typeof matchMedia === 'function' ? matchMedia('(max-width: 760px)') : null;
    const small = () => setPhone(!!mq?.matches);
    small();
    mq?.addEventListener?.('change', small);
    return () => { document.removeEventListener('visibilitychange', vis); mq?.removeEventListener?.('change', small); };
  }, []);

  // CommandCenter handoff: while #sc-cc holds the middle of the screen, the guide steps aside.
  useScrollFrame(() => {
    const el = document.getElementById('sc-cc');
    let a = false;
    if (el) { const r = el.getBoundingClientRect(), mid = innerHeight * 0.5; a = r.top < mid && r.bottom > mid; }
    if (a !== awayRef.current) { awayRef.current = a; setAway(a); if (a) ctl.current?.end(); }
    ctl.current?.scrolled(scrollY);
  });

  // on the move his legs win; a gag plays once he has arrived (if it is still on)
  // on the move (or saying goodbye / jumping back) his body is busy; otherwise a gag's pose shows
  const busy = move === 'walk' || move === 'run' || move === 'sad' || move === 'sadWalk' || move === 'jump';
  const mood: Mood = busy || !gag ? move : gagMood(gag);
  const tabNow: Tab = tab ?? { edge: 'left', y: typeof window === 'undefined' ? 0 : innerHeight - (phone ? 22 + 28 : 44 + 39) };
  const widths = typeof window === 'undefined' ? [] : cardWidths(innerWidth);
  if (!entered) return null;
  return (
    <>
    <div
      className={s.root}
      ref={rootRef}
      data-robo-guide=""
      data-mood={mood}
      data-gag={gag ?? undefined}
      data-reduce={reduce ? 'true' : undefined}
      data-away={away ? 'true' : undefined}
      data-hushed={hushed ? 'true' : undefined}
      data-paused={paused ? 'true' : undefined}
      data-phase={phase}
      inert={away || phase === 'gone'}
    >
      <div
        className={s.bubble}
        ref={bubbleRef}
        data-robo-bubble=""
        data-on={on ? 'true' : 'false'}
        inert={!on}
      >
        <span className={s.waves} aria-hidden><i /><i /><i /></span>
        {line && <Card key={line.k} line={line} onHold={hold} onFree={free} />}
      </div>
      {line && <Measure key={line.k} line={line} widths={widths} />}
      <button
        type="button"
        className={s.bot}
        data-robo=""
        aria-label={hushed ? 'Robo is muted. Press to unmute.' : 'Robo, your guide. Press to mute.'}
        aria-describedby="robo-hint"
        onClick={() => emitRobo({ type: 'hush' })}
      >
        <span className={s.body}>
          <RoboChibi mood={mood} facing={facing} gait={gait} size={phone ? 56 : 78} sparks={sparks} />
          <svg className={s.paint} viewBox="-6 -8 76 92" aria-hidden>
            <path d="M14 18c4-6 12-5 15-1 3-5 13-6 17 0 5-2 10 2 9 8 4 3 3 9-1 11l1 9c0 3-3 3-3 0l-1-6-4 2 0 12c0 3-3 3-3 0l-1-11-8 1 0 6c0 3-3 3-3 0l0-6-7-1-1 8c0 3-3 3-3 0l0-10c-5-2-7-7-4-11-3-4 0-10 5-11z" />
          </svg>
        </span>
      </button>
      <button
        type="button"
        className={s.hide}
        data-robo-hide=""
        aria-label="Hide Robo"
        onClick={() => { if (!getBrain().hushed) emitRobo({ type: 'hush' }); }}
      ><span aria-hidden>hide</span></button>
      <span id="robo-hint" className="sr-only">Press R anywhere to open the fast lane.</span>
      {eggs >= 1 && <span className={s.eggs} data-robo-eggs="">{`${eggs} / ${EGGS.length} found`}</span>}
    </div>
    {phase === 'gone' && (
      <button
        type="button"
        className={s.tab}
        data-robo-tab=""
        data-edge={tabNow.edge}
        aria-label="Bring Robo back"
        style={{ top: tabNow.y }}
        onClick={() => emitRobo({ type: 'hush' })}
      ><i data-eye="" /><i data-eye="" /></button>
    )}
    {/* outside the root: still announced while the guide steps aside (inert) in the CommandCenter scene */}
    <span className="sr-only" aria-live="polite" data-robo-live="">{live}</span>
    </>
  );
}
