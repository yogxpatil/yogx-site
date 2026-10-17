import { sceneLengths, type DoorZoneData } from '@/content/site';
import s from './BlastDoors.module.css';
export function DoorZone({ zone }: { zone: DoorZoneData }) {
  // height: sceneLengths.door (vh); the doors' close / hold / open is spread over it (lib/transitions/doors zoneValue)
  return <div className={`${s.tz} ${s[zone.bg]}`} style={{ height: `${sceneLengths.door}vh` }} data-door-zone data-sector={zone.sector} data-name={zone.name} aria-hidden />;
}
