import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({ timed: false }));
vi.mock('@/components/robo/useRoboSignals', () => ({ useRoboSignals: () => {} }));
vi.mock('@/lib/transitions/doors', () => ({ doorsTimed: () => h.timed }));
// placing a new card waits for the next animation frame in the browser; here it happens at once
vi.mock('@/lib/frame', () => ({ nextFrame: (fn: () => void) => { fn(); return 0; }, cancelFrame: () => {} }));

import { RoboGuide } from '@/components/robo/RoboGuide';
import { appStore } from '@/lib/appState';
import { emitRobo } from '@/lib/robo/bus';
import type { RoboEvent } from '@/lib/robo/brain';
import { CHAPTER_LINES, HUSH_ON, HUSH_OFF, REACT, EGG_FOUND } from '@/content/robo-script';
import { readMs } from '@/lib/robo/place';
import { flushScrollFrame } from '@/lib/useScrollFrame';

const stubMotion = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
const enter = () => act(() => { appStore.set({ entered: true }); });
const emit = (e: RoboEvent) => act(() => { emitRobo(e); });
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const q = (c: HTMLElement, sel: string) => c.querySelector(sel) as HTMLElement | null;
const text = (c: HTMLElement) => q(c, '[data-robo-bubble] [data-robo-text]')?.textContent ?? '';

describe('RoboGuide', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    localStorage.clear();
    h.timed = false;
    appStore.set({ entered: false });
    stubMotion(false);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); appStore.set({ entered: false }); });

  it('shows nothing before the visitor has entered, and ignores bus events until then', () => {
    const { container } = render(<RoboGuide />);
    expect(q(container, '[data-robo]')).toBeNull();
    emit({ type: 'chapter', id: 'c1' });
    emit({ type: 'egg', id: 'prod2' });
    enter();
    expect(q(container, '[data-robo]')).not.toBeNull();
    expect(text(container)).toBe('');
    expect(q(container, '[data-robo-eggs]')).toBeNull();
    // c1 was not consumed before entry: it still speaks now
    emit({ type: 'chapter', id: 'c1' });
    expect(text(container)).toContain('Namaste! Main Robo.');
  });

  it('a plain click on the fast lane link saves the place; a ctrl-click leaves the real link alone', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign, search: '' });
    sessionStorage.clear();
    const { container } = render(<RoboGuide />);
    enter();
    emit({ type: 'chapter', id: 'c1' });
    const a = container.querySelector('a[href="/fast-lane/"]') as HTMLElement;
    fireEvent.click(a, { ctrlKey: true });
    expect(assign).not.toHaveBeenCalled();
    fireEvent.click(a);
    expect(assign).toHaveBeenCalledWith('/fast-lane/');
    expect(sessionStorage.getItem('yogx:return')).not.toBeNull();
  });

  it('chapter line shows in the bubble with a fast lane link and goes to the live region; the next line waits; the card clears after its reading time', () => {
    const { container } = render(<RoboGuide />);
    enter();
    emit({ type: 'chapter', id: 'c1' });
    const bubble = q(container, '[data-robo-bubble]')!;
    expect(text(container)).toBe(CHAPTER_LINES.c1);
    expect(bubble.getAttribute('data-on')).toBe('true');
    expect(bubble.querySelector('a[href="/fast-lane/"]')).not.toBeNull();
    expect(q(container, '[data-robo-live]')!.getAttribute('aria-live')).toBe('polite');
    expect(q(container, '[data-robo-live]')!.textContent).toBe(CHAPTER_LINES.c1);
    expect(q(container, '[data-robo-channel]')!.textContent).toBe('ROBO · CH-01');

    // up for its reading time: max(6 s, 2.5 s + 75 ms per character)
    wait(readMs(CHAPTER_LINES.c1!) - 1);
    expect(bubble.getAttribute('data-on')).toBe('true');
    wait(1);
    expect(bubble.getAttribute('data-on')).toBe('false');
    wait(600);
    expect(text(container)).toBe('');
    expect(q(container, '[data-robo-live]')!.textContent).toBe(CHAPTER_LINES.c1);
  });

  it('moving on to the next chapter ends the old card; the new line waits out the gap and is dropped if the visitor left', () => {
    const { container } = render(<RoboGuide />);
    enter();
    emit({ type: 'chapter', id: 'c1' });
    const bubble = q(container, '[data-robo-bubble]')!;
    wait(2000);
    emit({ type: 'chapter', id: 'c2' });
    expect(bubble.getAttribute('data-on')).toBe('false'); // c1's card goes at once
    wait(600);
    expect(text(container)).toBe('');
    wait(8000);
    expect(text(container)).toBe(''); // c2 was held, but the visitor is no longer in c2: dropped
  });

  describe('hide button and edge tab', () => {
    const tab = (c: HTMLElement) => q(c, '[data-robo-tab]');

    it('hide: sad line, sad walk to the nearest edge, then a tab with two eyes; storage remembers', () => {
      const { container } = render(<RoboGuide />);
      enter();
      const root = q(container, '[data-robo-guide]')!, hide = q(container, '[data-robo-hide]')!;
      expect(hide.tagName).toBe('BUTTON');
      expect(hide.getAttribute('aria-label')).toBe('Hide Robo');
      expect(hide.textContent).toContain('hide');
      fireEvent.click(hide);
      expect(text(container)).toBe(HUSH_ON);
      expect(HUSH_ON).toBe('Theek hai… main chala jaata hoon.');
      expect(root.getAttribute('data-mood')).toBe('sad');
      expect(JSON.parse(localStorage.getItem('yogx:robo')!).hushed).toBe(true);
      expect(tab(container)).toBeNull();
      wait(1600);
      expect(root.getAttribute('data-mood')).toBe('sadWalk');
      expect(q(container, '[data-chibi]')!.getAttribute('data-facing')).toBe('left'); // home is on the left: the left edge
      expect(root.style.transform).toMatch(/^translate\(-\d+px, /);
      wait(2500);
      const t = tab(container)!;
      expect(t.tagName).toBe('BUTTON');
      expect(t.getAttribute('aria-label')).toBe('Bring Robo back');
      expect(t.getAttribute('data-edge')).toBe('left');
      expect(t.querySelectorAll('[data-eye]').length).toBe(2);
      expect(root.getAttribute('data-phase')).toBe('gone');
      expect(root.hasAttribute('inert')).toBe(true);
    });

    it('pressing Robo himself is the same as hide (the old mute stays as an alias)', () => {
      const { container } = render(<RoboGuide />);
      enter();
      const btn = q(container, '[data-robo]')!;
      expect(btn.getAttribute('aria-label')).toBe('Robo, your guide. Press to mute.');
      fireEvent.click(btn);
      expect(text(container)).toBe(HUSH_ON);
      expect(btn.getAttribute('aria-label')).toBe('Robo is muted. Press to unmute.');
      wait(4500);
      expect(tab(container)).not.toBeNull();
    });

    it('reload while hidden: the tab is there at once and no lines play', () => {
      localStorage.setItem('yogx:robo', JSON.stringify({ seen: [], eggs: [], hushed: true }));
      const { container } = render(<RoboGuide />);
      enter();
      expect(tab(container)).not.toBeNull();
      expect(q(container, '[data-robo-guide]')!.getAttribute('data-phase')).toBe('gone');
      emit({ type: 'chapter', id: 'c1' });
      expect(text(container)).toBe('');
    });

    it('the tab brings him back with a happy jump: "Wapas aa gaya!"', () => {
      localStorage.setItem('yogx:robo', JSON.stringify({ seen: [], eggs: [], hushed: true }));
      const { container } = render(<RoboGuide />);
      enter();
      fireEvent.click(tab(container)!);
      const root = q(container, '[data-robo-guide]')!;
      expect(tab(container)).toBeNull();
      expect(root.getAttribute('data-phase')).toBe('here');
      expect(root.hasAttribute('inert')).toBe(false);
      expect(root.getAttribute('data-mood')).toBe('jump');
      expect(q(container, '[data-robo]')!.getAttribute('aria-label')).toBe('Robo, your guide. Press to mute.');
      expect(JSON.parse(localStorage.getItem('yogx:robo')!).hushed).toBe(false);
      wait(800);
      expect(root.getAttribute('data-mood')).not.toBe('jump');
      expect(text(container)).toBe(HUSH_OFF);
      expect(q(container, '[data-robo-bubble]')!.getAttribute('data-fit')).toBe('true');
    });

    it('reduced motion: no walk-off, he is simply replaced by the tab after the line', () => {
      stubMotion(true);
      const { container } = render(<RoboGuide />);
      enter();
      fireEvent.click(q(container, '[data-robo-hide]')!);
      wait(1600);
      wait(1);
      expect(q(container, '[data-robo-guide]')!.getAttribute('data-mood')).not.toBe('sadWalk');
      expect(tab(container)).not.toBeNull();
    });
  });

  it('remembers mute and found eggs from storage', () => {
    localStorage.setItem('yogx:robo', JSON.stringify({ seen: ['c1'], eggs: ['og3', 'yogx'], hushed: true }));
    const { container } = render(<RoboGuide />);
    enter();
    expect(q(container, '[data-robo]')!.getAttribute('aria-label')).toBe('Robo is muted. Press to unmute.');
    expect(q(container, '[data-robo-eggs]')!.textContent).toBe('2 / 5 found');
  });

  it('a found egg shows the counter', () => {
    const { container } = render(<RoboGuide />);
    enter();
    expect(q(container, '[data-robo-eggs]')).toBeNull();
    emit({ type: 'egg', id: 'prod2' });
    expect(q(container, '[data-robo-eggs]')!.textContent).toBe('1 / 5 found');
    expect(text(container)).toContain('PROD2 ka raaz mat poochho.');
  });

  it('a gag is set on the root for 2 s, then removed', () => {
    const { container } = render(<RoboGuide />);
    enter();
    const root = q(container, '[data-robo-guide]')!;
    emit({ type: 'fastScroll' });
    expect(root.getAttribute('data-gag')).toBe('dizzy');
    wait(1999);
    expect(root.getAttribute('data-gag')).toBe('dizzy');
    wait(1);
    expect(root.hasAttribute('data-gag')).toBe(false);
  });

  it('gag lines are not announced to screen readers', () => {
    const { container } = render(<RoboGuide />);
    enter();
    emit({ type: 'fastScroll' });
    expect(text(container)).toContain('itna fast');
    expect(q(container, '[data-robo-live]')!.textContent).toBe('');
  });

  it('reduced motion marks the root', () => {
    stubMotion(true);
    const { container } = render(<RoboGuide />);
    enter();
    expect(q(container, '[data-robo-guide]')!.getAttribute('data-reduce')).toBe('true');
  });

  it('drops chapter arrivals while a door jump is running; the landing chapter speaks after', () => {
    const { container } = render(<RoboGuide />);
    enter();
    h.timed = true;
    emit({ type: 'chapter', id: 'c3' });
    expect(text(container)).toBe('');
    h.timed = false;
    emit({ type: 'chapter', id: 'c3' });
    expect(text(container)).toBe(CHAPTER_LINES.c3);
    expect(q(container, '[data-robo-channel]')!.textContent).toBe('ROBO · CH-03');
  });

  it('storage that throws changes nothing visible', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const { container } = render(<RoboGuide />);
    enter();
    emit({ type: 'chapter', id: 'c1' });
    expect(text(container)).toBe(CHAPTER_LINES.c1);
    vi.restoreAllMocks();
  });

  describe('reading time, hover and the one-line rule', () => {
    it('hovering the card holds it; leaving resumes with the time that was left', () => {
      const { container } = render(<RoboGuide />);
      enter();
      emit({ type: 'chapter', id: 'c1' });
      const bubble = q(container, '[data-robo-bubble]')!, card = q(container, '[data-robo-card]')!;
      wait(3000);
      fireEvent.pointerEnter(card);
      expect(bubble.getAttribute('data-held')).toBe('true');
      wait(30000);
      expect(bubble.getAttribute('data-on')).toBe('true');
      fireEvent.pointerLeave(card);
      wait(readMs(CHAPTER_LINES.c1!) - 3001);
      expect(bubble.getAttribute('data-on')).toBe('true');
      wait(1);
      expect(bubble.getAttribute('data-on')).toBe('false');
    });

    it('keyboard focus on the fast-lane link holds the card too', () => {
      const { container } = render(<RoboGuide />);
      enter();
      emit({ type: 'chapter', id: 'c1' });
      const link = q(container, '[data-robo-card] a')!;
      act(() => { link.focus(); });
      wait(30000);
      expect(q(container, '[data-robo-bubble]')!.getAttribute('data-on')).toBe('true');
      act(() => { link.blur(); });
      wait(readMs(CHAPTER_LINES.c1!));
      expect(q(container, '[data-robo-bubble]')!.getAttribute('data-on')).toBe('false');
    });

    it('while a card is up only a reaction replaces it', () => {
      const { container } = render(<RoboGuide />);
      enter();
      emit({ type: 'chapter', id: 'c1' });
      wait(7000); // past the 6 s gap, card still up (c1 reads for ~8 s)
      emit({ type: 'fastScroll' });
      emit({ type: 'tick' });
      expect(text(container)).toBe(CHAPTER_LINES.c1);
      emit({ type: 'egg', id: 'prod2' });
      expect(text(container)).toContain(EGG_FOUND.prod2);
    });

    function sections(current: string) {
      for (const id of ['c1', 'c2', 'c3']) {
        let el = document.getElementById(id);
        if (!el) { el = document.createElement('section'); el.id = id; document.body.appendChild(el); }
        const top = id === current ? 0 : id < current ? -3000 : 3000;
        el.getBoundingClientRect = () => ({ top, bottom: top + 800, left: 0, right: 0, width: 0, height: 800, x: 0, y: top, toJSON() {} });
      }
    }

    it('a chapter line held back plays when the card is down, if the visitor is still in that chapter', () => {
      const { container } = render(<RoboGuide />);
      enter();
      sections('c1');
      emit({ type: 'chapter', id: 'c1' });
      wait(1500);
      sections('c2');
      emit({ type: 'chapter', id: 'c2' });
      expect(text(container)).toBe(CHAPTER_LINES.c1);
      wait(readMs(CHAPTER_LINES.c1!) - 1500 + 1);
      expect(text(container)).toBe(CHAPTER_LINES.c2);
      expect(q(container, '[data-robo-channel]')!.textContent).toBe('ROBO · CH-02');
      document.body.innerHTML = '';
    });

    it('if the visitor moved on, the held line is dropped and the newer chapter plays instead', () => {
      const { container } = render(<RoboGuide />);
      enter();
      sections('c1');
      emit({ type: 'chapter', id: 'c1' });
      wait(1000); sections('c2'); emit({ type: 'chapter', id: 'c2' });
      wait(1000); sections('c3'); emit({ type: 'chapter', id: 'c3' });
      wait(readMs(CHAPTER_LINES.c1!) - 2000 + 1);
      expect(text(container)).toBe(CHAPTER_LINES.c3);
      document.body.innerHTML = '';
    });

    it('lines that are not announced are hidden from screen readers; announced ones are not', () => {
      const { container } = render(<RoboGuide />);
      enter();
      emit({ type: 'fastScroll' });
      expect(text(container)).toBe(REACT.fastScroll);
      expect(q(container, '[data-robo-text]')!.getAttribute('aria-hidden')).toBe('true');
      wait(20000);
      emit({ type: 'chapter', id: 'c1' });
      expect(q(container, '[data-robo-text]')!.hasAttribute('aria-hidden')).toBe(false);
    });
  });

  describe('the card never covers chapter content', () => {
    // jsdom is 1024x768 (desktop). Robo measures 62x62; home = left 16, bottom 44 (top-left 16,662). He stands where
    // his root's transform puts him. The card measures 80 px tall at its max width.
    const ROOT = { left: 16, top: 662, right: 78, bottom: 724 };
    const HOME = 'translate(16px, 662px)';
    let para = { left: 0, top: 0, right: 0, bottom: 0 };
    let extra: (typeof para)[] = [];
    const addText = (...boxes: (typeof para)[]) => {
      extra = boxes;
      boxes.forEach((_, i) => { const p = document.createElement('p'); p.dataset.i = String(i + 1); p.textContent = `extra ${i}`; document.querySelector('main')!.appendChild(p); });
    };
    const rect = (b: { left: number; top: number; right: number; bottom: number }) => ({ ...b, width: b.right - b.left, height: b.bottom - b.top, x: b.left, y: b.top, toJSON() {} });
    let restoreRange: () => void;
    beforeEach(() => {
      const main = document.createElement('main'); const p = document.createElement('p'); p.textContent = 'Yogesh Patil. DevOps & Site Reliability Engineer.'; main.appendChild(p); document.body.appendChild(main);
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        if (this.hasAttribute('data-robo-guide')) return rect(ROOT) as DOMRect;
        if (this.hasAttribute('data-robo-card')) {
          const w = parseFloat((this.parentElement as HTMLElement).style.maxWidth) || 280;
          return rect({ left: 0, top: 0, right: w, bottom: 80 }) as DOMRect;
        }
        return rect({ left: 0, top: 0, right: 0, bottom: 0 }) as DOMRect;
      });
      const had = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');
      // text inside a <p data-i="n"> measures as extra[n-1]; everything else as para
      Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: function (this: Range) {
        const i = Number((this.startContainer as Node).parentElement?.dataset.i ?? 0);
        return rect(i ? extra[i - 1] : para);
      } });
      restoreRange = () => { if (had) Object.defineProperty(Range.prototype, 'getBoundingClientRect', had); else delete (Range.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect; };
    });
    afterEach(() => { vi.restoreAllMocks(); restoreRange(); document.body.innerHTML = ''; });
    const roboAt = (root: HTMLElement) => {
      const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(root.style.transform)!;
      const x = Number(m[1]), y = Number(m[2]);
      return { left: x, top: y, right: x + 62, bottom: y + 62 };
    };
    const cardOnScreen = (bubble: HTMLElement) => {
      const r = roboAt(bubble.parentElement as HTMLElement);
      const left = r.left + parseFloat(bubble.style.left), bottom = r.bottom - parseFloat(bubble.style.bottom), w = parseFloat(bubble.style.maxWidth);
      return { left, top: bottom - 80, right: left + w, bottom };
    };
    const gap = (a: typeof para, b: typeof para) => Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom, 0);
    const hit = (a: typeof para, b: typeof para) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

    it('a paragraph beside Robo pushes the card to a spot clear of it', () => {
      para = { left: 80, top: 640, right: 400, bottom: 720 };
      const { container } = render(<RoboGuide />);
      enter();
      emit({ type: 'chapter', id: 'c1' });
      const bubble = q(container, '[data-robo-bubble]')!;
      expect(bubble.getAttribute('data-fit')).toBe('true');
      expect(hit(cardOnScreen(bubble), para)).toBe(false);
      // Robo himself stands clear of it too, and the card is attached to him
      const root = q(container, '[data-robo-guide]')!;
      expect(hit(roboAt(root), para)).toBe(false);
      expect(gap(cardOnScreen(bubble), roboAt(root))).toBeLessThanOrEqual(16);
    });

    it('HUD decorations with no text (the ALT ruler) count as content when marked data-robo-avoid', () => {
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      const ruler = document.createElement('div');
      ruler.setAttribute('data-robo-avoid', '');
      document.body.appendChild(ruler);
      const { container } = render(<RoboGuide />);
      enter();
      const root = q(container, '[data-robo-guide]')!;
      expect(root.style.transform).toBe(HOME);
      const box = { left: 24, top: 600, right: 40, bottom: 740 };
      const real = Element.prototype.getBoundingClientRect;
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        return this === ruler ? (rect(box) as DOMRect) : real.call(this);
      });
      emit({ type: 'chapter', id: 'c2' });
      wait(3000);
      expect(hit(roboAt(root), box)).toBe(false);
    });

    it('a jump to another chapter ends the card still up from the old one (no stale CH-01 card)', () => {
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      const { container } = render(<RoboGuide />);
      enter();
      emit({ type: 'chapter', id: 'c1' });
      const bubble = q(container, '[data-robo-bubble]')!;
      expect(bubble.getAttribute('data-on')).toBe('true');
      wait(1000);
      emit({ type: 'chapter', id: 'c3' }); // inside the line gap: c3's line is held back, c1's card must go
      expect(bubble.getAttribute('data-on')).toBe('false');
      wait(10000);
      expect(q(container, '[data-robo-channel]')?.textContent ?? '').not.toContain('CH-01');
    });

    it('Robo starts at home, and on a new screen walks to empty space, then sits', () => {
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      const { container } = render(<RoboGuide />);
      enter();
      const root = q(container, '[data-robo-guide]')!;
      expect(root.style.transform).toBe(HOME);
      expect(root.getAttribute('data-mood')).toBe('sit');
      para = { left: 0, top: 600, right: 300, bottom: 740 }; // the new screen's text lands on his spot
      emit({ type: 'chapter', id: 'c2' });
      expect(root.style.transform).not.toBe(HOME);
      expect(hit(roboAt(root), para)).toBe(false);
      expect(roboAt(root).top).toBe(662); // along the bottom band
      expect(root.getAttribute('data-mood')).toBe('walk');
      expect(q(container, '[data-chibi]')!.getAttribute('data-facing')).toBe('right');
      wait(2500);
      expect(root.getAttribute('data-mood')).toBe('sit');
      // the card that opened came along: beside him, not at some far spot
      const bubble = q(container, '[data-robo-bubble]')!;
      expect(gap(cardOnScreen(bubble), roboAt(root))).toBeLessThanOrEqual(16);
      expect(hit(cardOnScreen(bubble), para)).toBe(false);
    });

    it('stays put while a door jump runs; walks once the landing chapter arrives', () => {
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      const { container } = render(<RoboGuide />);
      enter();
      const root = q(container, '[data-robo-guide]')!;
      para = { left: 0, top: 600, right: 300, bottom: 740 };
      h.timed = true;
      emit({ type: 'chapter', id: 'c2' });
      act(() => { window.dispatchEvent(new Event('scroll')); });
      wait(2000);
      expect(root.style.transform).toBe(HOME);
      h.timed = false;
      emit({ type: 'chapter', id: 'c3' });
      expect(root.style.transform).not.toBe(HOME);
      expect(hit(roboAt(root), para)).toBe(false);
    });

    it('nowhere free: he peeks half off-screen at the edge', () => {
      para = { left: 0, top: 0, right: 1024, bottom: 768 };
      const { container } = render(<RoboGuide />);
      enter();
      const root = q(container, '[data-robo-guide]')!;
      expect(root.style.transform).toBe('translate(-31px, 662px)');
      expect(root.getAttribute('data-peek')).toBe('true');
    });

    const scrollTo = (y: number, at: number) => act(() => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
      vi.spyOn(performance, 'now').mockReturnValue(at);
      window.dispatchEvent(new Event('scroll'));
      flushScrollFrame(); // the animation frame the scroll asked for
      vi.advanceTimersByTime(20);
    });

    it('the card is tucked away while he walks and comes back on arrival; its reading time waits for him', () => {
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      const { container } = render(<RoboGuide />);
      enter();
      const root = q(container, '[data-robo-guide]')!, bubble = q(container, '[data-robo-bubble]')!;
      para = { left: 0, top: 600, right: 300, bottom: 740 };
      emit({ type: 'chapter', id: 'c1' });
      expect(root.getAttribute('data-mood')).toBe('walk');
      expect(bubble.getAttribute('data-stow')).toBe('true');
      let walked = 0;
      while (root.getAttribute('data-mood') === 'walk' && walked < 5000) { wait(10); walked += 10; }
      expect(walked).toBeGreaterThan(250);
      expect(bubble.getAttribute('data-stow')).toBe('false');
      expect(gap(cardOnScreen(bubble), roboAt(root))).toBeLessThanOrEqual(16);
      // the full reading time counts from his arrival (to within the 10 ms we poll), not from when the line came in
      wait(readMs(CHAPTER_LINES.c1!) - 11);
      expect(bubble.getAttribute('data-on')).toBe('true');
      wait(11);
      expect(bubble.getAttribute('data-on')).toBe('false');
    });

    it('a scroll tucks the card away at once; it comes back after the scroll settles, with its time left', () => {
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      const { container } = render(<RoboGuide />);
      enter();
      scrollTo(0, 1000);
      wait(300);
      emit({ type: 'chapter', id: 'c1' });
      const bubble = q(container, '[data-robo-bubble]')!;
      expect(bubble.getAttribute('data-stow')).toBe('false');
      wait(1000); // 1 s of reading spent
      scrollTo(40, 3000);
      expect(bubble.getAttribute('data-stow')).toBe('true');
      // keep scrolling for ~2 s: it stays tucked away, and that time does not count
      for (let i = 1; i <= 10; i++) { wait(180); scrollTo(40 + 10 * i, 3000 + 200 * i); expect(bubble.getAttribute('data-stow')).toBe('true'); }
      wait(200);
      expect(bubble.getAttribute('data-stow')).toBe('true');
      wait(60); // 250 ms after the last frame: settled, nothing to walk to, back (30 ms ago)
      expect(bubble.getAttribute('data-stow')).toBe('false');
      expect(bubble.getAttribute('data-on')).toBe('true');
      wait(readMs(CHAPTER_LINES.c1!) - 1000 - 40);
      expect(bubble.getAttribute('data-on')).toBe('true');
      wait(60);
      expect(bubble.getAttribute('data-on')).toBe('false');
    });

    it('runs (not walks) when the visitor scrolled fast just before', () => {
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      const { container } = render(<RoboGuide />);
      enter();
      const root = q(container, '[data-robo-guide]')!;
      scrollTo(0, 1000);
      para = { left: 0, top: 600, right: 300, bottom: 740 };
      scrollTo(3000, 1500); // 3000 px in 0.5 s = 6000 px/s
      wait(300); // settles: re-perch
      expect(root.style.transform).not.toBe(HOME);
      expect(root.getAttribute('data-mood')).toBe('run');
    });

    it('a slow scroll walks', () => {
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      const { container } = render(<RoboGuide />);
      enter();
      const root = q(container, '[data-robo-guide]')!;
      scrollTo(0, 1000);
      para = { left: 0, top: 600, right: 300, bottom: 740 };
      scrollTo(100, 1500); // 200 px/s
      wait(300);
      expect(root.getAttribute('data-mood')).toBe('walk');
    });

    it('when the way crosses content he beams instead of walking through it', () => {
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      const { container } = render(<RoboGuide />);
      enter();
      const root = q(container, '[data-robo-guide]')!;
      expect(root.style.transform).toBe(HOME);
      // text on his spot, a line up the left gutter, and the band to the right taken: the free perch is up above the
      // band (in the open, or up the gutter past that line)
      para = { left: 0, top: 640, right: 100, bottom: 740 };
      addText({ left: 0, top: 540, right: 100, bottom: 560 }, { left: 120, top: 600, right: 1024, bottom: 768 });
      emit({ type: 'chapter', id: 'c2' });
      expect(root.getAttribute('data-beam')).toBe('true');
      expect(root.getAttribute('data-mood')).not.toBe('walk');
      expect(root.style.transform).toBe(HOME); // still blinking out
      wait(300);
      expect(root.getAttribute('data-beam')).toBe('false');
      const at = roboAt(root);
      expect(at.bottom).toBeLessThanOrEqual(600);
      expect(at.left >= 100 || at.bottom <= 540).toBe(true); // clear of the gutter line
      expect(root.style.getPropertyValue('--travel')).toBe('0ms');
    });

    it('text that is invisible but fading in (a running reveal) already counts as content; still-hidden text does not', () => {
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      const { container } = render(<RoboGuide />);
      enter();
      const root = q(container, '[data-robo-guide]')!;
      const p = document.querySelector('main p') as HTMLElement;
      p.style.opacity = '0';
      para = { left: 0, top: 600, right: 300, bottom: 740 };
      emit({ type: 'chapter', id: 'c2' });
      expect(root.style.transform).toBe(HOME); // hidden text: not in his way
      Object.defineProperty(document, 'getAnimations', { configurable: true, value: () => [{ playState: 'running', effect: { target: p } }] });
      emit({ type: 'chapter', id: 'c3' });
      expect(root.style.transform).not.toBe(HOME); // the same text mid-reveal: he moves off it
      Reflect.deleteProperty(document, 'getAnimations');
    });

    it('reduced motion: he appears on the new perch at once, never walking', () => {
      stubMotion(true);
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      const { container } = render(<RoboGuide />);
      enter();
      const root = q(container, '[data-robo-guide]')!;
      para = { left: 0, top: 600, right: 300, bottom: 740 };
      emit({ type: 'chapter', id: 'c2' });
      expect(root.style.transform).not.toBe(HOME);
      expect(hit(roboAt(root), para)).toBe(false);
      expect(root.style.getPropertyValue('--travel')).toBe('0ms');
      expect(['walk', 'run']).not.toContain(root.getAttribute('data-mood'));
      expect(q(container, '[data-robo-bubble]')!.getAttribute('data-stow')).toBe('false');
    });

    it('with no room anywhere the line never shows over content: it waits out of sight, then is dropped after 6 s', () => {
      para = { left: 0, top: 0, right: 1024, bottom: 768 };
      const { container } = render(<RoboGuide />);
      enter();
      emit({ type: 'chapter', id: 'c1' });
      const bubble = q(container, '[data-robo-bubble]')!;
      expect(bubble.getAttribute('data-fit')).toBe('false');
      expect(text(container)).toBe(CHAPTER_LINES.c1);
      wait(5999);
      expect(bubble.getAttribute('data-fit')).toBe('false');
      expect(bubble.getAttribute('data-on')).toBe('true');
      wait(1);
      expect(bubble.getAttribute('data-on')).toBe('false');
    });

    it('a waiting line shows as soon as a re-check finds room (a resize, a reveal finishing), with its full reading time', () => {
      para = { left: 0, top: 0, right: 1024, bottom: 768 };
      const { container } = render(<RoboGuide />);
      enter();
      emit({ type: 'chapter', id: 'c1' });
      const bubble = q(container, '[data-robo-bubble]')!;
      expect(bubble.getAttribute('data-fit')).toBe('false');
      para = { left: 0, top: 0, right: 1024, bottom: 300 };
      wait(1000);
      expect(bubble.getAttribute('data-fit')).toBe('false'); // nothing polls: no event, no re-check
      act(() => { document.querySelector('main p')!.dispatchEvent(new Event('transitionend', { bubbles: true })); });
      wait(130);
      expect(bubble.getAttribute('data-fit')).toBe('true');
      // he walks back from his peek first (card tucked away meanwhile); the full reading time follows
      wait(readMs(CHAPTER_LINES.c1!) - 1);
      expect(bubble.getAttribute('data-on')).toBe('true');
      wait(2500);
      expect(bubble.getAttribute('data-on')).toBe('false');
    });

    it('the page\'s own animations long after an arrival trigger no re-check (no scans while idle)', () => {
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      const { container } = render(<RoboGuide />);
      enter();
      const root = q(container, '[data-robo-guide]')!;
      wait(5000);
      para = { left: 0, top: 600, right: 300, bottom: 740 };
      act(() => { document.querySelector('main p')!.dispatchEvent(new Event('animationend', { bubbles: true })); });
      wait(1000);
      expect(root.style.transform).toBe(HOME);
      emit({ type: 'chapter', id: 'c2' }); // a real arrival does look
      expect(root.style.transform).not.toBe(HOME);
    });

    it('a card already read part-way hides (clock stopped) when a re-check finds no room, and returns with its time left', () => {
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      const { container } = render(<RoboGuide />);
      enter();
      emit({ type: 'chapter', id: 'c1' });
      const bubble = q(container, '[data-robo-bubble]')!;
      expect(bubble.getAttribute('data-fit')).toBe('true');
      const reveal = () => act(() => { document.querySelector('main p')!.dispatchEvent(new Event('animationend', { bubbles: true })); });
      wait(2000);
      para = { left: 0, top: 0, right: 1024, bottom: 768 }; // the page fills up (no room even after he moves)
      reveal();
      wait(700); // re-checked
      expect(bubble.getAttribute('data-fit')).toBe('false');
      wait(3000); // hidden: does not count
      para = { left: 0, top: 0, right: 0, bottom: 0 };
      reveal();
      wait(700);
      expect(bubble.getAttribute('data-fit')).toBe('true');
      // about 2 s were read before it hid; the rest (minus a little travel slack) is still to come
      wait(readMs(CHAPTER_LINES.c1!) - 2000 - 2600);
      expect(bubble.getAttribute('data-on')).toBe('true');
      wait(5000);
      expect(bubble.getAttribute('data-on')).toBe('false');
    });
  });
});
