import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const h = vi.hoisted(() => ({ timed: false, probe: null as null | { x: number; y: number; active: boolean } }));
vi.mock('@/lib/transitions/doors', () => ({ doorsTimed: () => h.timed }));
vi.mock('@/components/hero/useBlobDriver', () => ({ blobProbe: () => h.probe }));

import { useRoboSignals } from '@/components/robo/useRoboSignals';
import { appStore } from '@/lib/appState';
import { onRobo } from '@/lib/robo/bus';
import { flushScrollFrame } from '@/lib/useScrollFrame';
import type { RoboEvent } from '@/lib/robo/brain';

function Probe() { useRoboSignals(); return null; }
/** one scroll frame, then the signals it found (they are posted just after the frame, not inside it) */
const frame = () => { act(() => { flushScrollFrame(); }); act(() => { vi.advanceTimersByTime(0); }); };
const setVisibility = (v: 'visible' | 'hidden') => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });

describe('useRoboSignals', () => {
  let got: RoboEvent[] = [];
  let off: () => void;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
    got = []; off = onRobo((e) => { got.push(e); });
    h.timed = false; h.probe = null;
    setVisibility('visible');
    appStore.set({ entered: true });
  });
  afterEach(() => { off(); vi.useRealTimers(); appStore.set({ entered: false }); document.body.innerHTML = ''; setVisibility('visible'); });

  it('does not mark or announce chapters while a door jump is running; the landing chapter arrives after', () => {
    const el = document.createElement('section'); el.id = 'c3';
    el.getBoundingClientRect = () => ({ top: 0, bottom: innerHeight, height: innerHeight, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON() {} });
    document.body.appendChild(el);
    render(<Probe />);
    h.timed = true;
    frame();
    expect(got.filter((e) => e.type === 'chapter')).toEqual([]);
    h.timed = false;
    frame();
    expect(got.filter((e) => e.type === 'chapter')).toEqual([{ type: 'chapter', id: 'c3' }]);
  });

  it('the chapter on screen arrives the moment the visitor enters, without a scroll', () => {
    const el = document.createElement('section'); el.id = 'c1';
    el.getBoundingClientRect = () => ({ top: 0, bottom: innerHeight, height: innerHeight, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON() {} });
    document.body.appendChild(el);
    appStore.set({ entered: false });
    render(<Probe />);
    expect(got).toEqual([]);
    act(() => { appStore.set({ entered: true }); });
    act(() => { vi.advanceTimersByTime(0); });
    expect(got.filter((e) => e.type === 'chapter')).toEqual([{ type: 'chapter', id: 'c1' }]);
  });

  it('a chapter arrival is posted just after the scroll frame, never inside it (Robo reacting is not that frame\'s work)', () => {
    const el = document.createElement('section'); el.id = 'c4';
    el.getBoundingClientRect = () => ({ top: 0, bottom: innerHeight, height: innerHeight, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON() {} });
    document.body.appendChild(el);
    render(<Probe />);
    act(() => { flushScrollFrame(); });
    expect(got.filter((e) => e.type === 'chapter')).toEqual([]);
    act(() => { vi.advanceTimersByTime(0); });
    expect(got.filter((e) => e.type === 'chapter')).toEqual([{ type: 'chapter', id: 'c4' }]);
  });

  it('a door jump back up is not the visitor scrolling up, before or after the doors open', () => {
    const setY = (y: number) => Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
    setY(5000);
    render(<Probe />);
    frame();
    h.timed = true; setY(0);
    frame();
    h.timed = false;
    frame();
    expect(got.filter((e) => e.type === 'scrollUp')).toEqual([]);
    setY(5000); frame();
    setY(4000); frame();
    expect(got.filter((e) => e.type === 'scrollUp')).toEqual([{ type: 'scrollUp' }]);
    setY(0);
  });

  it('letter hold restarts after the tab was hidden (no instant egg on return)', () => {
    const a = document.createElement('span'); a.setAttribute('data-anchor', '');
    document.body.appendChild(a); // jsdom rect is 0,0,0,0: a probe at 0,0 is "inside"
    h.probe = { x: 0, y: 0, active: true };
    render(<Probe />);
    act(() => { vi.advanceTimersByTime(2000); });
    setVisibility('hidden');
    act(() => { vi.advanceTimersByTime(5000); });
    setVisibility('visible');
    act(() => { vi.advanceTimersByTime(500); });
    expect(got.some((e) => e.type === 'egg' && e.id === 'letterHold')).toBe(false);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(got.some((e) => e.type === 'egg' && e.id === 'letterHold')).toBe(true);
  });

  it('letter hold restarts after the visitor was not entered', () => {
    const a = document.createElement('span'); a.setAttribute('data-anchor', '');
    document.body.appendChild(a);
    h.probe = { x: 0, y: 0, active: true };
    render(<Probe />);
    act(() => { vi.advanceTimersByTime(2000); });
    appStore.set({ entered: false });
    act(() => { vi.advanceTimersByTime(1000); });
    appStore.set({ entered: true });
    act(() => { vi.advanceTimersByTime(1500); });
    expect(got.some((e) => e.type === 'egg' && e.id === 'letterHold')).toBe(false);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(got.some((e) => e.type === 'egg' && e.id === 'letterHold')).toBe(true);
  });

  it('the R key saves the place through goFastLane', () => {
    sessionStorage.clear();
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    render(<Probe />);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' })); });
    expect(sessionStorage.getItem('yogx:return')).not.toBeNull();
    expect(assign).toHaveBeenCalledWith('/fast-lane/');
    vi.unstubAllGlobals();
  });
});
