'use client';
import { appStore, setNight } from '@/lib/appState';
import { useStore } from '@/lib/store';
import { sfx } from '@/lib/sound';
import { SoundSwitch } from './SoundSwitch';
import s from './Controls.module.css';

export function Breaker() {
  const night = useStore(appStore, (x) => x.night);
  function flip() {
    sfx.clunk();
    document.body.classList.add('flick');
    setTimeout(() => setNight(!appStore.get().night), 120);
    setTimeout(() => document.body.classList.remove('flick'), 480);
  }
  return (
    <button className={s.btn} aria-label="Toggle night mode" aria-pressed={night} onClick={flip}>
      <span className={s.house}><span className={s.slot} /><span className={`${s.lever} ${night ? s.down : ''}`} /></span>
      <span className="mono" style={{ fontSize: 8 }}>{night ? 'NIGHT' : 'DAY'}</span>
    </button>
  );
}

export function Controls() {
  const entered = useStore(appStore, (x) => x.entered);
  return <div className={s.ctrls} style={{ opacity: entered ? 1 : 0 }} inert={!entered} aria-hidden={!entered ? true : undefined}><SoundSwitch /><Breaker /></div>;
}
