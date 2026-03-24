export const OPEN_SESSION_STATUSES = ['WAITING', 'ACTIVE'] as const;

export const MATCHMAKING_QUEUE_KEY = 'matchmaking:queue';
export const MATCHMAKING_QUEUE_LOCK_KEY = 'matchmaking:queue:lock';

export const SSE_TICKET_PREFIX = 'sse-ticket';
export const SSE_TICKET_TTL_SECONDS = 60;

export const ALLOWED_PLAYER_CLASSES = ['warrior', 'mage', 'ninja'] as const;
export type AllowedPlayerClass = (typeof ALLOWED_PLAYER_CLASSES)[number];

export const ALLOWED_SKINS = [
  'soldier-classic',
  'soldier-royal',
  'soldier-dark',
  'orc-classic',
  'orc-fire',
  'orc-void',
] as const;
export type AllowedSkin = (typeof ALLOWED_SKINS)[number];

export const DEFAULT_SKIN_BY_CLASS: Record<AllowedPlayerClass, AllowedSkin> = {
  warrior: 'soldier-classic',
  mage: 'soldier-royal',
  ninja: 'soldier-dark',
};
