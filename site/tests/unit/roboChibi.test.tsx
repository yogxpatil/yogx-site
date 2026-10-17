import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { RoboChibi } from '@/components/robo/RoboChibi';
import { gagMood } from '@/lib/robo/moods';
import { readFileSync } from 'node:fs';
import { contrast } from '@/theme/contrast';

describe('RoboChibi day-mode contrast (he is a button: WCAG 1.4.11 asks 3:1 for its shape)', () => {
  it('outline and limbs read at 3:1 or more on the paper background', () => {
    const css = readFileSync('src/components/robo/RoboChibi.module.css', 'utf8');
    const at = css.indexOf('.root{'), root = css.slice(at, css.indexOf('}', at));
    const v = (n: string) => new RegExp(`--${n}:(#[0-9a-f]{6})`).exec(root)![1];
    expect(contrast(v('c-line'), '#f7f3e9')).toBeGreaterThanOrEqual(3);
    expect(contrast(v('c-limb'), '#f7f3e9')).toBeGreaterThanOrEqual(3);
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('RoboChibi', () => {
  it('renders the mood on the root and hides itself from assistive tech', () => {
    const { container } = render(<RoboChibi mood="walk" facing="right" gait={0.6} />);
    const root = container.querySelector('[data-chibi]') as HTMLElement;
    expect(root.getAttribute('data-mood')).toBe('walk');
    expect(root.getAttribute('data-facing')).toBe('right');
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.style.getPropertyValue('--g')).toBe('0.6s');
  });

  it('draws both arms after the head so raised hands stay in front of it', () => {
    const { container } = render(<RoboChibi mood="wave" facing="left" gait={0.6} />);
    const head = container.querySelector('[data-part="head"]')!, arms = container.querySelectorAll('[data-part="arm"]');
    expect(arms).toHaveLength(2);
    arms.forEach((a) => expect(head.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
  });

  it('size sets the height in px (78 by default)', () => {
    const a = render(<RoboChibi mood="idle" facing="right" gait={0.6} size={56} />);
    expect((a.container.querySelector('[data-chibi]') as HTMLElement).style.height).toBe('56px');
    a.unmount();
    const b = render(<RoboChibi mood="idle" facing="right" gait={0.6} />);
    expect((b.container.querySelector('[data-chibi]') as HTMLElement).style.height).toBe('78px');
  });

  it('reduced motion adds data-reduce', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const { container } = render(<RoboChibi mood="walk" facing="right" gait={0.6} />);
    expect(container.querySelector('[data-chibi]')!.hasAttribute('data-reduce')).toBe(true);
  });

  it('no data-reduce when motion is allowed', () => {
    const { container } = render(<RoboChibi mood="walk" facing="right" gait={0.6} />);
    expect(container.querySelector('[data-chibi]')!.hasAttribute('data-reduce')).toBe(false);
  });
});

describe('gagMood', () => {
  it('maps every gag to its mood', () => {
    expect(gagMood('painted')).toBe('jump');
    expect(gagMood('sip')).toBe('sit');
    expect(gagMood('wave')).toBe('wave');
    expect(gagMood('dizzy')).toBe('dizzy');
    expect(gagMood('topple')).toBe('sad');
    expect(gagMood('spoiler')).toBe('point');
    expect(gagMood('none')).toBe('idle');
  });
});
