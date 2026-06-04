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
 * Sons synthétisés au modèle sfxr (oscillateur → enveloppe ADSR → effets) :
 * positif = fréquence montante / arpège up ; négatif = chute / bruit ;
 * UI = blip court. Pour retoucher un son : coller la chaîne dans le bouton
 * « Serialize » de https://sfxr.me/, ajuster, puis remplacer la valeur ci-dessous.
 */
const SFX = {
  // ── UI globale ──
  // clic sur un bouton
  uiClick:
    '11111mqKRconoRwXjTTzBFYkfLx1Jt7ZJox3Sp2334mnSmDcQRrDH53AYQ62PUUkifJ7ai5FQtecbfDH1LeQn3UhTmy6NF6H74TiXJs3KniV9ZCXL16Zu8B',
  // survol d'un élément cliquable
  uiHover:
    '57uBnWSzi74KNuiVRdtuw5op9QsFo35J4dJ6YDB82XfKfbSvG9wUcSkCtV4RPJnMnfqQQ8VBD2U2wtzYGYWkHyFBBFAVzQ2r3bodFcHzyTjo61FCBqKfz4d8K',
  // ouverture modale / panneau
  uiOpenPanel:
    '11111BFZ5uaXrYQKxtYCzBNihCZT8ZyduvvntD9MWtxwAfQsYQZHHZgZkHye13yMQ29QWwEeWGvbCtMA1DsACFTrje3RzXokngJYrrMQ7gzdrHSHjbXr9k79',
  // fermeture modale / panneau
  uiClosePanel:
    '11111BFZ5uaXrYQKxtYCzActXhgSCfCxLnbTza8jrKLqWFVPLhuWy6TpzFw2oPgN229T4Ya4NP3yDgCZiAACPnYUWpQjQ7sgCGwACSbcKxkKMvGBrZBSFZ11',
  // validation d'une action
  uiConfirm:
    '11111mqnbhVWL9ZnCaMtPrgxZDPm8X8ZFJnFshDqdoMX826JxMddorM6XYuDbBecW2JH9SMZGZ6oWzHKpPvrbgj118jXcNXGQYKb5rJ8Kkcb1rnpBQZrxQ7',
  // annulation / retour
  uiCancel:
    '11111FbzaGYH27kT1ixh49Ae8edhM8CH2uGVdkUq9mS6WPQ8yozpzyHaT9GDDkqRVcZgNFY6NyyVBxcYZ831sHTQ7WzUHqSUcL7ChQCmXU8iiLmDJs63TD5R',
  // action interdite / sort indisponible
  uiError:
    '11111Fc13SajJH62dUhiN7ZGt2JqPtHjibMWYthkswjYK9uc12k3uxAo9JzBfxAi8vzykAUc1ZBtb3CQSAaXpCPExHVrsH6A4YBFndywwJVsDWqLSFwJTJSK',
  // notif / nouveau message chat
  notification:
    '57uBnWgpsMuKsNhdRDLhdoA9jSSJBhxAEf8McCPnfejXv2sup9ZacGCeVzv7dvooVGh7PtCnbyVHFMjJRTQRjzcAJH8H8Sf94ujHHdVWmwdRRBixZ8webqKpK',

  // ── Déplacements ──
  // pas (alternance A/B), tick sourd et discret
  footstepA:
    '7GQhofNsKrf4HEeHnFgtSf5zs6A4v1g3pEktRUFkNDSyHnjXT8n9vBSG5RJyTqbdtaEoRUWzJfdD75bHedqZhmB6xCw4dnWTJkusMgtVFcBFksZdL26nrsnDu',
  footstepB:
    '7GQhofNsKrf4HEeHnFgtSf7yWZ9m1BXxe7ZdYftiAuWfRfn7XRXLN6TcTNjRkCi3iSGYHRKL18WWjwBG1zYx41znDBsEvBzgxF8YwUJr6rVRoaCno93MAdfLj',

  // ── Hub 3D ──
  // clic-au-sol → déplacement du pion
  hubMove:
    '7GQejrnpd57C6wc4VBZzcj27ByqttA8yjhVv8vs4LDT64mie5nFfeFrpmpwPYn6cSYwGhixnEJNCjxk1aFwjTf66Yp7yVwQu9W1DhqJXy33E6ee36raxFvPCb',
  // entrée dans un POI / portail
  hubPoiEnter:
    '57uBnWcURsYN8D8HHpj1ngfNS93RqN9UjGXgrstKxtPYGNYyDrPftGhTwpjVYemz5HtLfeA8CZMT2kGCuF76pKLGWZ7zACasSKC92Kceb6weFUhXSHPYytLcF',
  // message reçu dans le hub
  hubChatMessage:
    '11111BFZ5uaXrYQKyqeEPjMfsQNRSgWnrVLRGhnLcRaJFVi5qeyhKrV3XGpgdr4czvDQBtLE4E9gUxyrQfupj7ggQxRv8kSHqBTYQsykhkcAtE5vrWEJ1ho5',

  // ── Combat ──
  // début du combat / passage ressource <-> combat : montée ample et grave
  combatStart:
    '1111111UE45rPBH3pEkHbGvzboCiDwSmhcDSZZiBmh9yd1AizBgsWyRwCfCuSgWs1o7HPqX8L7XUWdPkrhqRLWQo1BMz9X6nrbc3FUiPqtoDgWTvwTHvGZV',
  // début de mon tour / changement de manche : carillon doux montant
  turnStart:
    '57uBnWcURsYMZrGQBhvpxpdeWn9nxPRHtjEspc4CmAa6HuY8CCnZ3GnwZ7pBCcNQtx9gmtycGKpxCNyVVQp9emhuJS8RYk6bVidMDJncfjk8nWnvFQvh9ntVu',
  // passer le tour / fin de manche : deux notes douces et claires, légèrement descendantes
  turnPass:
    '57uBnWV6nyhNhfnjchC6ZhRkwuixLKJgEwNtgDyyP6ov1kAdmsVCxHhSYehyNMsmmgpXrPxdL9aSeuGD1oMqqXPQ8r8HrYNZKj4ecmtnVSFx2RYp6QkVYEij1',
  // survol d'un sort dans la SpellBar
  spellHover:
    '57uBnWSzi74KNuiVRdtuw5op9QsFo35J4dJ6YDB82XfKfbSvG9wUcSkCtV4RPJnMnfqQQ8VBD2U2wtzYGYWkHyFBBFAVzQ2r3bodFcHzyTjo5zewPaVQA4nHd',
  // sélection d'un sort : tick net et bref, distinct du hover
  spellSelect:
    '11111mqKRf3EAozFPfdYbTQfXhKEvWb21L29W5VViiFHX4mvC1Qbi8mJWgFDfANkLNMYJz9sDVQYNVWuv7Kur2CJW3EPVqBWAeVkL6sitWKui52oBbWoFwD',
  // lancement d'un sort (générique / fallback)
  spellCast:
    '57uBnWj15e1y9f7Xt2fsyFypDugHtrnNYDqLdQBLUfVQhucqTMmey7T2hZE7qEypSSefBCkwqWYxbr9wQCCHFnzm76aFs11XYT6PsHoDXdqsCgJuEuFtwBpTq',
  // lancement par sort (un son distinct par sort)
  castFireball:
    '34T6PktrziK1ftbhdCQY6Didw1Smn6DNiZNc5ZQXH36b2e8X4q6FrPf439v4NbiBnPLFpXGBhHd4ehcjr8b3MzcCZQpWS9n6yWRvnUvoaFGqSZJ2DNw26hMJf',
  castSlash:
    '7BMHBGQSJ3xdK4H9FK5wBswLYqdrSPyGMSHe8bWuJuuAK5CNuKMS6VZ2Zgd2uyQH4pQ5JiP9f4cXW9wWDb39F6KYZS3DjS8d735mkkJyCrp3LX18KBcGtf7Nf',
  castSlap:
    '7BMHBGL5s2mdZJ4Cnc9SjDcPTEsHNbaRUcG2kFkyAcUcNZJEFn6pn1n5PnzNE1vt2pahjt7cayJvKtqNTrtJM6GmyfaQLhFS45Nes4r24muwdexQTzv9Y4kNB',
  castKunai:
    '34T6PktrzF8yDcSN3ZhgQhNfzkgWfHrKFvHuKhCpcctk9YkvegL12sYdM5RDdivQxo87yZPiNx8A163nsYbxUVvWmFmUZTYBDA2wCu2L611BTFpuQvWc2ti3Z',
  castBomb:
    '7BMHBGQSJX8gKhJMwBXeDk5UedsLfTw2oe3ZfbgKeThQnB2Rs5mNLa1QNhnqP2hd835FEfGjiZDgZatbkYGXGB1Rw41ZNSeWPAsfDD91UaqxE5KkzUYha6tD5',
  castHeal:
    '6GynYUsWXyecEcr1B4UTcgod7VDz2ai4BgAi3FVET2KWSnMsBScMveiY4gARzpQHCTKbWHPzQUdBf1LmsppmnCfwfSAwewgccchGsd9qVPJ7MqTi2aeP6Xsx3',
  castEndurance:
    '11111HnDKZGF24NYXCUEeGk932W81NasicnGf1m6Sgj7JDTph9AM9kS7A7nkEr5vNtkxAinVULY5Ew8SoZJorBP7oVZfveNb1ZDAfTSRjvdHczzQw7S2FQ2j',
  castVelocite:
    '11111mqnbhVWL9Zv6NBPBWMDjhC6J1YqAUe8MtPJ4AwNeBr87RxcR7Qi7xqKq4Q8nifZ9V1qbwrJGH1LDEvGDoYo8rFF6h9KzMQjiCWLj3cm8aQGqw2s14s',
  castLeap:
    '11111Fc13ScxjeU5T2qZVimPPgv4qtk1g1fcX6xyoGEqm2wgtEMPujo6c4DKD9onX5BAeeRmKQX1JtFBMaBTu4MMr4uZqp4bvqfe8bneqTZffQty1yindTnP',
  // invocation du Menhir : impact de pierre lourd et sourd
  castMenhir:
    '7BMHBGAc8o7kxuwyGTS8GpMzXZeA6TcnVXk6YN9bhytMQrm4PE7EsfATY7rhPaNqtnfzAx5inX2Rygam9b9hi6PBb2yEY4EoqV115ivo7WgSWmDnqN23YXS9D',
  // dégâts infligés
  damageDealt:
    '34T6PkjPGwq3wpvt66AnJsmdzYpb5joLRYgpu9YhSi2UNqTAKSKGG1YTTf3jcs8Bv6vr8r8X9Q2RTTRhnDe6JgZz7wncNfrnGKgtcqgZ4DFtSW21QhDSq8q3M',
  // dégâts subis
  damageTaken:
    '7BMHBGQSJX8fmLSUpgxLXiWijHNXMFToG9GbYpLdreYDzcyGiA9ar2XUd6FH5vWXjdcLnzHwAnXhEwqooRATJgzTSjFSGhfwcrHD5dzNDiJ3Fk7sPy2nPs6jy',
  // soin
  heal: '6mTcDiwN3gGS1yVHs6vsJtYKJWtXhdRgXdXxtxXXh1v77nYddqMENgrgPUPPkrAtHEBPPjcDinPr3495si8uepDEKxSNv74kaUchMeRczYnrRstc6RyGsX527',
  // mort d'une entité
  death:
    '34T6PkicSdTR6Xme3pviEDkPeYg1X1YdmZDnUX2p8QdjannV8Dz8XLjaTBnwjTajHmjf7ahzZuYdNBxwQ6KeZfZq25BcAinVcY1zM9T8Bcopuf3QUkFj1fXGs',
  // combat gagné : carillon céleste long, montant et scintillant
  victory:
    '5CxcQv9h3zsip9JtC4Jjm5HQsJvzk5AUcSrqePpCrf7PnPojFQzeaNEjyGCgE5jtfY1APzwaViJMcp742tLCwige2fMCpuhP1CRGpry64CPJY5k2mQdsd1CsZ',
  // combat perdu
  defeat:
    '34T6PknGC943Fk4h3fDg7YNG37MjvjEK7RpS5Dsa6Jt2zbJ7PjJiCvJ5YMuXUeZYf4z2c5MxkTRu7h7fF1t5so3PKjJs5MHArJnsiipmYiivWmNH3XtH4Xwfm',

  // ── Récolte / Farming ──
  // début de récolte
  harvestStart:
    '7GQhofvxECXcBbjtgz5sESMpc9yrKi13Q2cUgZ7N7ZSAvXzShDotUiPpwqiRB8xsMEQAWBjP8S8W4MFX5FgAj2cxA3Vj9F5C1gx6aWAzGybxn4C5qoB5jmTDZ',
  // ressource obtenue (fallback générique)
  harvestComplete:
    '11111Fc13ScQNrjpJKzkx7r3wXcABZWLqPmFjkSjgrvegMxrFj4NshBu6e3uKEMNV9cgkZ1BzByNFWF1kY2VGPVxmC5tANYw9jk8BzMQLLPEraVg9tfv6JTZ',
  // variantes par ressource (même famille, hauteur/timbre différents)
  harvestWood:
    '11111Fc13ScQNrjpJKzkx6VfgYHwhJhy6zVR5MfBQHfA9Edi3azvD4gQWBUzdaZJGgyXTAPDsM7f7821NnjJmTFKpUMDfsNLmnGH3gumE5WCL51ztGBuXrS3',
  harvestIron:
    '11111Fc13ScQNrjpJKzkx7EeHoUY3rR9j4ptaauM1jnETHdErHiKiw3JSPvtnsrCKuhtTjUQTf8QnvGYVdU7dCuL4K4w5xto43wRE4FNzNyRWLE5ChkWinvK',
  harvestCrystal:
    '11111Fc13ScQNrjpJKzkx8bt1QFsqgc9mPaDe71CnCDD3MT9fd24c8tDTYKdxUqAzSMhkBsiGCoAbFH7UMDJpLwH2xCKPTffqzwoHnarQFbNhFuHupLeLj6F',
  harvestLeather:
    '11111Fc13ScQNrjp3VYRGKkdTpRwCG8Kb3e2NiD7JkJu9fzvufVYPk9dJR15zjwDHSEmLvroM8fSgC2c43umHD821PYPiCtw4gzLAmhAC8NrtS2JEaftfRP5',
  harvestFabric:
    '11111Fc13ScQNrjpJKzkx7hdL8ctd2mZKPoYWiisiFA5e7x1RpUHPeTNrLiPuzWuaDxf32WWoUaxWzAmk8JFM1p7Pc7DLriJ1cbwS56BMjjr9oqfE228kz31',
  harvestHerb:
    '57uBnWgpsMuKK1uuA4drqFZzE9msHyXhFSiuGgAfuMVRPGu5xGtCTnW73sDjo7Du5Qp4wYc753qEVoMK1JCwuktKmVBEvtHh5nqZrhoRuqCo5XHqqFBGBkAxF',
  harvestGold:
    '11111Fc13ScQNrjpJKzkx9MiDiFq9kuUs8BvHtCZWbvS2VKB5UxuUuEtQsgjGX3oKxkxrnu7zhqRVH1dVBxCDG7hTd62Lpkk97PMCYdGgmucB8jfzQembvEj',

  // ── Inventaire / Économie / Craft ──
  // équiper un objet
  itemEquip:
    '34T6PktrzF8yDcSN3aenS6uu7iaK6oMAfUFFZAE1Az9Cm9NqpZfGLjzbn4C1w1U6wsFtExdGWZve2DgMhf342tBae6T5FTSQH9jrpwcKmy8Eoy5b94kpC2gPH',
  // ramasser un objet / loot
  itemPickup:
    '11111mqnbhVWL9Zs9Q23sp1SvjVrHmVV5b5fC7NEyf7819r5ZUd4phqPcEbHpUatpbjuN5SyrrDFbvNZ7GVo3gWBJ2UpvdBqoroNwEv95pKAB7E97jnzWR5',
  // gain de kamas
  coinGain:
    '11111BFZ5ucmHywDrRxPp2nxqiSdUgqEuR5uotQm3xUjYmkY1apTn4rp22xivcMScdDHXVHFtDG53d5dkw9tLSAgWgfu5n6YzzWbDmbgxm4NEKnzPizz46LP',
  // craft réussi
  craftSuccess:
    '11111FbzaGb4pVMBofptYCQScfYv9Tv1zujo4u8hGmZXzCqQT4DfC8wHejZsArMBrj3wMzL2Kw7BZco3KWQrhApRqXbbUuaFzm9VMR9vU3woAjyPZFq8BCE3',
  // craft échoué
  craftFail:
    '11111HnDKZE1agzVtV56SbtMtryh9CGs13sXabMb42AU5LcpZ6xZi5JtzMGNopDkbi5MdmMHM317dSg12srmhWZCgTVmXjT37PH4N14xMf26AQmXFFk1gMWf',
  // montée de niveau
  levelUp:
    '11111BxFXqzoXRbMkQDTLxj9cS468yVaPnJPRBSfLYVmcctj4fGSJt4q6cGtUqiKttqadhm7HiRQaRDqkLrnwkGEKj8eezcGCroxpmivtoeFSNyEZT9TpomR',
} satisfies Record<string, string>;

export type SfxName = keyof typeof SFX;

/** Son de lancement distinct par sort (clé = code du sort). Fallback : « spellCast ». */
export const SPELL_CAST_SFX: Record<string, SfxName> = {
  "spell-boule-de-feu": "castFireball",
  "spell-frappe": "castSlash",
  "spell-claque": "castSlap",
  "spell-kunai": "castKunai",
  "spell-bombe-repousse": "castBomb",
  "spell-soin": "castHeal",
  "spell-heal": "castHeal",
  "spell-endurance": "castEndurance",
  "spell-velocite": "castVelocite",
  "spell-buff-pm": "castVelocite",
  "spell-bond": "castLeap",
  "spell-menhir": "castMenhir",
};

// Un son est synthétisé une seule fois puis rejoué (chaque play() crée une nouvelle source).
const cache = new Map<SfxName, SfxrAudio>();

// La chaîne base58 sfxr ne porte PAS le volume : on l'applique à la lecture.
// 1 = volume du preset ; < 1 pour atténuer un son trop fort.
const SFX_VOLUME: Partial<Record<SfxName, number>> = {
  harvestComplete: 0.5,
  harvestWood: 0.5,
  harvestIron: 0.5,
  harvestCrystal: 0.5,
  harvestLeather: 0.5,
  harvestFabric: 0.5,
  harvestHerb: 0.5,
  harvestGold: 0.5,
  // Les pas doivent rester discrets (joués souvent en marchant).
  footstepA: 0.3,
  footstepB: 0.3,
};

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
      audio = buildAudio(SFX[name]);
      cache.set(name, audio);
    }
    const volume = SFX_VOLUME[name];
    if (volume !== undefined) audio.setVolume?.(volume);
    audio.play();
  } catch {
    /* sfx best-effort */
  }
}
