import type { Headline } from './headlineSlots';
export type PanelRect = { i: number; x: number; y: number; w: number; h: number };
export type Astro = { cx: number; cy: number; r: number };
const INK = '#1b1605', RUST = '#882700', APRICOT = '#f99e67', PANEL = 'rgba(251,180,138,.55)';
const serif = (px: number, italic = true) => `${italic ? 'italic ' : ''}400 ${px}px "Instrument Serif", serif`;
const mono = (px: number) => `600 ${px}px "JetBrains Mono", monospace`;
const track = (ctx: CanvasRenderingContext2D, px: number) => { if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`; };
const ENV_GLYPHS: [string, string][] = [['☉', 'DEV'], ['☽', 'QA'], ['♄', 'SB'], ['♃', 'STG'], ['♀', 'PROD'], ['☿', 'PROD2']];
// Common GPU texture limit; the backing store is capped so 4K at dpr 2 stays under it.
const MAX_BACKING = 4096;

export function paintAlchemist(ctx: CanvasRenderingContext2D, w: number, h: number, panels: PanelRect[], dpr: number, headline?: Headline | null): Astro | null {
  const scale = Math.min(dpr, MAX_BACKING / w, MAX_BACKING / h);
  ctx.canvas.width = Math.round(w * scale); ctx.canvas.height = Math.round(h * scale);
  if (!(w > 0 && h > 0)) return null;
  // Map CSS px onto the rounded backing size so no half-pixel edge is left unpainted.
  ctx.setTransform(ctx.canvas.width / w, 0, 0, ctx.canvas.height / h, 0, 0);
  ctx.fillStyle = APRICOT; ctx.fillRect(0, 0, w, h);

  let astro: Astro | null = null;
  const px = w * 0.05, fs = Math.min(Math.max(80, w * 0.155), 290), base = h - h * 0.09 - 64;
  ctx.textBaseline = 'alphabetic';
  if (headline && headline.slots.length) paintHeadline(ctx, headline);
  else { // no measured page slots (e.g. before the DOM exists): the old standalone serif words
    track(ctx, -fs * 0.03);
    ctx.font = serif(fs); ctx.fillStyle = INK; ctx.fillText('Digital', px, base - fs * 0.8);
    ctx.fillStyle = RUST; ctx.fillText('Alchemist', px, base);
  }
  track(ctx, 2.2);
  ctx.font = mono(9.5); ctx.fillStyle = INK; ctx.fillText('YOGX — Y · CREATIVITY', px, h * 0.09 + 8);
  ctx.textAlign = 'end'; ctx.fillText('01 / THE OTHER PLANE', w - px, h * 0.09 + 8); ctx.textAlign = 'start';
  track(ctx, 0);
  ctx.font = '400 15px "Inter Tight", sans-serif'; ctx.fillText('…and on the other plane, I turn automation, tooling and systems into craft.', px, h - h * 0.09);

  const titles = ['ELIXIR · 01', 'SPELLBOOK · 02', 'ASTROLABE · 03', 'TRANSMUTATION · 04'];
  for (const p of panels) {
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, p.w, p.h);
    ctx.setLineDash([5, 4]); ctx.strokeStyle = RUST; ctx.lineWidth = 1.2; ctx.strokeRect(0, 0, p.w, p.h); ctx.setLineDash([]);
    track(ctx, 2.2); ctx.font = mono(9.5); ctx.fillStyle = RUST; ctx.fillText(titles[p.i], 14, 22); track(ctx, 0);
    ctx.fillStyle = INK; ctx.strokeStyle = INK;
    if (p.i === 0) {
      ctx.font = serif(44, false); ctx.fillText('100+', 14, 70); ctx.font = serif(17); ctx.fillText('little machines,', 14, 96); ctx.fillText('each one looked after.', 14, 116);
      ctx.beginPath(); ctx.lineWidth = 1.4; ctx.moveTo(14, p.h - 22);
      for (let k = 0; k <= p.w - 28; k += 6) ctx.lineTo(14 + k, p.h - 22 + Math.sin(k / 9) * 5 * Math.sin(k / 41));
      ctx.stroke();
    }
    if (p.i === 1) { ctx.font = serif(19); ['changelog → deploy', 'x86 → arm64', 'chaos → calm', '8 GB → just right'].forEach((l, k) => ctx.fillText(l, 14, 52 + k * 27)); }
    if (p.i === 2) {
      const cx = p.w / 2, cy = p.h / 2 + 12, r = Math.min(p.w, p.h) / 2 - 26;
      astro = { cx: p.x + cx, cy: p.y + cy, r };
      [1, 0.72, 0.38].forEach((f) => { ctx.lineWidth = f === 1 ? 1.4 : 0.8; ctx.beginPath(); ctx.arc(cx, cy, r * f, 0, Math.PI * 2); ctx.stroke(); });
      ctx.lineWidth = 0.8;
      for (let k = 0; k < 36; k++) { const a = (k * 10 * Math.PI) / 180, l = k % 3 ? 5 : 10; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.lineTo(cx + Math.cos(a) * (r - l), cy + Math.sin(a) * (r - l)); ctx.stroke(); }
      ctx.textAlign = 'center';
      ENV_GLYPHS.forEach(([g, env], k) => {
        const a = ((k * 60 - 90) * Math.PI) / 180;
        ctx.font = '14px serif'; ctx.fillStyle = RUST; ctx.fillText(g, cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86 + 4);
        track(ctx, 1); ctx.font = '400 7.5px "JetBrains Mono", monospace'; ctx.fillStyle = INK; ctx.fillText(env, cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55 + 3); track(ctx, 0);
      });
      ctx.textAlign = 'start';
    }
    if (p.i === 3) {
      ctx.font = serif(52, false); ctx.fillStyle = RUST; ctx.fillText('−75%', 14, 78); ctx.fillStyle = INK; ctx.font = serif(17); ctx.fillText("of a client's bill,", 14, 106); ctx.fillText('turned back into gold.', 14, 126);
      ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(p.w - 30, 52, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.w - 30, 52, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  return astro;
}

/** Same font, size and tracking as the page h1, each letter centred in its measured slot, so letters that match the
 *  page's stay put under the blob, each letter at its own measured box on the page's baseline. */
function paintHeadline(ctx: CanvasRenderingContext2D, hl: Headline) {
  ctx.font = `900 ${hl.fs}px ${hl.family}`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'start'; track(ctx, 0);
  for (const sl of hl.slots) {
    ctx.fillStyle = sl.line === 0 ? INK : RUST;
    ctx.fillText(sl.ch, sl.x, sl.base); // letter-spacing stays 0: x is the DOM box's left edge, where the glyph starts
  }
}
