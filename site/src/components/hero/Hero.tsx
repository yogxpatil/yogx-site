import { hero } from '@/content/site';
import { segments } from '@/lib/blob/headlineSlots';
import { Instruments } from './Instruments';
import { BreakableHeadline } from './BreakableHeadline';
import { HeroFootnote } from './HeroFootnote';
import s from './Hero.module.css';

// data-slot letters are the ones the blob painter re-draws on the other plane; data-base is a zero-size probe
// whose top edge is the exact text baseline.
const Probe = () => <i className={s.base} data-base />;

// data-letter marks the page letters you can grab and throw (BreakableHeadline).

/** One line as anchors + segments. Anchors are letters both words share in the same position: plain, never move.
 *  A segment holds both strings stacked in one cell (cell = the wider string); each string spreads its letters over
 *  the cell, so the narrower word gets a slightly looser tracking instead of a hole. The Alchemist string is hidden
 *  and only sizes the cell: the painted plane draws it at the measured spot of each hidden letter. */
function Line({ page, alch, line }: { page: string; alch: string; line: number }) {
  const o = (id: string) => (line === 0 && id === 'O' ? { 'data-o': '' } : {});
  return (
    <span aria-hidden>
      {segments(page, alch).map((p, i) => 'anchor' in p
        ? <span key={i} data-slot data-anchor data-letter data-line={line} data-ch={p.anchor}>{p.anchor}<Probe /></span>
        : (
          <span key={i} className={s.seg}>
            <span className={s.row}>{[...p.page].map((c, j) => <span key={j} data-letter {...o(c)}>{c}</span>)}</span>
            <span className={`${s.row} ${s.alch}`}>{[...p.alch].map((c, j) => <span key={j} data-slot data-line={line} data-ch={c}>{c}<Probe /></span>)}</span>
          </span>
        ))}
    </span>
  );
}

export function Hero({ blob }: { blob: React.ReactNode }) {
  return (
    <>
      <div className={s.plane} data-hero-stage>
        {/* signature lockup: his name reads first, right on top of the headline; the h1 carries it for screen readers */}
        <div className={s.sig} data-hero-name aria-hidden>
          <span className={`serif ${s.name}`}>{hero.name}</span><i className={s.rule} /><span className={`mono ${s.kick}`}>{hero.kicker}</span>
        </div>
        <BreakableHeadline className={s.big}>
          <span className="sr-only">{hero.name} — {hero.architect.join(' ')} — and on the other plane, {hero.alchemist.join(' ')}</span>
          <Line page={hero.architect[0]} alch={hero.alchemist[0]} line={0} /><br />
          <b><Line page={hero.architect[1]} alch={hero.alchemist[1]} line={1} /><span className={s.ast} aria-hidden>*</span></b>
        </BreakableHeadline>
        <div className={`mono ${s.foot}`}><div><p>{hero.lead}</p><HeroFootnote /></div></div>
        <Instruments />
      </div>
      <div className={s.blobLayer} data-blob-layer>{blob}</div>
      <div className={`mono ${s.hint}`} aria-hidden>Scroll, or turn the dial ↘</div>
    </>
  );
}
