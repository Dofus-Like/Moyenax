// Génère des SceneTemplate JSON importables dans l'éditeur (/editor → Scène → Importer).
// Usage : node scripts/gen-example-scenes.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'example-scenes');
mkdirSync(OUT, { recursive: true });

let n = 0;
const id = () => `prop-${++n}`;
const prop = (modelKey, position, opts = {}) => ({
  id: id(),
  modelKey,
  position: position.map((v) => Math.round(v * 100) / 100),
  rotation: opts.rotation ?? [0, 0, 0],
  scale: opts.scale ?? 1,
  collides: opts.collides ?? true,
});

const ambiance = (timeOfDay, ambientIntensity, directionalIntensity) => ({
  timeOfDay,
  ambientIntensity,
  directionalIntensity,
});

function ring(modelKey, count, radius, opts = {}) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return prop(modelKey, [Math.cos(a) * radius, 0, Math.sin(a) * radius], {
      ...opts,
      rotation: [0, -a, 0],
    });
  });
}

function scatter(modelKey, points, opts = {}) {
  return points.map((p) => prop(modelKey, [p[0], 0, p[1]], opts));
}

const scenes = [
  {
    id: 'menhir-circle',
    name: 'Cercle de menhirs',
    terrain: { width: 11, height: 11, seedId: 'NATURE' },
    ambiance: ambiance('day', 0.9, 1.4),
    props: [
      ...ring('props/menhir.glb', 8, 6, { scale: 1.4 }),
      prop('props/crystal_cluster.glb', [0, 0, 0], { scale: 1.6 }),
      ...scatter('props/grass.glb', [[2, 1], [-2, -1], [1, -3], [-3, 2]], { scale: 1, collides: false }),
      ...scatter('props/herb_plants.glb', [[3, 3], [-3, -3]], { scale: 1, collides: false }),
    ],
  },
  {
    id: 'ruined-outpost',
    name: 'Avant-poste en ruine',
    terrain: { width: 11, height: 11, seedId: 'FORGE' },
    ambiance: ambiance('sunset', 0.6, 1.2),
    props: [
      prop('environments/castle_ruin.glb', [0, 0, -1], { scale: 1.2 }),
      ...ring('props/rock_pile.glb', 6, 5, { scale: 1.1 }),
      ...scatter('props/grass.glb', [[4, 4], [-4, 4], [4, -4], [-4, -4]], { scale: 1, collides: false }),
      ...scatter('props/herb_plants.glb', [[2, -3], [-2, 3]], { scale: 1, collides: false }),
    ],
  },
  {
    id: 'crystal-glade',
    name: 'Clairière de cristaux',
    terrain: { width: 11, height: 11, seedId: 'ARCANE' },
    ambiance: ambiance('night', 0.35, 0.5),
    props: [
      ...scatter('props/crystal_cluster.glb', [[0, 0], [3, 2], [-3, 1], [1, -3], [-2, -2]], { scale: 1.3 }),
      ...ring('props/menhir.glb', 4, 4.5, { scale: 1.2 }),
      ...scatter('props/grass.glb', [[2, 3], [-3, 3], [4, -1]], { scale: 1, collides: false }),
      ...scatter('props/herb_plants.glb', [[-1, 4], [4, 2]], { scale: 1, collides: false }),
    ],
  },
];

for (const scene of scenes) {
  n = 0; // ids repartent à prop-1 par scène
  const rebuilt = { ...scene, props: scene.props.map((p) => ({ ...p, id: `prop-${++n}` })) };
  const file = join(OUT, `${scene.id}.json`);
  writeFileSync(file, `${JSON.stringify(rebuilt, null, 2)}\n`);
  console.log(`écrit ${file} (${rebuilt.props.length} props)`);
}
