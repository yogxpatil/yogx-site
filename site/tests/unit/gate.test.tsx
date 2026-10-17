import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Controls } from '@/components/Breaker';
import { appStore } from '@/lib/appState';

vi.mock('@/lib/sound', () => ({ sfx: { on: false, set: vi.fn(), whoosh: vi.fn(), clunk: vi.fn(), blip: vi.fn() } }));

beforeEach(() => { appStore.set({ entered: false, night: false, sound: false }); document.body.className = 'locked'; window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never; });

afterEach(() => {
  cleanup();
  delete (Element.prototype as { animate?: unknown }).animate;
});

describe('Breaker', () => {
  it('flips night mode', async () => {
    appStore.set({ entered: true });
    render(<Controls />);
    await userEvent.click(screen.getByRole('button', { name: /night mode/i }));
    await new Promise((r) => setTimeout(r, 200));
    expect(document.documentElement.classList.contains('night')).toBe(true);
  });
  it('controls cannot be reached before entering', async () => {
    const { container } = render(<Controls />);
    const ctrls = container.firstElementChild as HTMLElement;
    expect(ctrls).toHaveAttribute('inert');
    expect(ctrls).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button', { name: /night mode/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /toggle sound/i })).toBeNull();
  });
});
