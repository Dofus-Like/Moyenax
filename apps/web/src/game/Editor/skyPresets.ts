import type { TimeOfDay, Vec3 } from '@game/shared-types';

export interface SkyPreset {
  sunPosition: Vec3;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  /** Couleur de fond derrière le dôme (visible la nuit / au zénith). */
  background: string;
  /** Affiche un champ d'étoiles. */
  stars: boolean;
}

export const SKY_PRESETS: Record<TimeOfDay, SkyPreset> = {
  dawn: {
    sunPosition: [-18, 4, 12],
    turbidity: 10,
    rayleigh: 2.2,
    mieCoefficient: 0.008,
    mieDirectionalG: 0.82,
    background: '#1c2030',
    stars: false,
  },
  day: {
    sunPosition: [12, 22, 10],
    turbidity: 8,
    rayleigh: 1,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.8,
    background: '#0e1320',
    stars: false,
  },
  sunset: {
    sunPosition: [18, 2.5, -10],
    turbidity: 12,
    rayleigh: 3,
    mieCoefficient: 0.02,
    mieDirectionalG: 0.92,
    background: '#1a1320',
    stars: false,
  },
  night: {
    sunPosition: [0, -8, -12],
    turbidity: 0.2,
    rayleigh: 0.2,
    mieCoefficient: 0.002,
    mieDirectionalG: 0.7,
    background: '#05070f',
    stars: true,
  },
};
