import { type SfxrAudio, sfxr } from 'jsfxr';

// Presets intégrés à jsfxr — reconnus si une valeur du catalogue en reprend le nom.
const JSFXR_PRESETS = [
  'pickupCoin',
  'laserShoot',
  'explosion',
  'powerUp',
  'hitHurt',
  'jump',
  'blipSelect',
  'synth',
  'tone',
  'click',
  'random',
] as const;

interface SoundConfig {
  value: string;
  volume?: number;
  description?: string;
  order?: number;
}

/**
 * Catalogue auto-découvert : un fichier `src/assets/sounds/<name>.json` par son.
 * `value` = chaîne sérialisée (base58) jouable telle quelle (modèle sfxr :
 * oscillateur → enveloppe ADSR → effets). Pour retoucher un son : coller la
 * valeur dans le bouton « Serialize » de https://sfxr.me/, ajuster, puis
 * remplacer `value` dans le JSON. Ajouter un son = déposer un nouveau `.json`.
 */
const modules = import.meta.glob('../assets/sounds/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, SoundConfig>;

const sounds = Object.entries(modules)
  .map(([path, cfg]) => [path.slice(path.lastIndexOf('/') + 1, -'.json'.length), cfg] as const)
  .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0) || a[0].localeCompare(b[0]));

const SFX: Record<string, string> = {};
const SFX_VOLUME: Record<string, number> = {};
for (const [name, cfg] of sounds) {
  SFX[name] = cfg.value;
  // La chaîne base58 sfxr ne porte PAS le volume : on l'applique à la lecture.
  if (cfg.volume !== undefined) SFX_VOLUME[name] = cfg.volume;
}

export type SfxName = string;

/** Noms ordonnés du catalogue (outillage de test/admin : grille de tous les sons). */
export const SFX_NAMES: SfxName[] = sounds.map(([name]) => name);

/** Son de lancement distinct par sort (clé = code du sort). Fallback : « spellCast ». */
export const SPELL_CAST_SFX: Record<string, SfxName> = {
  'spell-boule-de-feu': 'castFireball',
  'spell-frappe': 'castSlash',
  'spell-claque': 'castSlap',
  'spell-kunai': 'castKunai',
  'spell-bombe-repousse': 'castBomb',
  'spell-soin': 'castHeal',
  'spell-heal': 'castHeal',
  'spell-endurance': 'castEndurance',
  'spell-velocite': 'castVelocite',
  'spell-buff-pm': 'castVelocite',
  'spell-bond': 'castLeap',
  'spell-menhir': 'castMenhir',
};

// Un son est synthétisé une seule fois puis rejoué (chaque play() crée une nouvelle source).
const cache = new Map<SfxName, SfxrAudio>();

let muted = false;

/** Coupe / réactive tous les SFX (ex. réglage joueur). */
export function setSfxMuted(value: boolean): void {
  muted = value;
}

function buildAudio(value: string): SfxrAudio {
  const isPreset = (JSFXR_PRESETS as readonly string[]).includes(value);
  return sfxr.toAudio(isPreset ? sfxr.generate(value) : value);
}

/** Joue un son du catalogue. À déclencher sur une interaction joueur (clic, hover, action). */
export function playSfx(name: SfxName): void {
  if (muted) return;
  // L'audio ne doit jamais casser la logique de jeu (autoplay bloqué, AudioContext indispo, jsdom).
  try {
    let audio = cache.get(name);
    if (!audio) {
      const value = SFX[name];
      if (!value) return;
      audio = buildAudio(value);
      cache.set(name, audio);
    }
    const volume = SFX_VOLUME[name];
    if (volume !== undefined) audio.setVolume?.(volume);
    audio.play();
  } catch {
    /* sfx best-effort */
  }
}

/**
 * Joue une chaîne sfxr (preset ou base58 sérialisée) sans l'ajouter au catalogue.
 * Sert au banc d'intégration admin : écouter un son candidat avant de l'intégrer.
 * Renvoie false si la chaîne est vide ou illisible.
 */
export function previewSfxString(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    buildAudio(trimmed).play();
    return true;
  } catch {
    return false;
  }
}
