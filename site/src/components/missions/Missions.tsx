import { missions, missionsHead, doorZones } from '@/content/site';
import { DoorZone } from '@/components/transitions/DoorZone';
import { Scene } from './Scene';
import { OcdStage } from './OcdStage';
import { EcgOverlay, HeartBeatStage } from './HeartBeat';
import { CommandCenterStage } from './CommandCenterStage';
import { EcsStage } from './EcsStage';
import { ContainerTiles } from '@/components/transitions/ContainerTiles';
import s from './Scene.module.css';

const [cc, hb, ecs, ocdM] = missions;
export function Missions() {
  return (
    <section id="c4" data-tone="light" aria-label="Missions" className={s.missions}>
      {/* The doors already announce "Missions · sector 04", so the chapter title is a quiet label over the first scene:
          the doors open onto one whole scene instead of half a title and half a scene. */}
      <h2 className={`mono ${s.head}`}>{missionsHead.kicker.split(' / ')[0]} / {missionsHead.title} {missionsHead.em} <span>· {missionsHead.kicker.split(' / ')[1]}</span></h2>
      <Scene mission={cc} stage={<CommandCenterStage />} />
      <DoorZone zone={doorZones.hb} />
      <Scene mission={hb} overlay={<EcgOverlay />} stage={<HeartBeatStage />} />
      <Scene mission={ecs} overlay={<ContainerTiles />} stage={<EcsStage />} />
      <DoorZone zone={doorZones.ocd} />
      <Scene mission={ocdM} stage={<OcdStage />} />
    </section>
  );
}
