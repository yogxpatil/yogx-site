import { createStore } from '@/lib/store';

/** True while any headline letter is out of its slot (thrown, falling, resting or flying back).
 *  The blob reads it to pause its render loop: it is faded out then, and a low-end PC has no frame to spare. */
export const looseStore = createStore({ loose: false });
