import { Gate } from '@/components/Gate';
import { Controls } from '@/components/Breaker';
import { Hud } from '@/components/Hud';
import { MainShell } from '@/components/MainShell';
import { Dial } from '@/components/Dial';
import { ScrollProvider } from '@/components/ScrollProvider';
import { HeroWrap } from '@/components/hero/HeroWrap';
import { HeroBlob } from '@/components/hero/HeroBlob';
import { Manifesto } from '@/components/chapters/Manifesto';
import { FlightPath } from '@/components/chapters/FlightPath';
import { DoorZone } from '@/components/transitions/DoorZone';
import { BlastDoors } from '@/components/transitions/BlastDoors';
import { doorZones } from '@/content/site';
import { Missions } from '@/components/missions/Missions';
import { MissionLog } from '@/components/chapters/MissionLog';
import { Transmissions } from '@/components/chapters/Transmissions';
import { Signal } from '@/components/chapters/Signal';
import { RoboGuide } from '@/components/robo/RoboGuide';

export default function Home() {
  return (
    <ScrollProvider>
      <Gate />
      <Hud />
      <Controls />
      <MainShell>
        <HeroWrap blob={<HeroBlob />} />
        <Manifesto />
        <DoorZone zone={doorZones.flight} />
        <FlightPath />
        <DoorZone zone={doorZones.missions} />
        <Missions />
        <MissionLog />
        <DoorZone zone={doorZones.tx} />
        <Transmissions />
        <DoorZone zone={doorZones.signal} />
        <Signal />
      </MainShell>
      <BlastDoors />
      <Dial />
      <RoboGuide />
    </ScrollProvider>
  );
}
