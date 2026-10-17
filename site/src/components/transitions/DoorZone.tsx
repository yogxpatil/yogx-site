import type { DoorZoneData } from '@/content/site';
import s from './BlastDoors.module.css';
export function DoorZone({ zone }: { zone: DoorZoneData }) {
  return <div className={`${s.tz} ${s[zone.bg]}`} data-door-zone data-sector={zone.sector} data-name={zone.name} aria-hidden />;
}
