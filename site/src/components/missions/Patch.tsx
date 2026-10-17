import { useId } from 'react';
import { PATCH_PATH, patchRing, patchMark } from '@/lib/missions/patch';
import s from './Scene.module.css';
export function Patch({ code, name }: { code: string; name: string }) {
  const id = `pp${useId().replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg className={s.patch} viewBox="0 0 104 104" aria-hidden>
      <defs><path id={id} d={PATCH_PATH} /></defs>
      <circle cx={52} cy={52} r={50} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <circle cx={52} cy={52} r={31} fill="#f99e67" stroke="currentColor" strokeWidth={1.5} />
      <g className={s.spin}><text className={s.ring}><textPath href={`#${id}`}>{patchRing(code, name)}</textPath></text></g>
      <text x={52} y={57} textAnchor="middle" className={s.mark}>{patchMark(code)}</text>
    </svg>
  );
}
