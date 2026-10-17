'use client';
import { memo, useEffect, useState } from 'react';
import type { Mood } from '@/lib/robo/moods';
import { useReducedMotion } from '@/lib/useReducedMotion';
import s from './RoboChibi.module.css';

export type { Mood };

type Eyes = 'calm' | 'happy' | 'angry' | 'sad' | 'dizzy';
const EYES: Record<Mood, Eyes> = {
  idle: 'calm', walk: 'calm', run: 'calm', point: 'calm', jump: 'happy', namaste: 'happy', wave: 'happy', sit: 'happy',
  air: 'happy', angry: 'angry', sad: 'sad', sadWalk: 'sad', dizzy: 'dizzy',
};

const VIEW_W = 76, VIEW_H = 92;
const BURST: [number, number][] = [[6, 4], [58, 2], [32, -8]];

function EyeShapes({ kind, blink }: { kind: Eyes; blink: boolean }) {
  if (kind === 'calm') {
    return <>{[19, 37].map((x) => <rect key={x} className={s.fg} x={x} y={blink ? 28.5 : 22.5} width={8} height={blink ? 1.6 : 11} rx={4} />)}</>;
  }
  if (kind === 'happy') {
    return <><path className={s.sg} d="M 18.5 31 q 4.5 -6 9 0" strokeWidth={3} fill="none" strokeLinecap="round" /><path className={s.sg} d="M 36.5 31 q 4.5 -6 9 0" strokeWidth={3} fill="none" strokeLinecap="round" /></>;
  }
  if (kind === 'angry') {
    return <><path className={s.sg} d="M 17 23.5 L 27 28" strokeWidth={3} strokeLinecap="round" /><path className={s.sg} d="M 37 28 L 47 23.5" strokeWidth={3} strokeLinecap="round" />
      <rect className={s.fg} x={19.5} y={29} width={7} height={5} rx={2.5} /><rect className={s.fg} x={37.5} y={29} width={7} height={5} rx={2.5} /></>;
  }
  if (kind === 'sad') {
    return <><rect className={s.fg} x={19} y={28} width={8} height={5.5} rx={2.75} transform="rotate(14 23 30)" /><rect className={s.fg} x={37} y={28} width={8} height={5.5} rx={2.75} transform="rotate(-14 41 30)" /></>;
  }
  return <><path className={s.sg} d="M 23 29 m -4 0 a 4 4 0 1 1 4 4 a 2.5 2.5 0 1 1 -2 -3" strokeWidth={2} fill="none" /><path className={s.sg} d="M 41 29 m -4 0 a 4 4 0 1 1 4 4 a 2.5 2.5 0 1 1 -2 -3" strokeWidth={2} fill="none" /></>;
}

export type RoboChibiProps = {
  mood: Mood;
  facing: 'left' | 'right';
  /** seconds per step cycle (walk, run and the sad shuffle) */
  gait: number;
  /** px height, default 78 */
  size?: number;
  /** bump to throw a small burst of apricot sparks over the head */
  sparks?: number;
  className?: string;
  /** scene Robo: the walk cycle is paused and posed by the --step CSS variable (steps travelled), so legs match travel */
  scrub?: boolean;
};

/**
 * Robo v2: a tiny full-body chibi (head ~70%, body ~30%). One SVG rig; every mood is CSS keyframes on transforms only.
 * The arms are drawn after the head so raised hands (namaste, wave, point) stay in front of it.
 * Blinks about every 3 s while calm. Reduced motion: no animation, a static pose per mood (data-reduce).
 */
export const RoboChibi = memo(function RoboChibi({ mood, facing, gait, size = 78, sparks = 0, className, scrub }: RoboChibiProps) {
  const reduce = useReducedMotion();
  const [blink, setBlink] = useState(false);
  const calm = EYES[mood] === 'calm';

  useEffect(() => {
    if (reduce || !calm) return;
    let open: ReturnType<typeof setTimeout> | undefined;
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      setBlink(true);
      open = setTimeout(() => setBlink(false), 130);
    }, 3100);
    return () => { clearInterval(t); clearTimeout(open); setBlink(false); };
  }, [reduce, calm]);

  return (
    <div
      className={[s.root, className].filter(Boolean).join(' ')}
      data-chibi=""
      data-mood={mood}
      data-facing={facing}
      data-reduce={reduce ? 'true' : undefined}
      data-scrub={scrub ? 'true' : undefined}
      aria-hidden="true"
      style={{ height: size, width: (size * VIEW_W) / VIEW_H, '--g': `${scrub ? 1 : gait}s` } as React.CSSProperties}
    >
      <div className={s.flip}>
        <svg className={s.rig} viewBox={`-6 -8 ${VIEW_W} ${VIEW_H}`}>
          <g className={s.all}>
            <g className={s.ll}><rect className={s.fl} x={25.5} y={63} width={5} height={9} rx={2.5} /><ellipse className={`${s.fb} ${s.sl}`} cx={27.5} cy={73} rx={5} ry={2.8} strokeWidth={1} /></g>
            <g className={s.rl}><rect className={s.fl} x={33.5} y={63} width={5} height={9} rx={2.5} /><ellipse className={`${s.fb} ${s.sl}`} cx={36.5} cy={73} rx={5} ry={2.8} strokeWidth={1} /></g>

            <rect className={`${s.fb} ${s.sl}`} x={22} y={49} width={20} height={16} rx={7} strokeWidth={1.6} />
            <circle className={s.light} cx={32} cy={57} r={2.2}>{!reduce && <animate attributeName="opacity" values="1;.35;1" dur="2.2s" repeatCount="indefinite" />}</circle>

            <g className={s.head} data-part="head">
              <g className={s.ant}><line className={s.sl} x1={32} y1={10} x2={32} y2={2} strokeWidth={2.4} strokeLinecap="round" /><circle className={s.fg} cx={32} cy={0} r={3.4} /></g>
              <path className={s.sl} d="M 4 22 A 28 18 0 0 1 60 22" strokeWidth={3.6} fill="none" strokeLinecap="round" />
              <rect className={`${s.fb} ${s.sl}`} x={7} y={10} width={50} height={38} rx={14} strokeWidth={1.8} />
              <rect className={s.fv} x={5} y={17} width={4} height={17} rx={2} /><rect className={`${s.fl} ${s.sl}`} x={0} y={15} width={7} height={21} rx={3} strokeWidth={1.4} />
              <rect className={s.fv} x={55} y={17} width={4} height={17} rx={2} /><rect className={`${s.fl} ${s.sl}`} x={57} y={15} width={7} height={21} rx={3} strokeWidth={1.4} />
              <rect className={`${s.fv} ${s.sl}`} x={12.5} y={17} width={39} height={24} rx={10} strokeWidth={1} />
              <g><EyeShapes kind={EYES[mood]} blink={blink && calm} /></g>
              <circle className={s.fg} cx={15} cy={37} r={1.8} opacity={0.35} /><circle className={s.fg} cx={49} cy={37} r={1.8} opacity={0.35} />
              <g className={s.steam} fill="none" strokeWidth={1.4} strokeLinecap="round"><path d="M 2 13 q -2 -4 0 -7" /><path d="M 62 13 q 2 -4 0 -7" /></g>
            </g>

            <g className={s.la} data-part="arm"><rect className={s.fl} x={18.5} y={53} width={5} height={11} rx={2.5} /><circle className={`${s.fb} ${s.sl}`} cx={21} cy={65} r={3.2} strokeWidth={1} /></g>
            <g className={s.ra} data-part="arm"><rect className={s.fl} x={40.5} y={53} width={5} height={11} rx={2.5} /><circle className={`${s.fb} ${s.sl}`} cx={43} cy={65} r={3.2} strokeWidth={1} />
              <g className={s.mug}><rect className={`${s.fb} ${s.sl}`} x={39} y={62} width={8} height={8.5} rx={1.5} strokeWidth={1.1} /><path className={s.sl} d="M 47 64 Q 50 64 50 66.2 Q 50 68.4 47 68.4" fill="none" strokeWidth={1.1} /></g></g>

            <g className={s.cloud}><ellipse className={s.fcloud} cx={32} cy={-14} rx={12} ry={5} /><ellipse className={s.fcloud} cx={26} cy={-16} rx={6} ry={5} /><ellipse className={s.fcloud} cx={37} cy={-17} rx={7} ry={6} />
              {[[26, 25], [32, 31], [38, 37]].map(([x1, x2]) => <line key={x1} x1={x1} y1={-9} x2={x2} y2={-5} stroke="#6b8aa3" strokeWidth={1.2} strokeLinecap="round" />)}</g>
            <g className={`${s.spark} ${s.fg}`}><path d="M 32 44 l 1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4z" transform="translate(-1 6)" /></g>
            <g className={`${s.stars} ${s.fg}`}><path d="M 18 -4 l 1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1z" /><path d="M 46 -4 l 1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1z" /></g>
          </g>
          <g key={sparks} className={s.burst}>{sparks > 0 && BURST.map(([x, y], i) => <circle key={i} className={`${s.pop} ${s.fg}`} style={{ animationDelay: `${i * 90}ms` }} cx={x} cy={y} r={1.8} />)}</g>
        </svg>
        <span className={s.shadow} />
        <i className={s.dust} /><i className={s.dust} />
      </div>
    </div>
  );
});
