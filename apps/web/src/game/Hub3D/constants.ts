export const HUB_GLB_URL = '/models/hub/Hub_Base.glb';

export const MAP_SCALE = 16;

export const NAVIGATION_RADIUS = 14;
export const NAVIGATION_PLANE_SIZE = NAVIGATION_RADIUS * 2.2;
export const NAVIGATION_PLANE_Y = 0;

export const PLAYER_GROUND_Y = 0.02;

export const SPAWN_POSITION: readonly [number, number, number] = [0, PLAYER_GROUND_Y, 0];

export const PLAYER_SPEED = 4.5;
export const PLAYER_HEIGHT = 1.6;
export const PLAYER_RADIUS = 0.35;

export const PLAYER_SCALE = 3.8;

export const PLAYER_VERTICAL_OFFSET = 0.55;

export const SHADOW_SCALE = 0.55;
export const SHADOW_OPACITY = 0.22;

export const CAMERA_POSITION: readonly [number, number, number] = [20, 22, 20];
export const CAMERA_ZOOM = 44;

export const CAMERA_ORBIT_RADIUS = Math.hypot(CAMERA_POSITION[0], CAMERA_POSITION[2]);
export const CAMERA_ORBIT_INITIAL_AZIMUTH = Math.atan2(CAMERA_POSITION[0], CAMERA_POSITION[2]);
export const CAMERA_ORBIT_INITIAL_ELEVATION = Math.atan2(CAMERA_POSITION[1], CAMERA_ORBIT_RADIUS);
export const CAMERA_ORBIT_MIN_ELEVATION = Math.PI / 7;
export const CAMERA_ORBIT_MAX_ELEVATION = Math.PI / 2.4;
export const CAMERA_ZOOM_MIN = 28;
export const CAMERA_ZOOM_MAX = 64;
export const CAMERA_ROTATE_SENSITIVITY = 0.0055;
export const CAMERA_ZOOM_SENSITIVITY = 0.04;
export const CAMERA_LERP_RATE = 8;
export const CAMERA_DRAG_THRESHOLD_PX = 5;
export const CAMERA_IDLE_DELAY_S = 4;
export const CAMERA_IDLE_AZIMUTH_AMP = 0.018;
export const CAMERA_IDLE_ELEVATION_AMP = 0.008;
export const CAMERA_IDLE_FREQ_AZ = 0.18;
export const CAMERA_IDLE_FREQ_EL = 0.13;

export const ROTATION_LERP_RATE = 12;
export const ARRIVAL_THRESHOLD = 0.04;

export type PoiId = 'combat' | 'vs-ai' | 'appearance' | 'rooms';

export interface PoiCustomEffect {
  type: 'vs-ai-aura' | 'appearance-aura' | 'rooms-aura';
  offsetY?: number;
  radius?: number;
}

export interface PoiConfig {
  id: PoiId;
  label: string;
  icon: string;
  position: readonly [number, number, number];
  color: string;
  modelPath?: string;
  assetScale?: number;
  assetRotationY?: number;
  faceCenter?: boolean;
  rotationOffsetY?: number;
  customEffect?: PoiCustomEffect;
}

export const POI_STOP_DISTANCE = 1.6;

export const PLAYER_IDLE_BOB_AMP = 0.03;
export const PLAYER_IDLE_BOB_FREQ = 0.8;
export const PLAYER_WALK_BOB_AMP = 0.055;
export const PLAYER_WALK_BOB_FREQ = 2.2;
export const PLAYER_BOB_LERP = 5;
export const PLAYER_IDLE_SCALE_AMP = 0.015;
export const PLAYER_ORIENTATION_THRESHOLD = 1e-4;

export const HUB_POIS: Record<'combat' | 'vsAi' | 'appearance' | 'rooms', PoiConfig> = {
  combat: {
    id: 'combat',
    label: 'Combat aléatoire',
    icon: '⚔️',
    position: [8, PLAYER_GROUND_Y, 0],
    color: '#ef4444',
    modelPath: '/models/poi/combat.glb',
    assetScale: 1,
    faceCenter: true,
    rotationOffsetY: Math.PI * 0.05,
  },
  vsAi: {
    id: 'vs-ai',
    label: 'VS AI',
    icon: '🤖',
    position: [0, PLAYER_GROUND_Y, -8],
    color: '#facc15',
    modelPath: '/models/poi/vs-ai.glb',
    assetScale: 1.8,
    faceCenter: true,
    rotationOffsetY: 0,
    customEffect: {
      type: 'vs-ai-aura',
      offsetY: 1.4,
      radius: 1.45,
    },
  },
  appearance: {
    id: 'appearance',
    label: 'Apparence',
    icon: '🎭',
    position: [-7.5, PLAYER_GROUND_Y, -1.5],
    color: '#c084fc',
    modelPath: '/models/poi/appearance.optimized.glb',
    assetScale: 1.25,
    faceCenter: true,
    rotationOffsetY: -Math.PI * 0.06,
    customEffect: {
      type: 'appearance-aura',
      offsetY: 0.08,
      radius: 1.15,
    },
  },
  rooms: {
    id: 'rooms',
    label: 'Rooms personnalisées',
    icon: '🏰',
    position: [0, PLAYER_GROUND_Y, 8],
    color: '#22c55e',
    modelPath: '/models/poi/rooms.optimized.glb',
    assetScale: 1.35,
    faceCenter: true,
    rotationOffsetY: Math.PI * 0.04,
    customEffect: {
      type: 'rooms-aura',
      offsetY: 0.1,
      radius: 1.0,
    },
  },
};
