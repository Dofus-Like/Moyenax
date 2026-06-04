import { describe, expect, it } from 'vitest';

import { buildModelTree, type ModelEntry } from './modelRegistry';

const entries: ModelEntry[] = [
  { key: 'environments/hub.glb', name: 'hub.glb', folder: 'environments', url: '/a' },
  { key: 'environments/verdant.glb', name: 'verdant.glb', folder: 'environments', url: '/b' },
  { key: 'poi/combat.glb', name: 'combat.glb', folder: 'poi', url: '/c' },
  { key: 'racine.glb', name: 'racine.glb', folder: '', url: '/d' },
];

describe('buildModelTree', () => {
  it('reflète les sous-dossiers en nœuds et place les modèles racine à la racine', () => {
    const tree = buildModelTree(entries);
    expect(tree.folders.map((f) => f.name)).toEqual(['environments', 'poi']);
    expect(tree.models.map((m) => m.name)).toEqual(['racine.glb']);
  });

  it('range les modèles dans leur dossier', () => {
    const tree = buildModelTree(entries);
    const env = tree.folders.find((f) => f.name === 'environments');
    expect(env?.models.map((m) => m.name)).toEqual(['hub.glb', 'verdant.glb']);
    expect(env?.path).toBe('environments');
  });

  it('gère les dossiers imbriqués', () => {
    const tree = buildModelTree([{ key: 'a/b/c.glb', name: 'c.glb', folder: 'a/b', url: '/x' }]);
    const a = tree.folders[0];
    expect(a.name).toBe('a');
    expect(a.folders[0].name).toBe('b');
    expect(a.folders[0].models[0].name).toBe('c.glb');
  });
});
