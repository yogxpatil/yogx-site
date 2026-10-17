export const PATCH_PATH = 'M52 52 m-40 0 a40 40 0 1 1 80 0 a40 40 0 1 1 -80 0';
export const patchRing = (code: string, name: string) => `MISSION ${code} · ${name} · YOGX ·`;
export const patchMark = (code: string) => code.split('-')[0];
