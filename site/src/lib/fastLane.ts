const RETURN_KEY = 'yogx:return';
const NIGHT_KEY = 'yogx:night';

/** Remember where the visitor was (and day/night), then go to the fast lane page. */
export function goFastLane(assign: (url: string) => void = (u) => location.assign(u)): void {
  try {
    sessionStorage.setItem(RETURN_KEY, String(Math.round(window.scrollY)));
    sessionStorage.setItem(NIGHT_KEY, document.documentElement.classList.contains('night') ? '1' : '0');
  } catch { /* storage blocked: still go, the way back just lands at the top */ }
  assign('/fast-lane/');
}

/** Read and clear the saved scroll position. null when there is none or storage is unavailable. */
export function consumeReturn(): number | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(RETURN_KEY);
    const y = Number(raw);
    return Number.isFinite(y) && y >= 0 ? y : null;
  } catch { return null; }
}

/** Forget the saved day/night once it has been applied, so a later direct visit does not pick up a stale value. */
export function clearNight(): void {
  try { sessionStorage.removeItem(NIGHT_KEY); } catch { /* nothing to clear */ }
}

/** Day/night the visitor had on the main page, if they came from it. */
export function savedNight(): boolean {
  try { return sessionStorage.getItem(NIGHT_KEY) === '1'; } catch { return false; }
}
