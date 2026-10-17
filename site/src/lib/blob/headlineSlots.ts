/** `x` is the left edge of the letter's own measured box and `base` the page text's measured baseline (stage px).
 *  Baseline is read from the DOM, not derived from font metrics: a computed one came out 1px off at small sizes. */
export type SlotRect = { line: number; ch: string; x: number; base: number };
export type Headline = { family: string; fs: number; slots: SlotRect[] };

export type Piece = { anchor: string } | { page: string; alch: string };

/** Split the page word and the Alchemist word at the letters they share in the same position (the anchors, which
 *  never move). Everything between two anchors is a segment: both strings, spread over the wider one's width. */
export function segments(pageWord: string, alchWord: string): Piece[] {
  const a = [...pageWord.toUpperCase()], b = [...alchWord.toUpperCase()], n = Math.max(a.length, b.length);
  const out: Piece[] = []; let pa = '', pb = '';
  const flush = () => { if (pa || pb) out.push({ page: pa, alch: pb }); pa = pb = ''; };
  for (let i = 0; i < n; i++) {
    if (a[i] !== undefined && a[i] === b[i]) { flush(); out.push({ anchor: a[i] }); }
    else { pa += a[i] ?? ''; pb += b[i] ?? ''; }
  }
  flush();
  return out;
}
