// `jsfxr` ne fournit pas ses propres types : déclaration minimale de l'API utilisée.
// Source : https://github.com/chr15m/jsfxr
declare module 'jsfxr' {
  /** Définition d'un son : objet de paramètres sérialisé ou chaîne base58 (export sfxr.me). */
  export type SfxrSynthDef = string | Record<string, unknown>;

  /** Objet audio rejouable renvoyé par `toAudio()`. */
  export interface SfxrAudio {
    play(): unknown;
    /** Présent uniquement sur le chemin Web Audio (absent du fallback HTMLAudioElement). */
    setVolume?(volume: number): SfxrAudio;
  }

  export const sfxr: {
    toAudio(def: SfxrSynthDef): SfxrAudio;
    play(def: SfxrSynthDef): unknown;
    generate(algorithm: string, options?: Record<string, unknown>): Record<string, unknown>;
    b58encode(def: Record<string, unknown>): string;
    b58decode(b58: string): unknown;
  };

  const jsfxr: { sfxr: typeof sfxr };
  export default jsfxr;
}
