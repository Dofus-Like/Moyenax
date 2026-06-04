export const COMBAT_COLORS = {
  PA_YELLOW: '#fca800',
  PA_YELLOW_DARK: '#fbbf24',
  PM_VIOLET: '#9531ff',
  PM_VIOLET_DARK: '#5900ac',
  HP_RED: '#ef4444',
  HP_RED_LIGHT: '#fca5a5',
  HEAL_GREEN: '#22c55e',
  RANGE_ORANGE: '#fca800',
  VICTORY_GOLD: '#fbbf24',
  DEFEAT_RED: '#ef4444',
  SHADER_BG_A: '#cafdff',
  SHADER_BG_B: '#0a3fa7',
  SHADER_BG_C: '#ffffff',
  SHADER_NIGHT_A: '#0002a0',
  SHADER_NIGHT_B: '#335372',
  SHADER_NIGHT_C: '#ffffff',
  SHADER_SUNSET_A: '#ffe000',
  SHADER_SUNSET_B: '#ff0000',
  SHADER_SUNSET_C: '#003cff',
  CASTLE_DAY: '#ffffff',
  CASTLE_SUN: '#ff8844',
  CASTLE_NIGHT: '#4466cc',
  CASTLE_EMISSIVE_SUN: '#ff4400',
  CASTLE_EMISSIVE_NIGHT: '#0022ff',
  CASTLE_EMISSIVE_INTENSITY: 0,
  TILE_DAY_A: '#deffb3',
  TILE_DAY_B: '#849a69',
  TILE_SIDE_DAY: '#465138',
  TILE_SUNSET_A: '#ffcfb3',
  TILE_SUNSET_B: '#997a68',
  TILE_SIDE_SUNSET: '#523f37',
  TILE_NIGHT_A: '#b3b7ff',
  TILE_NIGHT_B: '#686b99',
  TILE_SIDE_NIGHT: '#373752',
  WALL_DAY: '#468700',
  WALL_SUNSET: '#875800',
  WALL_NIGHT: '#4a5a7a',

  WATER_DAY_DEEP: '#0c5378',
  WATER_DAY_SHALLOW: '#3fd0d8',
  WATER_DAY_FOAM: '#eaffff',
  WATER_SUNSET_DEEP: '#2a3a7a',
  WATER_SUNSET_SHALLOW: '#d98a6a',
  WATER_SUNSET_FOAM: '#ffe0c2',
  WATER_NIGHT_DEEP: '#0a1840',
  WATER_NIGHT_SHALLOW: '#28406e',
  WATER_NIGHT_FOAM: '#9fb4d6',
  WATER_CLOUD: '#eaf3ff',
  WATER_SUN_DAY: '#fff1c2',
  WATER_SUN_SUNSET: '#ff9d5a',
  WATER_SUN_NIGHT: '#ccd8ff',
  WATER_FOG: '#bcd9e8',
  SCENE_FOG: '#c2dbe8',

  /* ─────────────────────────────────────────────
     DA3 — Full Glassmorphism UI palette
     (used by CombatHUD / CombatPlayerPanel / CombatPage)
  ───────────────────────────────────────────── */
  GLASS_ACCENT: '#a78bfa',
  GLASS_ACCENT_LIGHT: '#c4b5fd',
  GLASS_ACCENT_DEEP: '#7c3aed',
  GLASS_TOKEN_A: '#818cf8',
  GLASS_TOKEN_B: '#4338ca',
  GLASS_BG_STRONG: '#0d0815',

  ENEMY_RED: '#f87171',
  ENEMY_RED_DEEP: '#b91c1c',
  ENEMY_RED_LIGHT: '#fca5a5',

  STAT_ATK: '#f87171',
  STAT_DEF: '#60a5fa',
  STAT_MAG: '#c084fc',
  STAT_RES: '#4ade80',

  FAMILY_COMMON: '#fbbf24',
  FAMILY_WARRIOR: '#f87171',
  FAMILY_MAGE: '#60a5fa',
  FAMILY_NINJA: '#4ade80',

  LOG_INFO: '#60a5fa',
  LOG_INFO_TEXT: '#dbeafe',
  LOG_DAMAGE: '#f87171',
  LOG_DAMAGE_TEXT: '#fecaca',
  LOG_VICTORY: '#fbbf24',
  LOG_VICTORY_TEXT: '#fef3c7',

  TEXT_MAIN: '#f8fafc',
  TEXT_MUTED: '#94a3b8',
};

/**
 * Convertit une couleur hex (#rrggbb) en triplet RGB "r g b".
 * Utilisé pour exposer les couleurs en variables CSS compatibles
 * avec la syntaxe `rgb(var(--xxx-rgb) / 0.5)` ou `color-mix()`.
 */
function hexToRgbTriplet(hex: string): string | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;
  return `${parseInt(match[1], 16)} ${parseInt(match[2], 16)} ${parseInt(match[3], 16)}`;
}

/**
 * Injecte toutes les COMBAT_COLORS comme custom properties sur :root
 * — `--pa-yellow`, `--glass-accent`, etc. pour usage CSS direct
 * — `--pa-yellow-rgb`, etc. pour compositions alpha via color-mix()
 */
if (typeof document !== 'undefined') {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(COMBAT_COLORS)) {
    if (typeof value !== 'string') continue;
    const name = '--' + key.toLowerCase().replace(/_/g, '-');
    root.style.setProperty(name, value);
    const rgb = hexToRgbTriplet(value);
    if (rgb) root.style.setProperty(`${name}-rgb`, rgb);
  }
}
