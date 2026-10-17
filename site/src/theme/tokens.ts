export const tokens = {
  paper: '#f7f3e9', surface: '#ebe6d6', ink: '#1b1605', muted: '#6b6450', line: '#d9d2bf',
  night: '#161308', night2: '#221e10', cream: '#f2eee4', mutedNight: '#a39b86', lineNight: '#3a3420',
  apricot: '#f99e67', rust: '#882700', rustNight: '#e2703f',
  deepRust: '#5a2a10', labelNight: '#8c8470', abyss: '#0d0b04',
} as const;

export const textPairs: Array<[string, string, string]> = [
  [tokens.ink, tokens.paper, 'ink/paper'],
  [tokens.ink, tokens.surface, 'ink/surface'],
  [tokens.muted, tokens.paper, 'muted/paper'],
  [tokens.rust, tokens.paper, 'rust/paper'],
  [tokens.cream, tokens.night, 'cream/night'],
  [tokens.cream, tokens.night2, 'cream/night2'],
  [tokens.mutedNight, tokens.night, 'mutedNight/night'],
  [tokens.rustNight, tokens.night, 'rustNight/night'],
  [tokens.ink, tokens.apricot, 'ink/apricot'],
  [tokens.deepRust, tokens.apricot, 'deepRust/apricot'],
  [tokens.labelNight, tokens.night, 'labelNight/night'],
  [tokens.apricot, tokens.night, 'apricot/night'],
  [tokens.apricot, tokens.abyss, 'apricot/abyss'],
];
