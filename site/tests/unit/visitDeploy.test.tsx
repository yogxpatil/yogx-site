import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import { VisitDeploy } from '@/components/visit/VisitDeploy';
import type { Visit } from '@/lib/visit/metrics';
const scroll = vi.hoisted(() => ({ calls: [] as boolean[] }));
vi.mock('@/lib/scroll', () => ({ setScrollEnabled: (on: boolean) => scroll.calls.push(on) }));

const v: Visit = { bytes: 1_468_006, requests: 24, ttfb: 82, fcp: 900, lcp: 1800, fps: 60, longTasks: 0, net: { type: null, rtt: null }, memory: null, cores: null, screen: '1440×900' };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

function Host({ collect = async () => v }: { collect?: () => Promise<Visit> }) {
  const [open, set] = useState(false);
  return <><button onClick={() => set(true)}>open</button>{open && <VisitDeploy onClose={() => set(false)} collect={collect} />}</>;
}
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

describe('VisitDeploy', () => {
  it('is a labelled modal dialog, ticks all four stages in order, and states the privacy line', async () => {
    vi.useFakeTimers();
    render(<Host />);
    fireEvent.click(screen.getByText('open'));
    await flush();
    const d = screen.getByRole('dialog');
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(d).toHaveAccessibleName();
    expect(d.textContent).toContain('Measured in your browser. Never sent anywhere.');
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    const done = [...d.querySelectorAll('[data-stage]')].map((e) => e.getAttribute('data-state'));
    expect(done).toEqual(['green', 'green', 'green', 'green']);
    expect(d.textContent).toContain('first byte 82 ms');
    expect(d.textContent).toContain('0 incidents');
    expect(d.textContent).not.toMatch(/memory|cores/i);
  });
  it('Esc closes and focus returns to the opener; Tab stays inside', async () => {
    render(<Host />);
    const opener = screen.getByText('open');
    opener.focus(); fireEvent.click(opener);
    await flush();
    const d = screen.getByRole('dialog');
    expect(d.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(d.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('locks page scrolling while open and gives it back on close', async () => {
    scroll.calls = [];
    render(<Host />);
    fireEvent.click(screen.getByText('open'));
    await flush();
    expect(scroll.calls).toEqual([false]);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(scroll.calls).toEqual([false, true]);
  });
  it('closes on an outside click', async () => {
    render(<Host />);
    fireEvent.click(screen.getByText('open')); await flush();
    fireEvent.pointerDown(screen.getByTestId('visit-scrim'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('makes no network calls', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const b = vi.fn(); Object.defineProperty(navigator, 'sendBeacon', { value: b, configurable: true });
    const x = vi.spyOn(XMLHttpRequest.prototype, 'open');
    vi.useFakeTimers();
    render(<Host />); fireEvent.click(screen.getByText('open')); await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(f).not.toHaveBeenCalled(); expect(b).not.toHaveBeenCalled(); expect(x).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
