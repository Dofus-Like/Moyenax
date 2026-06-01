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

/**
 * Catalogue de tous les sons du jeu.
 * Chaque valeur est une chaîne sérialisée (base58) jouable telle quelle.
 * Ce sont des PLACEHOLDERS générés automatiquement : pour finaliser un son,
 * design-le sur https://sfxr.me/ → bouton « Copy » → remplace la chaîne ci-dessous.
 */
const SFX = {
  // ── UI globale ──
  // clic sur un bouton
  uiClick:
    '7BMHBGSAYZAe3Z5cbtdoJeMJnrmeq3BdPbM4xeWfXHS5bZ3ayktkk42nGqnbPEA9g33QuMeTjamhffujeMbpFeMjiGFJasEBtTdMcsiuLghQSkNypPGNiczAB',
  // survol d'un élément cliquable
  uiHover:
    '11111BE6VFBF744gn9qTfkxij2XSMNnMu7662deWFbH15WaHMvQrWdeZo1oaxrcPaFzqvobSW1FBHGxWDh8v5T7RF5t7NTgeTED99xrpDzzHEVPQWJtdArSj',
  // ouverture modale / panneau
  uiOpenPanel:
    '11111936hwUVoogjXucie8r33tTg9zojcXttGtjz1HcXzQqtLGDADro4zUfPyaMMCHZrZUDBP6H3KjfwCLbkWfcvwtS7y53ewgaV52kEBbucDuPAQLaB8GnT',
  // fermeture modale / panneau
  uiClosePanel:
    '11111E3FE9BfoPHD1eAMDnRr1nvQvS3EjpKDAksMg98grUeqB2mUBVtAVt5ArvPn4oWKuzSa8j5xFJFZi8XvWy6Jxmv23geYVAkhwGf7HTdZavQw88E7vZx3',
  // validation d'une action
  uiConfirm:
    '111113ceqC6Zumcz1qwmbHE1BWeDnDLtKRCnamTAzqj1ZiBtdmpwSBuxWsMxwfLKvgbGdj4QcSSUALBkG6hG8X2VuXKDhSXM3UjgdiUvJVM9H6QhycLMBJAb',
  // annulation / retour
  uiCancel:
    '11111CR4QqTjHqduqz64rHY981GDsoLQxNYH5V65D6j3VBtbKJb5oPwW2fiBQHssyi7LRzZQysirHz25SRHLySpn8hmyhc5B8fpGgt8JA9xMnvrMmuabHTPV',
  // action interdite / sort indisponible
  uiError:
    '7BMHBGKtrWkQpNS1RBNdNx96uWBToBXYMUY26wxPvnRnKuMUS1f9Tk7jrBSG7ebz23SDd5mnmZfmRS4maj6DE5tXdn87sfhQYcJR4gdVnMsd5wA7Ybzu3SnuV',
  // notif / nouveau message chat
  notification:
    '34T6PkyHfy7J4BFGhBwSdV9d2QdGbCwLCVi7d7pyU6PkLiie8Np9gURxq3kHBufmXJjvSyzTPtqrueGHdjbhDcSzrnrhKVvEW1SfuoijgxXq44XL7YdWmY471',

  // ── Hub 3D ──
  // clic-au-sol → déplacement du pion
  hubMove:
    '834tvoAXQVJzmvfskxcc8bEzH1Gtp3UekDyBjV7LF5cRS9E7LyfjGBCL1FGtXCv9cypGcwFBn835ch3iHuxqxnQ3zUX9rkPaPgNPHQ6tpHMoq5uSTMaHgFojd',
  // entrée dans un POI / portail
  hubPoiEnter:
    '34T6PkxD6GFBYEogKLPZfFN3csc4tr1HmdYWVNoHibbGgw4U9fMa2s9fMZbXe4PtJncULvebpCAXAdQpwe4X5XbJpaeDQvr5PBcdGhAQS4DmopEcQEbVS7zJb',
  // message reçu dans le hub
  hubChatMessage:
    '34T6Pko4wNt3ofcJawzWRAmqa6rpbFsFT4XNNbMyoFiN8CqBKtZNBpXNggdiVoYycad2dGkkpphJjRQYgneALYqC8YuvZn4xxHYRDMYG3VkSkc5MH8LChFwGs',

  // ── Combat ──
  // début du combat
  combatStart:
    '111118oD8zUvTtxxppavCAgXZCRnobext1SPTMhAzd9nxNiNjrnNCdJDYJzZRbwNMH71mffj2iirzDtiAj1CoRuszT2gMsuRfozxTWkBUMfSHaJ6V8dAZuq1',
  // début de mon tour
  turnStart:
    '34T6PknUDkHeBMisGth46VKj5yz1k5FsB2D9kc2fVmWDQAEfr4opwSJ3RmweX2irUkszvvovvgdCMA15aLM7pX4xEd3wCAeR4Jvi7nwpxEUsAWA2DnL4wWT2P',
  // passer le tour
  turnPass:
    '7BMHBGKourpXx5G4jgi9zVTsZR7KiVtYA4CQ1oK9EAb8EJx9WnjX3cVN68e96C7iXkrkSmuUWso4wLFCFLfcTPoAynUMVxwjHnaEL5ay25jzyYPM5HZLpk4Y7',
  // survol d'un sort dans la SpellBar
  spellHover:
    '11111EQ8mTw3dmjpnCqauwKbzBoYs4yNaHx3g5pZ2PrxGYgfrv2fRgfDE3Byvf9WTV224aVyjWp4coYeMPvkF27LWgt4tzRusk5bLJLMUWzDj8WVmFaX2cgP',
  // sélection d'un sort
  spellSelect:
    '7BMHBGSdGtHMXFx8SkVCLzBxJPr6pbpJyF7ADLEYtCczRGzQH6cPhheEx9ZbAgEbpx8fUJYovLLHp2eowKHzECovdgyZ52zrwUZ98jkZ84qtWNtAiaTazKdks',
  // lancement d'un sort
  spellCast:
    '34T6PkxqwT7qokYbzugRJ95c5J65tVFaJVwmS4wSYbnaTxTTLhnVDf3sp9idtwZjooQofcf9enrMVSPwQVxf4Ke9Z6EXQ6vnyBFk3hzW5GQgdorWc6VFkZK7m',
  // dégâts infligés
  damageDealt:
    '7BMHBGKL98v5MsdYKeHHyn1MMDzZ2qM5P8voU9eb46pHTrRcvx4aMKtzALTbvmFMPuWSz3ghrjGubxA78iiyQdoQiTyHbkrkKLCg1ZhiXMrJXHLYqGxadDUvs',
  // dégâts subis
  damageTaken:
    '34T6PkkyJkndzpMrAmYLFmcwK1Y6c7rvzCVTkoWdSgy2enLsgb6Ee8Jz81jxsRpHhFCETRJoU2CBW2959HzugKginxbjSzCe6cMC42MUjqsMBo161pLXVutNs',
  // soin
  heal: '111114tcL7xeGigZdYb9Gsxuc7dNvFQ81C98D9SrwVj6VWYcLgsMakhquWNpENiToi9W3rABqxjzy5dStWmJF8uy7HRNEHtUMSQpPPxh9m7Mz1kFocKpqAQP',
  // mort d'une entité
  death:
    '7BMHBGJ33fTZAKaaJWdTupoSLYsAxtUVH6xkaX9Dxa3jr7wdvGQK1FG6vQ4wMcEfFvQ8gFKHGZ4NPhCg4QXAJwYUtiiMbZ9dsNETS8ep3fFs7VTbmPG7CHb3M',
  // combat gagné
  victory:
    '34T6Pku3U5727goi4i1eCG4vG4ywgGeT5rMFGbLxcot5Q6KTZUJZSMqDf7U3pzohgvgqAAiGQjitkhxGuTzVHra8wN2MgBpEwMWWyhr2JfPvJNW4EXArAaeYo',
  // combat perdu
  defeat:
    '7BMHBGGgLzmRkAf84AwxNYizEfgdjmEYFmEM2YZRdVBS8cTw5LV3Dv8qaqpFH1x7J7ak6R46oADBQEoFrtrYCwh7fQNiQtCSdGFL2V5kPh2LZojFBFnZYzp2K',

  // ── Récolte / Farming ──
  // début de récolte
  harvestStart:
    '11111JBbzcKofpopFbPPVjKi3ZFy1W4oxSqRk8tprS13TqsRqryzDiq27c5YDCuCj9s7Z2vSchUoge6JJH3ex3oLUru6RTDvvELWMGycbEcxfdNJGHSkHp5m',
  // ressource obtenue
  harvestComplete:
    '34T6PkvnJAW2EMsPE5HPxm7ExNR9eoHGGHWwbR3ykYzLfW2ZKTWUFQXPqKYnYer1kFQR6Fdjcp46NSxMUpNG5Z9RzoAJd6DeD9WYdtGzSgz7SZZw1dwrh8AzT',

  // ── Inventaire / Économie / Craft ──
  // équiper un objet
  itemEquip:
    '34T6Pm2ZaW35Yvrd7TdEFqKEr6JyhzNQ2mNjmm2Xi55BeugJR7PgRx3NnytNtWM3VviBUt1EPKo6MPnFriqSX88hVhoSzMpixEPqyW6a94ebdUw85tdZjbp9d',
  // ramasser un objet / loot
  itemPickup:
    '34T6PkktQMdRBvYdvGH1ddSLWUvR5z2kee2xi9itdVXK3utVTrwikhWD1Uj2gBqXZf6NFUrNNwmnaawep4tKpwCJYqbFLBPK4CnYudRetrMR36UYKxsPn43jm',
  // gain de kamas
  coinGain:
    '34T6PktSYnNNjzPk9tt7A1bafkkbfhLfWuK8pGvCqBxspVEzpVNnFS3tuEdSZsZEGvUh5GdQSM4knJWUSL2Ldh3Fx3FFgamtuNL6gm2v5babU1AARwqXe993V',
  // craft réussi
  craftSuccess:
    '34T6PkkUMefgSuJV7q5psuY9XDoNKYk7MKXXSDfZy1cdGypxH5UP9PghGFx4EPbsn52wUsZUNUHc47RkBJvkdf9Yx8dp6iAuYGH6cPUFPbiuo13pdPFGum1P5',
  // craft échoué
  craftFail:
    '11111HqcNCQKvksSu87LUm1GCUsuwvqKc8o8SpfeeWNhDdAzxw2MjwLhA1nmubHqyyzS4Yeq4qsWXmKDmqQqC7kbhSVcqS81mi9YPTHDhS9weBjE95yjt3AP',
  // montée de niveau
  levelUp:
    '111112DsLb7KFgVTpByWJFQb51MeeE4YqCFdCvAEg84wfdGNvJMZmMUrpjwNb54LkZgDxMbSuGfVf678thGbnoes4CJqAjpEF9KfLWLjFcKU5LQVhNURhjrX',
} satisfies Record<string, string>;

export type SfxName = keyof typeof SFX;

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
  let audio = cache.get(name);
  if (!audio) {
    audio = buildAudio(SFX[name]);
    cache.set(name, audio);
  }
  audio.play();
}
