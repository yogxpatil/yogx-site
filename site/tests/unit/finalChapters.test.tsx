import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, waitFor } from '@testing-library/react';
import { MissionLog } from '@/components/chapters/MissionLog';
import { Signal } from '@/components/chapters/Signal';
import { Transmissions } from '@/components/chapters/Transmissions';

const mm = (reduce: boolean) => vi.fn().mockImplementation((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

describe('final chapters under reduced motion', () => {
  it('mission rows are all visible and the OCD scene is never tilted', () => {
    vi.stubGlobal('matchMedia', mm(true));
    const ocd = document.createElement('div'); ocd.id = 'sc-ocd'; document.body.append(ocd);
    const { container } = render(<MissionLog />);
    container.querySelectorAll('[data-mrow]').forEach((r) => expect(r).toHaveAttribute('data-in', 'true'));
    expect(ocd.style.transform).toBe('');
    ocd.remove();
  });
  it('signal shows the merged state straight away', async () => {
    vi.stubGlobal('matchMedia', mm(true));
    const { container } = render(<Signal />);
    await waitFor(() => expect((container.querySelector('[data-merge]') as HTMLElement).style.opacity).toBe('1'));
    expect((container.querySelector('[data-ogseal]') as HTMLElement).style.opacity).toBe('1');
    expect((container.querySelector('[data-half="l"]') as HTMLElement).style.transform).toBe('translateX(20%)');
  });
});

describe('OCD scene styles are borrowed, not kept', () => {
  it('unmounting the mission log clears the tilt it wrote on #sc-ocd', async () => {
    vi.stubGlobal('matchMedia', mm(false)); vi.stubGlobal('innerHeight', 1000);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 300, bottom: 300, left: 0, right: 0, width: 0, height: 0, x: 0, y: 300, toJSON() {} } as DOMRect);
    const ocd = document.createElement('div'); ocd.id = 'sc-ocd'; document.body.append(ocd);
    const { unmount } = render(<MissionLog />);
    await waitFor(() => expect(ocd.style.transform).toMatch(/perspective\(1400px\)/));
    expect(ocd.style.filter).toMatch(/brightness/);
    unmount();
    expect(ocd.style.transform).toBe(''); expect(ocd.style.boxShadow).toBe(''); expect(ocd.style.filter).toBe('');
    ocd.remove(); vi.restoreAllMocks();
  });
});

describe('placeholder links do not navigate', () => {
  it('real signal contacts open outside the page; pending ones and the unconfirmed transmissions have no href', () => {
    vi.stubGlobal('matchMedia', mm(false));
    const sig = render(<Signal />);
    const hrefs = [...sig.container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['https://www.linkedin.com/in/yogeshp-dev', 'mailto:yogeshpatil6717@gmail.com']);
    expect(sig.container.querySelector('a[href^="http"]')?.getAttribute('target')).toBe('_blank');
    expect(sig.container.querySelectorAll('[aria-disabled="true"]')).toHaveLength(1);
    expect(sig.container.textContent).toContain('soon');
    const tx = render(<Transmissions />);
    expect(tx.container.querySelectorAll('a[href]')).toHaveLength(0);
    expect(tx.container.querySelectorAll('[role="group"]')).toHaveLength(3);
  });
});

describe('signal night mode', () => {
  it('goes dark at night using tokens, not hardcoded colours', () => {
    const css = readFileSync('src/components/chapters/Signal.module.css', 'utf8');
    expect(css).toMatch(/html\.night\) \.l\{background:var\(--surface\)\}/);
    expect(css).toMatch(/html\.night\) \.r\{background:var\(--deep-rust\)\}/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
