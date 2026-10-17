// Where Robo's card may sit. Pure: the component measures, this decides.

export type Box = { left: number; top: number; right: number; bottom: number };
export type Size = { w: number; h: number };
/** A card position against Robo's box. The card is always attached to him, within GAP px: `side` = right beside him,
 *  `left` = on his left, `up` = right above him (`align` start = flush with his left edge, end = with his right).
 *  `bottom` = how far the card's bottom edge sits above his bottom edge (side/left; negative = below it). */
export type Spot = { kind: 'side' | 'left' | 'up'; bottom: number; maxW: number; align: 'start' | 'end' };

export const PHONE_MAX = 760;
/** Space between Robo and his card. */
export const GAP = 12;
/** How close to the screen edge the card may go. */
const EDGE = 8;
const uniq = (xs: number[]) => xs.filter((x, i) => xs.indexOf(x) === i);

/** The only max widths a card is ever given on a screen this wide: desktop 280/220/180 (never past 34vw), phone 70/55vw. */
export const cardWidths = (vw: number): number[] =>
  vw > PHONE_MAX ? uniq([280, 220, 180].map((w) => Math.round(Math.min(w, vw * 0.34)))) : uniq([Math.round(vw * 0.7), Math.round(vw * 0.55)]);

/**
 * Candidate spots for the card, best first, all touching Robo (`root` is his box on screen, real or planned). It opens
 * toward the middle of the screen: on the left half beside him to the right, then above, then to his left; on the right
 * half the other way round. Desktop: max 280 px (never beyond 34vw), three heights beside him. Phone: above him first
 * (70vw), then beside him where the screen leaves 160 px.
 */
export function spots(vw: number, vh: number, root: Box): Spot[] {
  const h = root.bottom - root.top, rightHalf = (root.left + root.right) / 2 > vw / 2, out: Spot[] = [];
  const roomR = vw - EDGE - (root.right + GAP), roomL = root.left - GAP - EDGE;
  // only the fixed card widths (cardWidths), so every size can be measured up front in one go
  const beside = (kind: 'side' | 'left', widths: number[], bottoms: number[]) => {
    const room = kind === 'side' ? roomR : roomL;
    for (const bottom of bottoms) for (const maxW of widths) if (maxW <= room && maxW >= 160) out.push({ kind, bottom, maxW, align: 'start' });
  };
  const up = (widths: number[]) => { for (const maxW of widths) out.push({ kind: 'up', bottom: h + GAP, maxW, align: rightHalf ? 'end' : 'start' }); };
  const widths = cardWidths(vw);
  if (vw > PHONE_MAX) {
    const bottoms = [12, -14, -28, 40];
    const order = rightHalf ? (['left', 'up', 'side'] as const) : (['side', 'up', 'left'] as const);
    for (const k of order) if (k === 'up') up(widths); else beside(k, widths, bottoms);
    return out;
  }
  up(widths);
  for (const k of rightHalf ? (['left', 'side'] as const) : (['side', 'left'] as const)) beside(k, widths, [0, -8]);
  return out;
}

/** The card's box on screen for a spot, given its measured size at that spot's max width. */
export const cardBox = (sp: Spot, size: Size, root: Box): Box => {
  const left = sp.kind === 'side' ? root.right + GAP
    : sp.kind === 'left' ? root.left - GAP - size.w
    : sp.align === 'end' ? root.right - size.w : root.left;
  const bottom = root.bottom - sp.bottom;
  return { left, top: bottom - size.h, right: left + size.w, bottom };
};

export const overlaps = (a: Box, b: Box) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
export const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/**
 * The first spot (trying `prefer` first) whose card covers nothing: `{ i, clear: true }`. When every spot covers
 * something, the one covering the least area: `{ i, clear: false }`. With `view`, spots whose card would leave the
 * screen are never chosen (`i: -1` if that rules out all of them). `sizeOf` measures the card at a max width.
 */
export function choose(list: Spot[], sizeOf: (maxW: number) => Size, root: Box, obstacles: Box[], prefer = 0, view?: { w: number; h: number }): { i: number; clear: boolean } {
  if (!list.length) return { i: -1, clear: false };
  const sizes = new Map<number, Size>();
  const size = (w: number) => { let s = sizes.get(w); if (!s) { s = sizeOf(w); sizes.set(w, s); } return s; };
  const p = prefer >= 0 && prefer < list.length ? prefer : 0;
  const order = [p, ...list.map((_, i) => i).filter((i) => i !== p)];
  let best = -1, bestArea = Infinity;
  for (const i of order) {
    const box = cardBox(list[i], size(list[i].maxW), root);
    if (view && (box.left < EDGE - 1 || box.top < EDGE - 1 || box.right > view.w - EDGE + 1 || box.bottom > view.h - EDGE + 1)) continue;
    let area = 0;
    for (const o of obstacles) if (overlaps(o, box)) area += Math.max(1, overlapArea(o, box));
    if (area === 0) return { i, clear: true };
    if (area < bestArea) { bestArea = area; best = i; }
  }
  return { i: best, clear: false };
}

/** How long a card stays up: long enough to read it fully. */
export const READ = { minMs: 6000, baseMs: 2500, perCharMs: 75 } as const;
export const readMs = (text: string) => Math.max(READ.minMs, READ.baseMs + READ.perCharMs * text.length);
