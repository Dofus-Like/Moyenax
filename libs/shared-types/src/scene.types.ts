import type { SeedId } from './map.types';
import { MAP_SIZE } from './map.types';

export type Vec3 = [number, number, number];

export interface PlacedProp {
  id: string;
  modelKey: string;
  position: Vec3;
  rotation: Vec3;
  scale: number;
  /** L'objet bloque-t-il (collision de gameplay) ? Décor non bloquant si false. */
  collides: boolean;
  /** Verrouillé : non sélectionnable / non déplaçable dans l'éditeur. */
  locked?: boolean;
  /** Masqué : non rendu dans l'éditeur. */
  hidden?: boolean;
}

export interface SceneTerrain {
  width: number;
  height: number;
  seedId: SeedId;
}

export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night';

export const TIME_OF_DAY_ORDER: TimeOfDay[] = ['dawn', 'day', 'sunset', 'night'];

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  dawn: '🌅 Aube',
  day: '☀️ Jour',
  sunset: '🌇 Couchant',
  night: '🌙 Nuit',
};

export interface SceneAmbiance {
  timeOfDay: TimeOfDay;
  ambientIntensity: number;
  directionalIntensity: number;
}

/** Intensités lumineuses par défaut pour chaque moment de la journée. */
export const AMBIANCE_PRESETS: Record<
  TimeOfDay,
  { ambientIntensity: number; directionalIntensity: number }
> = {
  dawn: { ambientIntensity: 0.7, directionalIntensity: 1.1 },
  day: { ambientIntensity: 0.9, directionalIntensity: 1.4 },
  sunset: { ambientIntensity: 0.6, directionalIntensity: 1.2 },
  night: { ambientIntensity: 0.35, directionalIntensity: 0.5 },
};

export interface SceneTemplate {
  id: string;
  name: string;
  terrain: SceneTerrain;
  ambiance: SceneAmbiance;
  props: PlacedProp[];
}

export const DEFAULT_PROP_SCALE = 1;
export const DEFAULT_PROP_ROTATION: Vec3 = [0, 0, 0];
export const DEFAULT_PROP_COLLIDES = true;

export function ambianceForTimeOfDay(timeOfDay: TimeOfDay): SceneAmbiance {
  return { timeOfDay, ...AMBIANCE_PRESETS[timeOfDay] };
}

export function createEmptyTemplate(): SceneTemplate {
  return {
    id: 'draft',
    name: 'Nouvelle scène',
    terrain: { width: MAP_SIZE, height: MAP_SIZE, seedId: 'NATURE' },
    ambiance: ambianceForTimeOfDay('day'),
    props: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number');
}

function isPlacedProp(value: unknown): value is PlacedProp {
  if (!isRecord(value)) return false;
  return (
    typeof value['id'] === 'string' &&
    typeof value['modelKey'] === 'string' &&
    typeof value['scale'] === 'number' &&
    isVec3(value['position']) &&
    isVec3(value['rotation'])
  );
}

function isTerrain(value: unknown): value is SceneTerrain {
  return (
    isRecord(value) &&
    typeof value['width'] === 'number' &&
    typeof value['height'] === 'number' &&
    typeof value['seedId'] === 'string'
  );
}

function isAmbiance(value: unknown): value is SceneAmbiance {
  return (
    isRecord(value) &&
    typeof value['timeOfDay'] === 'string' &&
    typeof value['ambientIntensity'] === 'number' &&
    typeof value['directionalIntensity'] === 'number'
  );
}

function normalizeProp(value: PlacedProp): PlacedProp {
  return {
    ...value,
    collides: typeof value.collides === 'boolean' ? value.collides : DEFAULT_PROP_COLLIDES,
  };
}

/** Valide une valeur inconnue (JSON importé) comme SceneTemplate ; renvoie null si invalide. */
export function parseSceneTemplate(value: unknown): SceneTemplate | null {
  if (!isRecord(value)) return null;
  if (typeof value['id'] !== 'string' || typeof value['name'] !== 'string') return null;
  if (!isTerrain(value['terrain']) || !isAmbiance(value['ambiance'])) return null;
  if (!Array.isArray(value['props']) || !value['props'].every(isPlacedProp)) return null;
  const template = value as unknown as SceneTemplate;
  return { ...template, props: template.props.map(normalizeProp) };
}
