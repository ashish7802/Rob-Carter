const ADJECTIVES = [
  'Ghost', 'Neon', 'Shadow', 'Silent', 'Cyber', 'Mystic', 'Phantom', 'Cosmic',
  'Quantum', 'Zero', 'Velvet', 'Cryptic', 'Vapor', 'Echo', 'Stealth', 'Hyper',
  'Solar', 'Lunar', 'Astral', 'Midnight', 'Vortex', 'Obsidian', 'Static', 'Cipher'
];

const NOUNS = [
  'Walker', 'Runner', 'Specter', 'Drifter', 'Hacker', 'Nomad', 'Oracle', 'Agent',
  'Voyager', 'Pilot', 'Seeker', 'Ninja', 'Rebel', 'Falcon', 'Raven', 'Prowler',
  'Enigma', 'Glitch', 'Spark', 'Phoenix', 'Knight', 'Sentry', 'Whisper', 'Vector'
];

const ACCENT_COLORS = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#14b8a6', // teal
  '#6366f1', // indigo
];

export function generateRandomAlias(): { alias: string; avatarSeed: string; color: string } {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(100 + Math.random() * 900);
  const color = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
  const avatarSeed = `${adj}-${noun}-${number}`.toLowerCase();

  return {
    alias: `${adj}${noun} #${number}`,
    avatarSeed,
    color,
  };
}

export function getAvatarSvg(seed: string, color: string = '#10b981'): string {
  // Generate distinct geometric avatar SVG based on seed characters
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const shapes = [
    `<circle cx="24" cy="24" r="14" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2" />`,
    `<rect x="10" y="10" width="28" height="28" rx="8" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2" />`,
    `<polygon points="24,8 40,38 8,38" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2" />`,
    `<path d="M24,6 L38,16 L38,32 L24,42 L10,32 L10,16 Z" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2" />`
  ];

  const shape = shapes[Math.abs(hash) % shapes.length];
  const innerRadius = 4 + (Math.abs(hash >> 2) % 6);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" class="w-full h-full">
    <rect width="48" height="48" rx="12" fill="#0f172a" />
    ${shape}
    <circle cx="24" cy="24" r="${innerRadius}" fill="${color}" />
    <circle cx="${18 + (Math.abs(hash >> 3) % 12)}" cy="${16 + (Math.abs(hash >> 4) % 8)}" r="2.5" fill="#ffffff" />
  </svg>`;
}
