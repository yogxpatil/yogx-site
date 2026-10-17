'use client';
import { appStore } from '@/lib/appState';
import { useStore } from '@/lib/store';
import { sfx } from '@/lib/sound';
import s from './Controls.module.css';

export function SoundSwitch() {
  const on = useStore(appStore, (x) => x.sound);
  return (
    <button className={`${s.btn} ${on ? s.on : ''}`} aria-label="Toggle sound" aria-pressed={on} onClick={() => { sfx.set(!on); if (!on) sfx.blip(); }}>
      <span className={s.house}><span className={s.bars}><i /><i /><i /></span></span>
      <span className="mono" style={{ fontSize: 8 }}>SND</span>
    </button>
  );
}
