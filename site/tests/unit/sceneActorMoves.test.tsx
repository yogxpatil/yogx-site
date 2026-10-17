import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import { SceneActor, type ActorHandle } from '@/components/robo/SceneActor';
import { hopLift, moveMs, node, speech, activeLine, type Pose } from '@/lib/missions/actor';

// Node to node: a new node plays one self-contained hop / walk (WAAPI) that always finishes; a new node mid-move
// retargets straight there (no backlog); the same node changes nothing; reduced motion snaps.
type FakeAnim = { cancel: ReturnType<typeof vi.fn>; onfinish: null | (() => void); frames: Keyframe[]; opts: KeyframeAnimationOptions };
let anims: FakeAnim[] = [];
const media = (reduce: boolean) => vi.fn().mockImplementation((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
const frame = (pose: Pose) => ({ pose, ...speech(0, [0.5]), active: activeLine(0, [0.5]) });

describe('scene Robo moves node to node', () => {
  beforeEach(() => {
    anims = [];
    vi.stubGlobal('matchMedia', media(false));
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = function (frames: Keyframe[], opts: KeyframeAnimationOptions) {
      const a: FakeAnim = { cancel: vi.fn(), onfinish: null, frames, opts }; anims.push(a); return a as unknown as Animation;
    };
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate; });

  const setup = () => {
    const ref = createRef<ActorHandle>();
    const r = render(<SceneActor ref={ref} name="t" lines={['a']} />);
    const bot = r.container.querySelector<HTMLElement>('[data-actor-bot]')!;
    return { ref, bot, set: (p: Pose) => act(() => ref.current!.set(frame(p))) };
  };

  it('the first placement snaps; a new node plays one hop with an arc and a squash, which finishes on the node', () => {
    const { bot, set } = setup();
    set(node({ x: 0.1, y: 0.5 }, 'point'));
    expect(anims).toHaveLength(0); expect(bot.style.transform).toBe('translate3d(100.0px,250.0px,0)');
    set(node({ x: 0.5, y: 0.5 }, 'point'));
    expect(anims).toHaveLength(2); // the position (arc) and the squash
    const pos = anims[0], ys = pos.frames.map((f) => Number(String(f.transform).match(/,(-?[\d.]+)px,0/)![1]));
    expect(Math.min(...ys)).toBeLessThan(250 - 30); // it arcs up
    expect(ys[0]).toBe(250); expect(ys[ys.length - 1]).toBe(250);
    expect(pos.opts.duration).toBeGreaterThanOrEqual(460); expect(pos.opts.duration).toBeLessThanOrEqual(560);
    expect(bot.dataset.mood).toBe('air');
    act(() => pos.onfinish!()); // the hop always completes: he lands, the pose he came for shows
    expect(bot.style.transform).toBe('translate3d(500.0px,250.0px,0)'); expect(bot.dataset.mood).toBe('point');
    expect(pos.cancel).toHaveBeenCalled(); // the fill is dropped once the end state is plain style
  });

  it('the same node again does not hop; a new node mid-hop retargets straight to it (no queue)', () => {
    const { bot, set } = setup();
    set(node({ x: 0.1, y: 0.5 }, 'point'));
    set(node({ x: 0.3, y: 0.5 }, 'point')); const first = anims[0];
    set(node({ x: 0.3, y: 0.5 }, 'point')); expect(anims).toHaveLength(2); // same node: nothing new
    set(node({ x: 0.9, y: 0.5 }, 'point')); // scrolled on past two nodes quickly
    expect(first.cancel).toHaveBeenCalled();
    const last = anims[anims.length - 2];
    expect(String(last.frames[last.frames.length - 1].transform)).toBe('translate3d(900.0px,250.0px,0)');
    act(() => first.onfinish?.()); // a cancelled hop's finish never lands him on the old node
    expect(bot.style.transform).not.toBe('translate3d(300.0px,250.0px,0)');
  });

  it('walk moves have no arc and show the walk cycle; glide follows the scroll with no animation', () => {
    const { bot, set } = setup();
    set(node({ x: 0.1, y: 0.5 }, 'idle'));
    set(node({ x: 0.6, y: 0.5 }, 'idle', 'right', 'walk'));
    expect(anims).toHaveLength(1); expect(bot.dataset.mood).toBe('walk');
    const ys = anims[0].frames.map((f) => String(f.transform).match(/,(-?[\d.]+)px,0/)![1]);
    expect(new Set(ys).size).toBe(1);
    set({ ...node({ x: 0.2, y: 0.5 }, 'walk'), move: 'glide', step: 3 });
    expect(anims[0].cancel).toHaveBeenCalled(); expect(bot.style.transform).toBe('translate3d(200.0px,250.0px,0)');
  });

  it('reduced motion: every node change snaps, no animation', () => {
    vi.stubGlobal('matchMedia', media(true));
    const { bot, set } = setup();
    set(node({ x: 0.1, y: 0.5 }, 'idle'));
    set(node({ x: 0.7, y: 0.2 }, 'sit'));
    expect(anims).toHaveLength(0); expect(bot.style.transform).toBe('translate3d(700.0px,100.0px,0)'); expect(bot.dataset.mood).toBe('sit');
  });

  it('move timing: hops 460–560 ms, walks 500–1500 ms; hop height grows with distance, capped', () => {
    expect(moveMs('hop', 0)).toBe(460); expect(moveMs('hop', 5000)).toBe(560);
    expect(moveMs('walk', 10)).toBe(500); expect(moveMs('walk', 400)).toBe(880); expect(moveMs('walk', 5000)).toBe(1500);
    expect(hopLift(0)).toBe(28); expect(hopLift(100)).toBe(50); expect(hopLift(5000)).toBe(90);
  });
});
