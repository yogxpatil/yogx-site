export const OCD_STATIONS = ['BUILD', 'TEST', 'SB', 'PROD'] as const;
export const stationLeft = (i: number) => 12 + i * 25;

const NODES = [0, stationLeft(0), stationLeft(1), stationLeft(2), stationLeft(3)]; // ticket starts at 0%, then each station
const HOLD = 0.3; // last 30% of each leg: the ticket sits on the station and it lights up
/** Ticket position (% of the track) and number of lit stations at scene progress p; reversible, holds when p stops. */
export function ocdAt(p: number): { left: number; lit: number } {
  const t = Math.min(1, Math.max(0, (p - 0.08) / 0.8)) * 4, i = Math.min(3, Math.floor(t)), f = t - i;
  const m = Math.min(1, f / (1 - HOLD)), e = m * m * (3 - 2 * m);
  return { left: NODES[i] + (NODES[i + 1] - NODES[i]) * e, lit: i + (m >= 1 ? 1 : 0) };
}
