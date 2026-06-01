# Design System UI — référence unique pour les IA

> **Document destiné aux IA.** Pour **tout** travail d'interface sur ce repo, applique **exclusivement** ce design : tokens, surface « glass », composants et patterns ci-dessous. N'introduis **aucune** autre convention visuelle, thème, couleur ad hoc ou librairie de composants.
>
> Issu de la refonte du HUD de combat (PR [#146](https://github.com/Dofus-Like/Dofus-Like/pull/146)). Extrait du code réel : `apps/web/src/game/HUD/*`, `apps/web/src/components/SpellBar/*`, `apps/web/src/game/constants/colors.ts`, `apps/web/src/styles/global.css`.
> (Game-design *gameplay* = [`docs/GAME_DESIGN_DOCUMENT_v2.md`](./docs/GAME_DESIGN_DOCUMENT_v2.md), distinct de ce doc UI.)

---

## 1. Direction artistique

HUD de combat tactique « façon Dofus », posé en **overlay plein écran** par-dessus la scène 3D (R3F).
Trois partis pris signature :

1. **Dark glassmorphism** — surfaces noires translucides + `backdrop-filter: blur`, jamais de panneau opaque plein.
2. **Double contour pixel** — chaque surface a un liseré **blanc 2px** doublé d'un **outline noir 1.5px** → rendu « sticker » net et lisible sur fond mouvant.
3. **Typo pixel-art** — police bitmap `BoldPixels` sur tout le HUD, texte cerné d'un **outline noir 8 directions** pour rester lisible sur n'importe quel fond.

Codes couleur fonctionnels constants partout : **PA = jaune**, **PM = violet**, **PV = rouge**, et une couleur par **famille de sort** / **rang d'objet**.

---

## 2. Fondations (tokens)

Deux sources de tokens, toutes deux exposées en variables CSS sur `:root` :

- **`global.css`** → tokens génériques de l'app (`--color-*`, `--font-*`, `--radius-*`).
- **`colors.ts`** → palette combat `COMBAT_COLORS`, injectée à l'exécution en `--kebab-case` + variante `-rgb`
  (ex. `PA_YELLOW` → `--pa-yellow` **et** `--pa-yellow-rgb` pour `rgb(var(--pa-yellow-rgb) / 0.5)`).

### 2.1 Couleurs — ressources de combat

| Rôle | Token | Valeur |
|---|---|---|
| PA (points d'action) | `--pa-yellow` | `#fca800` |
| PA (variante) | `--pa-yellow-dark` | `#fbbf24` |
| PM (points de mouvement) | `--pm-violet` | `#9531ff` |
| PM (variante) | `--pm-violet-dark` | `#5900ac` |
| PV | `--hp-red` | `#ef4444` |
| Barre de vie (dégradé) | — | `#8b0000 → #ff1a1a → #8b0000` |
| Soin | `--heal-green` | `#22c55e` |
| Portée de sort | `--range-orange` | `#fca800` |
| Victoire | `--victory-gold` | `#fbbf24` |
| Défaite | `--defeat-red` | `#ef4444` |

### 2.2 Couleurs — familles de sorts & stats

| Famille | Couleur | | Stat | Couleur |
|---|---|---|---|---|
| COMMON | `#fbbf24` | | ATK | `#f87171` |
| WARRIOR | `#f87171` / `#ef4444` | | DEF | `#60a5fa` |
| MAGE | `#60a5fa` / `#3b82f6` | | MAG | `#c084fc` |
| NINJA | `#4ade80` / `#10b981` | | RES | `#4ade80` |

> La famille teinte **3 endroits** : voile de la carte de sort (`rgba(..,0.45)`), titre de tooltip, ordre de tri.

### 2.3 Couleurs — rang d'objet (rareté)

| Rang | Couleur | Rang | Couleur |
|---|---|---|---|
| rank-1 (commun) | `#d1d5db` gris | rank-4 (épique) | `#a855f7` violet |
| rank-2 (rare) | `#4ade80` vert | rank-5 (légendaire) | `#fca800` or |
| rank-3 (élite) | `#3b82f6` bleu | | |

### 2.4 Couleurs — paliers d'« overflow » de ressources

Les jauges PA/PM affichent les bonus au-delà du max via une **échelle de paliers colorés** (losanges) :

- **PA** : plein `#fca800` → overflow `#00e5ff` (cyan) → overflow-2 `#fbbf24` (or)
- **PM** : plein `#9531ff` → overflow `#f43f5e` (rose) → overflow-2 `#00e5ff` (cyan) → overflow-3 `#fbbf24` (or)
- **vide** : `rgba(255,255,255,0.1)`

### 2.5 Couleurs — journal de combat

| Type | Texte | Liseré gauche |
|---|---|---|
| info | `#dbeafe` | `#60a5fa` |
| damage | `#fecaca` | `#ef4444` |
| victory | `#fef3c7` | `#fbbf24` |
| chat | `#fff` | `#a855f7` (auteur en `#a855f7` gras) |

### 2.6 Typographie

| Token | Valeur | Usage |
|---|---|---|
| `--font-main` | `Inter, system-ui, sans-serif` | UI générale (hors combat) |
| `--font-hud` | `"BoldPixels", "Inter", sans-serif` | **tout le HUD de combat** |

- Échelle en `rem`, du `0.55rem` (label stat) au `4rem` (titre fin de combat).
- **Outline texte 8 directions** (signature, à reproduire pour tout texte sur fond image) :

```css
text-shadow:
  -2px -2px 0 #000,  2px -2px 0 #000, -2px 2px 0 #000,  2px 2px 0 #000,
   0   -2px 0 #000,  0    2px 0 #000, -2px 0   0 #000,  2px 0   0 #000;
```

### 2.7 Rayons, ombres, flou, transitions, profondeur

| Catégorie | Valeurs |
|---|---|
| Rayons | `--radius-xs/sm/md/lg = 2/6/12/24px`, `--radius-full`, `--radius-circle`. **HUD : 6px** dominant. |
| Ombre HUD | `--shadow-hud: 0 4px 15px rgba(0,0,0,.3)` |
| Lueur | `--shadow-glow: 0 0 30px rgba(96,165,250,.4)` |
| Flou | **ambiance** `blur(6px)` · **focus** (panneaux ouverts, tooltips, toasts) `blur(24px)` |
| Transition standard | `--trans-fast: .2s` · `--trans-med: .4s` — `cubic-bezier(.4,0,.2,1)` |
| Transition « ressort » | `cubic-bezier(.34,1.56,.64,1)` (toasts, modales, pop stats) |

**Échelle de z-index** (à respecter pour tout nouvel élément) :

| Couche | z-index |
|---|---|
| Racine HUD | `10` |
| Ancre basse | `50` |
| TurnTracker | `80` |
| Panneau joueur | `90` |
| Toast | `140` |
| Tooltips | `1000` |
| Modale fin de combat / loading | `9999` |

---

## 3. La surface « Glass » (brique fondamentale)

Toutes les surfaces du HUD dérivent d'une **recette unique** déclinée en deux intensités.

```css
/* Recette de référence */
background: rgba(0, 0, 0, 0.55);              /* ambiance — 0.95 en focus */
border: 2px solid rgba(255, 255, 255, 0.9);  /* liseré blanc */
outline: 1.5px solid rgba(0, 0, 0, 0.85);    /* doublure noire = signature */
border-radius: 6px;
backdrop-filter: blur(6px);                   /* 24px en focus */
box-shadow:
  0 8px 32px rgba(0,0,0,.6),                  /* ombre portée */
  inset 0 0 0 1px rgba(0,0,0,.75),            /* liseré interne noir */
  inset 0 0 40px rgba(0,0,0,.65);             /* vignettage interne */
animation: hud-fade-in .25s ease both;        /* apparition systématique */
```

| Intensité | Fond | Flou | Quand |
|---|---|---|---|
| **Ambiance** | `rgba(0,0,0,.55)` | `blur(6px)` | surfaces toujours visibles (panneaux, avatars, boutons) |
| **Focus** | `rgba(0,0,0,.95)` | `blur(24px)` | éléments appelés au premier plan (tooltips, toast, panneau logs ouvert, popout stats) |

> ⚠️ La classe `.glass` est **redéfinie deux fois** (dans `CombatHUD.css` à `.55` et dans `SpellBar.css` à `.8`). Voir §7.

---

## 4. Anatomie de l'écran de combat

Overlay plein écran en `pointer-events: none` ; **seuls les éléments interactifs** repassent en `auto`
(discipline appliquée partout via `.conteneur { pointer-events: none } .conteneur > * { pointer-events: auto }`).

```
┌───────────────────────────────────────────────────────────────┐
│ [TurnTracker]                                   [Panneau ENNEMI]│  haut
│  TOUR 3 · frise initiative                       (side-right)   │
│                                                                 │
│                      · · scène 3D · ·                           │
│                                                                 │
│                       [Toast centré]                            │
│                                                                 │
│ [Panneau JOUEUR]   ┌──── rangée basse (hud-bottom-row) ────┐    │  bas
│  (side-left)       │ ⌘actions │  SpellBar + Fin  │ chat ⌘  │    │
└───────────────────────────────────────────────────────────────┘
        Modale fin de combat = overlay plein écran par-dessus tout
```

| Zone | Ancrage | Contenu |
|---|---|---|
| TurnTracker | haut-gauche `top/left: 24px` | label `TOUR n` + frise des combattants |
| Panneau joueur | bas-gauche `left: 24px; bottom: 30px` | avatar, PV, PA/PM, stats |
| Panneau ennemi | haut-droite `right: 24px; top: 24px` | idem, miroir (`row-reverse`) |
| Rangée basse | `bottom: 24px`, pleine largeur | 3 groupes : actions gauche · centre (SpellBar) · droite (chat) |
| ⌘ actions gauche | colonne, bas | Émotes · Abandonner · **Mode tactique** |
| Centre | — | **SpellBar** (avec **EndTurnButton** injecté en `children`) |
| ⌘ actions droite | colonne, bas | Journal de combat (badge non-lus) · Statistiques |
| Toast | haut-centre `top: 28px` | message éphémère (2.4s) |
| Modale fin | `inset: 0` | Victoire / Défaite |

---

## 5. Catalogue de composants

### 5.1 TurnTracker — frise d'initiative
`game/HUD/TurnTracker.tsx` · `TurnTracker.css`

- Combattants **triés par initiative** (`stats.ini` décroissant), label `TOUR n`.
- **AvatarCircle** : carré `40×40`, radius 6px, sprite animé (`steps(6)` idle) ou emoji.
- États de bordure : **soi** `#3b82f6` (actif `#60a5fa`) · **ennemi** `#ef4444` (actif `#f87171`) · **actif** = glow `0 0 12px`.
- **Invocation** (Menhir) : emoji 🗿 + badge passif ♾️, **pas de numéro de slot** (ne joue pas de tour).
- Mobile (`≤768px`) : avatars `26×26`.

### 5.2 CombatPlayerPanel — panneau combattant
`game/HUD/CombatPlayerPanel.tsx` · `CombatPlayerPanel.css`

- **Frame** glass `176px` (mobile `128px`), `overflow:hidden`.
- **Portrait** `128px`, dégradés haut/bas pour lisibilité du texte incrusté.
- **Pseudo** incrusté en haut, **PA (jaune) / PM (violet)** incrustés en bas.
- **Barre de PV** `28px` : fond `#2a0000`, remplissage dégradé rouge à largeur figée (`background-size:172px`) + texte centré.
- **État `is-turn`** : bordure blanche + **gradient animé** (`avatar_gradient` 24s, jaune→violet) + glow.
- **État `is-targetable`** : `cursor: crosshair` + outline blanc (cible de sort).
- **Badges de statut** (poison vert / burn rouge / freeze bleu) en colonne sur le flanc, avec **buff-tooltip** glass-focus.
- **Bouton stats `44×44`** → **popout** (`stats-pop` 0.2s) : grille de stats + slots d'objets (bordure = couleur de rang) + section équipement dépliable scrollable.

### 5.3 SpellBar — barre de sorts
`components/SpellBar/SpellBar.tsx` · `SpellBar.css`

Structure : **rangée de cartes** (+ séparateur + actions optionnelles + `children`) puis **rangée ressources PA/PM**.

- **Carte de sort `58×58`** (tablette `66`, mobile `58`) :
  - Icône en **plein cadre forcée en niveaux de gris** (`grayscale(100%) contrast(1.15)`), **voile coloré par famille** par-dessus.
  - **Badge index** (raccourci clavier) en haut-gauche.
  - **Coût PA** en **losange jaune** débordant en bas (`rotate(45deg)`, texte contre-tourné).
  - États : `hover` (translate -5px), `active` (glow + -3px), `disabled` (grayscale + 0.4), `--empty` (pointillés).
  - Overlay **cooldown** (chiffre sur voile noir).
- **Tooltip premium** (glass-focus, `240px`) : titre coloré famille + coût, description *italique*, **section calcul de dégâts** (label / résultat `#60a5fa` / formule monospace), pied portée (violet) + cooldown (rouge), **sous-tooltips de mots-clés** sur le flanc.
- **Emplacement d'action intégré** = `children` (ici l'**EndTurnButton**) ; variantes CSS prévues `grimoire` (44×44) et `pass` (pulse `ready`).

### 5.4 Jauges PA / PM — losanges
- Suite de **losanges `6px` `rotate(45deg)`** + compteur `n/max` (PA jaune à gauche, PM violet à droite).
- Chaque losange : `full` / `empty` / `overflow*` selon §2.4, cerné de l'outline noir 8 directions.

### 5.5 EndTurnButton — fin de tour
`game/HUD/EndTurnButton.tsx` · `EndTurnButton.css`

- **Forme losange `72×72`** (`clip-path` + polygones SVG superposés : contour noir ext. / fond+blanc / contour noir int. / **anneau timer**).
- **Timer circulaire** (`stroke-dashoffset`, périmètre ≈ 203.6, tick 100ms) : `#fca800` → **`#ef4444` à ≤5s** (+ pulse `is-low`).
- Libellé `PASS TURN` (actions restantes) vs **`END TURN`** (plus rien à faire) ; état `no-actions-left` → pulse ambré.
- Hors tour : `disabled`, anneau gris, label `…`.

### 5.6 Boutons HUD génériques — `.hud-log-btn`
- Carré `36×36`, glass-focus, **icône PNG monochrome** normalisée via `filter: brightness(0) invert(1)`.
- États `hover`/`active` = bordure blanche. **Badge de notification en losange** (`clip-path`, fond `#ef4444`).
- Utilisés pour : émotes, abandon, mode tactique, journal, stats.

### 5.7 Panneau Journal / Chat — `.log-panel`
`game/HUD/CombatChatPanel.tsx`

- Panneau qui **s'ouvre en largeur** (animation `width 0 → max 400px`), hauteur fixe `140px`, glass-focus.
- **Onglets Combat / Chat** ; liste en `column-reverse` (plus récent en bas), scrollbar custom fine.
- `log-entry` colorée par type (§2.5) ; onglet Chat = champ de saisie (local front-only).

### 5.8 Toast & Modale fin de combat
- **Toast** : centré haut, glass-focus, entrée ressort `toastIn` / sortie `toastOut`, auto-dismiss 2.4s.
- **Modale fin** : overlay `rgba(0,0,0,.85)` + `blur(10px)`, carte `scaleIn` ressort ; bordure/halo **or (victoire)** ou **rouge (défaite)**, titre `4rem`.

---

## 6. Patterns transverses (à réutiliser tels quels)

1. **Double contour pixel** (blanc 2px + outline noir 1.5px) sur toute surface → identité visuelle.
2. **Outline texte 8 directions** dès qu'un texte passe sur une image/fond variable.
3. **Glass à 2 intensités** : ambiance `blur(6)` / focus `blur(24)` — ne pas inventer d'autres niveaux.
4. **Icônes normalisées** : PNG passés en monochrome (`brightness(0) invert(1)`) ; icônes de sorts en grayscale + voile famille.
5. **Code couleur fonctionnel constant** : PA=jaune, PM=violet, PV=rouge, famille/rang réutilisés partout.
6. **Losange** = motif récurrent (coût PA, jauges, badge notif, bouton fin de tour).
7. **Discipline `pointer-events`** : conteneurs `none`, interactifs `auto`.
8. **Apparition systématique** `hud-fade-in` ; ressort `cubic-bezier(.34,1.56,.64,1)` pour les éléments importants.
9. **Responsive** : breakpoints `1024px` et `768px` ; on réduit tailles (avatars, cartes, frame, police), on ne réorganise pas la structure.

---

## 7. Incohérences relevées (à arbitrer pour faire de ce doc la vraie source de vérité)

> Constats factuels issus de la lecture du CSS — utiles si l'on veut **tokeniser** proprement.

- **Classe `.glass` dupliquée** avec des valeurs différentes : `CombatHUD.css` (`bg .55`) vs `SpellBar.css` (`bg .8`). Collision de classe globale.
- **Tokens de rayon non appliqués** : `--glass-radius` vaut `9px` (global) / `14px` (CombatHUD), mais les surfaces codent `6px` en dur.
- **`--radius-sm/md` divergents** : `5/7px` (global) vs `6/12px` (CombatHUD).
- **Deux familles de tokens couleur qui se chevauchent** : `--color-*` (global) et `COMBAT_COLORS` (`--pa-yellow`…). Beaucoup de hex restent **en dur** dans le CSS au lieu d'utiliser ces variables.
- **`global.css` duplique tout son contenu** (`body`, `.loading-screen`, `@keyframes spin`) — blocs lignes ~52-116 puis ~118-182.
- **`@keyframes hud-fade-in` redéfini** dans plusieurs fichiers avec des `translateY` différents (`6px` vs `-4px` vs `8px`).

---

### Fichiers de référence
`apps/web/src/game/HUD/{CombatHUD,CombatPlayerPanel,CombatChatPanel,TurnTracker,EndTurnButton}.{tsx,css}` ·
`apps/web/src/components/SpellBar/SpellBar.{tsx,css}` ·
`apps/web/src/game/constants/colors.ts` · `apps/web/src/styles/global.css` ·
bac à sable : `apps/web/src/pages/HudTestPage.tsx` (route `/hud-test`).
