import type { Milestone } from '@/lib/chapters/route';
import type { Seg } from '@/lib/missions/robo';
import { CC_BACKSTORY, CC_OUT_LINE } from '@/content/robo-script';
/** 'auto' chapters repaint with the day/night breaker: they read as light in day and dark at night. */
export type Tone = 'light' | 'dark' | 'apri' | 'auto';
export type Chapter = { id: string; num: number; name: string; tone: Tone };
export type FeedRow = { time: string; ticket: string; kind: string; env: string };

export const chapters: Chapter[] = [
  { id: 'c1', num: 1, name: 'Two planes', tone: 'light' },
  { id: 'c2', num: 2, name: 'Manifesto', tone: 'auto' },
  { id: 'c3', num: 3, name: 'Flight path', tone: 'light' },
  { id: 'c4', num: 4, name: 'Missions', tone: 'light' },
  { id: 'c5', num: 5, name: 'Mission log', tone: 'light' },
  { id: 'c6', num: 6, name: 'Transmissions', tone: 'dark' },
  { id: 'c7', num: 7, name: 'Signal', tone: 'auto' },
];

export const envs = ['DEV', 'QA', 'SB', 'STG', 'PROD', 'PROD2'];

export const feedSeed: FeedRow[] = [
  { time: '', ticket: 'YX-0412', kind: 'ECS', env: 'PROD' },
  { time: '', ticket: 'YX-0413', kind: 'LAMBDA', env: 'SB' },
  { time: '', ticket: 'YX-0417', kind: 'API', env: 'QA' },
  { time: '', ticket: 'YX-0420', kind: 'DDB', env: 'SB' },
  { time: '', ticket: 'YX-0426', kind: 'ECS', env: 'STG' },
  { time: '', ticket: 'YX-0431', kind: 'LAMBDA', env: 'PROD' },
];

export const hero = {
  architect: ['DevOps', 'Architect'],
  alchemist: ['Digital', 'Alchemist'],
  name: 'Yogesh Patil',
  kicker: 'YogX — X · Stability',
  lead: 'DevOps & Site Reliability Engineer: I design infrastructure that stays calm under load.',
  alchemistLead: '…and on the other plane, I turn automation, tooling and systems into craft.',
  fleetCount: '100+',
  savingsPct: 75,
};
export const manifesto = {
  label: '02 / Manifesto',
  // owner-approved wording and order; the italic middle lines are meant to stay lowercase
  quotes: [
    ['I BUILD THE ROBOT', 'the second time', 'I DO ANYTHING.'],
    ['I CHECK TWICE', 'so production', 'NEVER HAS TO.'],
    ['I PROVE IT FIRST,', 'then I make it', 'BEAUTIFUL.'],
    ['I AUTOMATE THE BORING', 'so people get to do', 'THE BRILLIANT.'],
    ['I BELIEVE IN BORING', 'infrastructure and', 'BOLD DESIGN.'],
  ] as const,
};

/**
 * Scroll lengths (vh) that give each scene room (Robo phase 2, owner review 2026-10-17: "give some time"). Every scene
 * with a story is pinned for `extra` vh, and its story only runs inside that pin: after the doors before it are fully
 * open, before the next ones start closing. `door` is each blast-door zone's height (was 100: slower doors).
 * One place to tune; every 10vh added to a scene is 10vh more page.
 */
export const sceneLengths = { door: 115, cc: 220, hb: 50, ecs: 70, ocd: 60, log: 40, tx: 40 } as const;

export type DoorZoneData = { sector: string; name: string; bg: 'paper' | 'night' | 'apri' };
export const doorZones = {
  flight: { sector: '03', name: 'Flight path', bg: 'paper' },
  missions: { sector: '04', name: 'Missions', bg: 'paper' },
  hb: { sector: 'HB-02', name: 'HeartBeat', bg: 'night' },
  ocd: { sector: 'OCD-04', name: 'One-click deploy', bg: 'apri' },
  tx: { sector: '06', name: 'Transmissions', bg: 'night' },
  signal: { sector: '07', name: 'Signal', bg: 'paper' },
} satisfies Record<string, DoorZoneData>;

export const flight = {
  label: '03 / Flight path · the YogX map',
  title: ['Two axes.', 'One ', 'original', ' output.'] as const,
  body: 'Most engineers pick a side: stable or creative. I work on both planes at once. Scroll and watch the work travel from pure stability towards the top-right corner, where it becomes OG.',
  legend: ['X → Stability', 'Y ↑ Creativity', 'OG = both, at full strength'],
  milestones: [
    { t: 0.16, a: 'EC2 → ECS migration', b: 'pure stability', dx: 0, dy: -150, an: 'start' },
    { t: 0.38, a: 'Terraform everything', b: 'infra as code', dx: 10, dy: -120, an: 'start' },
    { t: 0.6, a: 'arm64 fleet', b: 'cheaper, by design', dx: 50, dy: 70, an: 'start' },
    { t: 0.78, a: 'Custom Lambda runtimes', b: 'Rust & C, for fun', dx: -40, dy: 80, an: 'end' },
    { t: 0.9, a: 'HeartBeat · OCD', b: 'tools people love', dx: -60, dy: -10, an: 'end' },
  ] as Milestone[],
};

export type Mission = { id: 'sc-cc' | 'sc-hb' | 'sc-ecs' | 'sc-ocd'; num: string; code: string; patchName: string; scene: string; title: [string, string]; body: string; facts: [string, string][]; tone: Tone; sweep: boolean };
export const missionsHead = { title: 'Mission', em: 'files', kicker: '04 / Each mission gets its own world' };
export const missions: Mission[] = [
  { id: 'sc-cc', num: '01', code: 'CC-01', patchName: 'COMMANDCENTER', scene: 'CommandCenter', title: ['Releases that', 'check themselves.'],
    body: 'Every deploy changelog is parsed, matched against what really exists in AWS, and scored before a human ever reviews it.', facts: [['42', 'rules'], ['~33%', 'manual → auto']], tone: 'light', sweep: true },
  { id: 'sc-hb', num: '02', code: 'HB-02', patchName: 'HEARTBEAT', scene: 'HeartBeat Portal', title: ['One pulse for', 'every service.'],
    body: 'Self-built ECS health and cost dashboard: every service across every environment, overloaded ones flagged first, memory-leak hints, 6-hour trends. The CEO praised it publicly.', facts: [['4', 'envs, auto-rotate'], ['6h', 'trend lines']], tone: 'dark', sweep: false },
  { id: 'sc-ecs', num: '03', code: 'ECS-03', patchName: 'FLEET MIGRATION', scene: 'EC2 → ECS', title: ['Loose servers,', 'packed into order.'],
    body: '100+ containers moved off memory-starved 8 GB EC2 boxes (constant out-of-memory crashes) onto right-sized ECS with autoscaling, inside the old budget. Then the whole fleet went x86 → arm64.', facts: [['100+', 'containers'], ['75%', 'client cost cut']], tone: 'light', sweep: false },
  { id: 'sc-ocd', num: '04', code: 'OCD-04', patchName: 'ONE-CLICK DEPLOY', scene: 'OCD pipeline', title: ['One changelog in.', 'Deploys out.'],
    body: 'One-Click Deployment, which I led with a team of 3. An orchestrator reads a formatted changelog, decides create-or-update for every ECS, Lambda, API and DynamoDB change, and dispatches it. It replaced releases that needed 5–6 engineers by hand.', facts: [['5–6', 'engineers → 0'], ['1', 'changelog']], tone: 'apri', sweep: false },
];
export const ccApp = { title: 'CommandCenter · pre-verify', stamp: ['VERIFIED', 'CLEAN FOR REVIEW'] as const };
export const ccRows = [
  { ticket: 'YX-0412', file: 'changelog.md', kind: 'fail', label: '✕ FAIL' },
  { ticket: 'YX-0413', file: 'automation.json', kind: 'warn', label: '! MISSING' },
  { ticket: 'YX-0417', file: 'changelog.md', kind: 'fail', label: '✕ FAIL' },
  { ticket: 'YX-0420', file: 'lambda: wrong env', kind: 'fail', label: '✕ FAIL' },
  { ticket: 'YX-0426', file: 'changelog.md', kind: 'warn', label: '! TYPO' },
  { ticket: 'YX-0431', file: 'table not found', kind: 'fail', label: '✕ FAIL' },
] as const;
/** CommandCenter Robo's lines: the line he says once he is out of the app window, then his backstory (one source in
 *  robo-script.ts); line 2 of the backstory has its first sentence in bold, split from the script so the two never drift. */
const boldFirst = (l: string): Seg[] => { const k = l.indexOf('. ') + 1; return [{ t: l.slice(0, k), b: true }, { t: l.slice(k) }]; };
export const roboLines: Seg[][] = [[{ t: CC_OUT_LINE }], ...CC_BACKSTORY.map((l, i) => (i === 1 ? boldFirst(l) : [{ t: l }]))];
export const ocd = { ticket: 'YX-0412', file: 'changelog.md', logs: ['build #812 ✓  image pushed', 'tests 214/214 ✓', 'deployed to sandbox ✓  smoke ok', 'PROD ✓  rollout complete · 0 manual steps'] };
export const heartbeat = { monitor: 'HEARTBEAT · LIVE', services: ['auth', 'agent-cud', 'codegen', 'gateway', 'ledger', 'notify'] };

export type LogRow = { yr: string; small: string; title: string; body: string; big: string; tag: string; now?: boolean; certs?: { label: string; amber?: boolean }[] };
// Years are guesses for the owner to confirm (spec §11.1).
export const missionLog = {
  head: ['Mission', 'log'] as const, kicker: '05 / Intern to lead, in order · years ≈ placeholder', yearsPlaceholder: true,
  rows: [
    { yr: '2023', small: 'T+0 · LAUNCH', title: 'Joined as an intern. First task: reusable Terraform modules.', body: 'Including the ECS module the whole team still builds on. New environments went from hand-built to a few inputs, and the 6+ environments stopped drifting apart.', big: '6+', tag: 'ENVS, ONE MODULE' },
    { yr: '2023', small: 'T+1 · FIRST BIG BURN', title: 'EC2 → ECS migration, picked by the CTO.', body: '100+ containers off crash-prone 8 GB EC2 machines, one task per service, CPU and memory autoscaling, all inside the old EC2 budget.', big: '100+', tag: 'CONTAINERS MOVED' },
    { yr: '2024', small: 'T+2 · STAGE TWO', title: 'The whole fleet to arm64 (Graviton).', body: '100+ services × 6 environments: Dockerfiles, base images and build pipelines rebuilt for arm64.', big: '×6', tag: 'ENVS ON ARM64' },
    { yr: '2024', small: 'T+2 · GROUND SYSTEMS', title: 'One deploy pipeline for every service.', body: 'Parent-child dynamic GitLab CI/CD: deploy any service to any of 6 environments from a single place.', big: '1', tag: 'PIPELINE, 6 ENVS' },
    { yr: '2025', small: 'T+3 · TELEMETRY', title: 'HeartBeat, built on my own.', body: 'The ECS health and cost dashboard the team watches. The CEO shared it publicly on LinkedIn.', big: 'CEO', tag: 'PRAISED IT' },
    { yr: '2025', small: 'T+3 · COMMAND', title: 'Led OCD, One-Click Deployment.', body: 'A team of 3; changelog-driven automation that replaced error-prone releases run by 5–6 engineers.', big: '3', tag: 'PERSON TEAM, LED' },
    { yr: 'NOW', small: 'T+3.5 · IN ORBIT', title: 'DevOps & Site Reliability Engineer.', body: 'Still curious, still shipping originals.', big: 'OG', tag: 'ORIGINAL OUTPUT', now: true,
      certs: [{ label: '✓ HASHICORP TERRAFORM ASSOCIATE' }, { label: 'AWS SOLUTIONS ARCHITECT · IN PROGRESS', amber: true }] },
  ] as LogRow[],
};
// Only TX-01 is a confirmed title (its URL is still pending, so it is not a link yet); the others stay "INCOMING…" until the owner confirms them.
// self-aware footnotes for the asterisk after the hero headline: one per visit at random, a click cycles (owner, 2026-10-17)
export const heroFootnotes = [
  '*Ships infrastructure for a living. Builds websites to relax. Imagine if he actually tried.',
  '*Infra by day, pixels by night. Somebody had to make DevOps look good.',
  '*Built by the guy who keeps your deploys green. Yes, he did the CSS too.',
] as const;
export const transmissions = {
  title: ['Field ', 'transmissions.'] as const, kicker: '06 / Writing from beneath the abstraction',
  footnote: '*A DevOps engineer built this. Frontend folks, no pressure.',
  rows: [
    { fq: 'TX-01 · AWS LAMBDA', pre: 'Rust and C walk into a Lambda: ', em: 'custom runtimes', post: ' for the impatient.', go: 'LINK SOON', href: null as string | null, soon: false },
    { fq: 'TX-02 · TERRAFORM', pre: 'Writing your own ', em: 'Terraform provider', post: ', from zero.', go: 'INCOMING…', href: null as string | null, soon: true },
    { fq: 'TX-03 · ECS', pre: 'What 100 services taught me about ', em: 'right-sizing', post: '.', go: 'INCOMING…', href: null as string | null, soon: true },
  ],
};
// Contact from the owner's CV (2026-10-16). Field notes (blog) is still pending: rendered as a non-navigating "soon" item until `href` is filled in.
export const signal = {
  kicker: '07 / Signal', line: "Let's build something", em: 'original.', status: 'Available for new work · replies in 4–8 hours',
  links: [{ label: 'LinkedIn ↗', href: 'https://www.linkedin.com/in/yogeshp-dev' as string | null, placeholder: false }, { label: 'Field notes ↗', href: null as string | null, placeholder: true }, { label: 'Say hello ↗', href: 'mailto:yogeshpatil6717@gmail.com' as string | null, placeholder: false }],
};
