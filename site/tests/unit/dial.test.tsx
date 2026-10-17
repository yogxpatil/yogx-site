import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { angleForIndex, indexForAngle, pointerAngle, currentIndex, A0, SPAN } from '@/lib/dial';
import { Dial } from '@/components/Dial';
import { appStore } from '@/lib/appState';

vi.mock('@/lib/sound', () => ({ sfx: { click: vi.fn() } }));

describe('dial maths', () => {
  it('spreads chapters over 270 degrees', () => {
    expect(angleForIndex(0, 7)).toBe(A0);
    expect(angleForIndex(6, 7)).toBe(A0 + SPAN);
    expect(angleForIndex(3, 7)).toBe(0);
  });
  it('inverts angle to the nearest chapter, clamped', () => {
    expect(indexForAngle(0, 7)).toBe(3);
    expect(indexForAngle(-500, 7)).toBe(0);
    expect(indexForAngle(500, 7)).toBe(6);
  });
  it('measures the pointer angle clockwise from 12 o\'clock', () => {
    expect(pointerAngle(0, -10)).toBeCloseTo(0);
    expect(pointerAngle(10, 0)).toBeCloseTo(90);
  });
  it('current chapter = last whose top passed mid-screen', () => {
    expect(currentIndex([0, 900, 1800], 1000)).toBe(0);
    expect(currentIndex([-1200, -300, 600], 1000)).toBe(1);
  });
});

describe('Dial', () => {
  beforeEach(() => { appStore.set({ entered: true }); });
  it('ignores number keys and is inert until the gate has been passed', () => {
    appStore.set({ entered: false });
    const onJump = vi.fn();
    const { container } = render(<Dial onJump={onJump} />);
    fireEvent.keyDown(window, { key: '4' });
    expect(onJump).not.toHaveBeenCalled();
    expect(container.firstElementChild).toHaveAttribute('inert');
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
  it('marks the knob so smooth scrolling leaves wheel events alone', () => {
    const { container } = render(<Dial onJump={vi.fn()} />);
    expect(container.querySelector('svg')!.parentElement).toHaveAttribute('data-lenis-prevent');
  });
  it('a key jump also locks the wheel for one gesture', () => {
    const onJump = vi.fn();
    const { container } = render(<Dial onJump={onJump} />);
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.wheel(container.querySelector('svg')!.parentElement!, { deltaY: 100 });
    expect(onJump).toHaveBeenCalledTimes(1);
  });
  it('jumps with number keys', () => {
    const onJump = vi.fn();
    render(<Dial onJump={onJump} />);
    fireEvent.keyDown(window, { key: '3' });
    expect(onJump).toHaveBeenCalledWith(2);
  });
  it('ignores keys typed into inputs', () => {
    const onJump = vi.fn();
    render(<><input aria-label="x" /><Dial onJump={onJump} /></>);
    fireEvent.keyDown(screen.getByLabelText('x'), { key: '3' });
    expect(onJump).not.toHaveBeenCalled();
  });
  it('offers a real link per chapter for screen readers and keyboards', () => {
    render(<Dial />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(7);
    expect(links[2]).toHaveAttribute('href', '#c3');
  });
  it('turns a burst of wheel events on the knob into one step and blocks page scroll', () => {
    const onJump = vi.fn();
    const { container } = render(<Dial onJump={onJump} />);
    const knob = container.querySelector('svg')!.parentElement!;
    let notPrevented = true;
    for (let k = 0; k < 10; k++) notPrevented = fireEvent.wheel(knob, { deltaY: 100 }) && notPrevented;
    expect(onJump).toHaveBeenCalledTimes(1);
    expect(onJump).toHaveBeenCalledWith(1);
    expect(notPrevented).toBe(false);
  });
  it('ignores Ctrl+3 so browser tab switching does not jump', () => {
    const onJump = vi.fn();
    render(<Dial onJump={onJump} />);
    fireEvent.keyDown(window, { key: '3', ctrlKey: true });
    fireEvent.keyDown(window, { key: '3', metaKey: true });
    expect(onJump).not.toHaveBeenCalled();
  });
  it('does not move its remembered wheel target when a jump is refused', () => {
    vi.useFakeTimers(); vi.setSystemTime(10_000);
    const onJump = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const { container } = render(<Dial onJump={onJump} />);
    const knob = container.querySelector('svg')!.parentElement!;
    fireEvent.wheel(knob, { deltaY: 100 });
    vi.setSystemTime(12_000);
    fireEvent.wheel(knob, { deltaY: 100 });
    expect(onJump.mock.calls).toEqual([[1], [1]]);
    vi.useRealTimers();
  });
});
