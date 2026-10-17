import { transmissions } from '@/content/site';
import { waveD } from '@/lib/chapters/wave';
import s from './Transmissions.module.css';

export function Transmissions() {
  return (
    <section id="c6" data-tone="dark" className={s.tx} aria-label="Transmissions">
      <div className={s.top}><h2>{transmissions.title[0]}<em>{transmissions.title[1]}</em></h2><span className="mono" style={{ color: '#8c8470' }}>{transmissions.kicker}</span></div>
      {transmissions.rows.map((r, k) => {
        const body = (<><span className={s.fq}>{r.fq}</span><h3>{r.pre}<em>{r.em}</em>{r.post}</h3><span className={s.go}>{r.go}</span>
          <svg viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden><path d={waveD(k)} /></svg></>);
        return r.href ? <a key={r.fq} href={r.href} className={s.row}>{body}</a> : <div key={r.fq} role="group" aria-label={`${r.fq}${r.soon ? ': coming soon' : ': link coming soon'}`} className={`${s.row} ${r.soon ? s.soon : ''}`}>{body}</div>;
      })}
    </section>
  );
}
