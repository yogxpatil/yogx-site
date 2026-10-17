// All of Robo's lines. Hinglish in Latin script. Copied from the spec where given.
import type { ChapterId, DareId, EggId, Gag } from '@/lib/robo/brain'

export const CHAPTER_LINES: Partial<Record<'c1' | 'c2' | 'c3' | 'c5' | 'c6' | 'c7', string>> = {
  c1: 'Namaste! Main Robo. Iss bande ka tour guide. Jaldi hai? Fast lane le lo →',
  c2: 'Yeh quotes usne khud likhe. Main sirf nod karta hoon.',
  c3: 'Dekho, stability se creativity tak. Beech mein kaafi coffee hai.',
  c5: 'Intern se lead tak. Main witness hoon, sab sach hai.',
  c6: 'Blogs bhi likhta hai. Haan, raat ko.',
  c7: 'Bas, ab baat karo. Main chai lekar aata hoon.',
}

export const GOSSIP: string[] = [
  'Yeh banda koi kaam do baar kare toh robot bana deta hai. Main saboot hoon.',
  'Production ko chhoone se pehle before/after dikhata hai. Har baar.',
  "Isko answer pehli line mein chahiye. Warna 'bro, first line'.",
  "Raat ke 10 baje bhi 'continue bro'.",
]

export const DARE_WARN: Record<DareId, string> = {
  blob: 'Blob ko touch mat karna.',
  four: '4 mat dabana.',
  up: 'Upar scroll mat karna.',
}

export const DARE_DONE: Record<DareId, { text: string; gag: Gag }> = {
  blob: { text: 'Bola tha na!', gag: 'painted' },
  four: { text: 'SPOILER!', gag: 'spoiler' },
  up: { text: 'Maine BOLA tha…', gag: 'topple' },
}

export const REACT = {
  fastScroll: 'Arre bhai, itna fast kahan? Ruk, cool cheez dikhata hoon.',
  scrollUp: 'Wapas? Kuch miss kiya kya?',
  idle: 'Main yahin hoon. Aaram se.',
}

export const EGG_HINTS: Record<EggId, string> = {
  og3: 'Hint: Signal page pe kuch chhupa hai',
  yogx: 'Hint: keyboard pe kuch likh ke dekho',
  breaker5: 'Hint: woh night breaker ko jaldi jaldi dabao',
  letterHold: 'Hint: blob ko kisi headline letter pe rok ke dekho',
  prod2: 'Hint: radar pe PROD2 ko dekha?',
}

/** Where each dare warning / egg hint may be said (only in these chapters). Gossip may be said anywhere. */
export const DARE_CHAPTERS: Record<DareId, ChapterId[]> = {
  blob: ['c1'],
  four: ['c1', 'c2', 'c3'],
  up: ['c3', 'c5', 'c6'],
}

export const HINT_CHAPTERS: Record<EggId, ChapterId[]> = {
  letterHold: ['c1'],
  prod2: ['c1'],
  yogx: ['c2', 'c3'],
  breaker5: ['c2', 'c3', 'c5'],
  og3: ['c6', 'c7'],
}

/** Order hints are tried in when several are eligible. */
export const HINT_ORDER: EggId[] = ['letterHold', 'prod2', 'yogx', 'breaker5', 'og3']

export const EGG_FOUND: Record<EggId, string> = {
  og3: 'OG seal pakda! Teen baar, pakka chhupa raaz.',
  yogx: 'Naam likha, Robo aa gaya. Smart.',
  breaker5: 'Power cut! Bijli walon ko mat batana.',
  letterHold: 'Notice kiya? Yeh letter nahi badalta.',
  prod2: 'PROD2 ka raaz mat poochho.',
}

export const HUSH_ON = 'Theek hai… main chala jaata hoon.'
export const HUSH_OFF = 'Wapas aa gaya!'

/** CommandCenter: said once he has fixed the rows and climbed out of the app window (owner's line, 2026-10-17 review). */
export const CC_OUT_LINE = 'Yeh accha hai… ab yahan sukoon hai.'

export const CC_BACKSTORY: string[] = [
  'Main pehle CommandCenter mein kaam karta tha.',
  'Har galat changelog maine check kiya. System khud likh sakta tha, phir bhi.',
  'Phir boss impress hua, aur yahan bhi hire kar liya.',
  'Yahan sukoon hai. No tension. Bas guide karta hoon.',
]

// ---- Phase 2: scene Robo lines (scroll-tied, one per range; Claude's drafts for the owner to tune) ----
/** HeartBeat: his one note beside the monitor. */
export const HB_LINE = 'HeartBeat: sab services ki dhadkan ek jagah. Flatline dikhe toh main pehle bhaagta hoon.'
/** ECS: while he carries the EC2 boxes, and once the label flips. */
export const ECS_LINES: string[] = [
  'Ek ek karke. Har service ko apna dabba milega.',
  'EC2 se ECS. Same budget, crash kam. Mehnat meri, credit uska.',
]
/** OCD: one short line as he lands on each station (BUILD, TEST, SB, PROD). */
export const OCD_LINES: string[] = [
  'Build ho gaya. Image pushed.',
  '214 tests, sab green. Main bhi check karta hoon.',
  'Sandbox mein smoke ok. Ab asli wala.',
  'PROD! Zero manual steps. Changelog likho, chai piyo.',
]
/** Mission log: one line for each entry he walks to (same order as missionLog.rows). */
export const LOG_LINES: string[] = [
  'Intern tha. Pehla kaam hi poori team use karti hai.',
  'CTO ne khud chuna. Main bhi impress tha.',
  'Poora fleet arm64 pe. Sasta bhi, tez bhi.',
  'Ek pipeline, chhe environments. Bas ek jagah se.',
  'HeartBeat akele banaya. CEO ne LinkedIn pe share kiya!',
  'OCD lead kiya. Wahi jo abhi dekha.',
  'Aur ab? Abhi bhi curious. Main witness hoon.',
]
/** Transmissions: one line on each post he sits on. */
export const TX_LINES: string[] = [
  'Rust aur C, ek Lambda mein. Raat ko likha, obviously.',
  'Apna Terraform provider. Haan, zero se.',
  '100 services ka right-sizing. Bill ne thank you bola.',
]

export const FAST_LANE_LINE = 'Told you he was good.'

export const VISIT_OFFER = 'Apna deploy dekhna hai? Neeche "Your deploy" dabao.'
export const VISIT_AMBER = 'Arre, thoda amber hai. Tera network, meri galti nahi.'

/** Said when the thrown headline letters fly back to their slots (like pods coming back healthy). */
export const RESTART_LINE = 'rollout restart…'
