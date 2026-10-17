import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BreakableHeadline } from '@/components/hero/BreakableHeadline';
import { onRobo } from '@/lib/robo/bus';
import { looseStore } from '@/lib/hero/looseStore';
import type { RoboEvent } from '@/lib/robo/brain';

const NAME = 'DevOps Architect — and on the other plane, Digital Alchemist';

function setup(reduce = false) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never;
  const ui = render(
    <div data-hero-sticky>
      <div data-plane>
        <BreakableHeadline className="big">
          <span className="sr-only">{NAME}</span>
          <span aria-hidden>{[...'DEVOPS'].map((c, i) => <span key={i} data-letter data-testid={`l${i}`}>{c}</span>)}</span>
        </BreakableHeadline>
      </div>
      <div data-blob-layer />
    </div>,
  );
  const h1 = () => screen.getByRole('heading', { level: 1 });
  return { ...ui, h1, copies: () => ui.container.querySelectorAll('[data-copy]') };
}

const drag = (el: HTMLElement) => {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: 10, clientY: 10, button: 0, pointerType: 'mouse' });
  fireEvent.pointerMove(el, { pointerId: 1, clientX: 60, clientY: 30, pointerType: 'mouse' });
  fireEvent.pointerUp(el, { pointerId: 1, clientX: 80, clientY: 40, pointerType: 'mouse' });
};

describe('BreakableHeadline', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] }); });
  afterEach(() => { vi.useRealTimers(); });

  it('a dragged letter becomes a loose copy over its hidden slot, then rolls back after 3 s idle', () => {
    const said: RoboEvent[] = []; const off = onRobo((e) => said.push(e));
    const { h1, copies, getByTestId, container } = setup();
    expect(h1()).toHaveAccessibleName(NAME);
    act(() => drag(getByTestId('l2')));
    expect(getByTestId('l2').style.visibility).toBe('hidden');
    expect(copies()).toHaveLength(1);
    expect(copies()[0].textContent).toBe('V');
    expect(copies()[0].closest('[aria-hidden="true"]')).not.toBeNull();
    expect(h1()).toHaveAccessibleName(NAME);
    expect(looseStore.get().loose).toBe(true);
    expect(container.querySelector('[data-blob-layer]')).toHaveAttribute('data-letters-loose');
    act(() => { vi.advanceTimersByTime(2900); });
    expect(said).toEqual([]);
    act(() => { vi.advanceTimersByTime(200); });
    expect(said).toEqual([{ type: 'restart' }]);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(copies()).toHaveLength(0);
    expect(getByTestId('l2').style.visibility).toBe('');
    expect(looseStore.get().loose).toBe(false);
    expect(container.querySelector('[data-blob-layer]')).not.toHaveAttribute('data-letters-loose');
    expect(h1()).toHaveAccessibleName(NAME);
    off();
  });

  it('touching again before 3 s pushes the restart back', () => {
    const said: RoboEvent[] = []; const off = onRobo((e) => said.push(e));
    const { getByTestId } = setup();
    act(() => drag(getByTestId('l0')));
    act(() => { vi.advanceTimersByTime(2000); });
    act(() => drag(getByTestId('l1')));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(said).toEqual([]);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(said).toEqual([{ type: 'restart' }]);
    act(() => { vi.advanceTimersByTime(3000); });
    off();
  });

  it('a mouse release with a different pointer id still lets go (no letter stuck in the hand, restart not blocked)', () => {
    const { copies, getByTestId } = setup();
    act(() => { fireEvent.pointerDown(getByTestId('l3'), { pointerId: 7, clientX: 5, clientY: 5, button: 0, pointerType: 'mouse' }); });
    act(() => { fireEvent.pointerUp(window, { pointerId: 1, clientX: 5, clientY: 5, pointerType: 'mouse' }); });
    act(() => { vi.advanceTimersByTime(5500); });
    expect(copies()).toHaveLength(0);
    expect(getByTestId('l3').style.visibility).toBe('');
  });

  it('B on the hero knocks every letter down; it heals itself', () => {
    const { copies, getByTestId } = setup();
    act(() => { fireEvent.keyDown(window, { key: 'b' }); });
    act(() => { vi.advanceTimersByTime(100); }); // the knock ripples out a few letters per frame
    expect(copies()).toHaveLength(6);
    for (let i = 0; i < 6; i++) expect(getByTestId(`l${i}`).style.visibility).toBe('hidden');
    act(() => { vi.advanceTimersByTime(6000); });
    expect(copies()).toHaveLength(0);
  });

  it('B typed into a field does nothing', () => {
    const { copies } = setup();
    const input = document.createElement('input'); document.body.appendChild(input);
    act(() => { fireEvent.keyDown(input, { key: 'b' }); });
    expect(copies()).toHaveLength(0);
    input.remove();
  });

  it('reduced motion: letters cannot be dragged or knocked down', () => {
    const { copies, getByTestId, h1 } = setup(true);
    act(() => drag(getByTestId('l2')));
    act(() => { fireEvent.keyDown(window, { key: 'b' }); });
    expect(copies()).toHaveLength(0);
    expect(getByTestId('l2').style.visibility).toBe('');
    expect(h1()).toHaveAccessibleName(NAME);
  });
});
