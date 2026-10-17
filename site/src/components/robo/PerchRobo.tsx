'use client';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { activeLine, node, speech, type Pt } from '@/lib/missions/actor';
import type { Mood } from '@/lib/robo/moods';
import { SceneActor, type ActorHandle, type Line } from './SceneActor';

export type PerchHandle = { update(p: number): void };
type Props = { name: string; line: Line; at: Pt; from: number; mood?: Mood; facing?: 'left' | 'right'; size?: number; tone?: 'ink' | 'cream'; bubbleWidth?: number };

/**
 * A scene Robo who just stands at one spot and says one note (owner, 2026-10-17: "a little note in every section, so he
 * feels like a genuine guide"). The section calls update(p) with its own scroll progress; the note owns [from, end of
 * the section] and fades in like every scene line. Used where a section has no Robo story of its own.
 */
export const PerchRobo = forwardRef<PerchHandle, Props>(function PerchRobo({ name, line, at, from, mood = 'idle', facing = 'right', size = 84, tone = 'ink', bubbleWidth = 280 }, ref) {
  const actor = useRef<ActorHandle>(null);
  useImperativeHandle(ref, () => ({
    update: (p) => actor.current?.set({ pose: node(at, p >= from ? (mood === 'idle' ? 'point' : mood) : 'idle', facing), ...speech(p, [from]), active: activeLine(p, [from]) }),
  }));
  return <SceneActor ref={actor} name={name} lines={[line]} size={size} tone={tone} bubbleWidth={bubbleWidth} />;
});
