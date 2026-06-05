import { createEmptyTemplate, parseSceneTemplate } from './scene.types';

describe('parseSceneTemplate', () => {
  it('accepte un template valide (round-trip JSON)', () => {
    const template = createEmptyTemplate();
    template.props.push({
      id: 'prop-1',
      modelKey: 'props/rock.glb',
      position: [1, 0, 2],
      rotation: [0, 0, 0],
      scale: 1,
      collides: false,
    });
    const parsed = parseSceneTemplate(JSON.parse(JSON.stringify(template)));
    expect(parsed).toEqual(template);
  });

  it('normalise collides à true pour les props héritées (sans le champ)', () => {
    const base = createEmptyTemplate();
    const legacy = {
      ...base,
      props: [{ id: 'p', modelKey: 'm', position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }],
    };
    const parsed = parseSceneTemplate(legacy);
    expect(parsed?.props[0].collides).toBe(true);
  });

  it('rejette les valeurs non-objet', () => {
    expect(parseSceneTemplate(null)).toBeNull();
    expect(parseSceneTemplate('{}')).toBeNull();
    expect(parseSceneTemplate(42)).toBeNull();
  });

  it('rejette un terrain ou une ambiance manquants', () => {
    const base = createEmptyTemplate();
    expect(parseSceneTemplate({ ...base, terrain: undefined })).toBeNull();
    expect(parseSceneTemplate({ ...base, ambiance: undefined })).toBeNull();
  });

  it('rejette une prop mal formée (position non-Vec3)', () => {
    const base = createEmptyTemplate();
    const bad = {
      ...base,
      props: [{ id: 'x', modelKey: 'm', position: [1, 2], rotation: [0, 0, 0], scale: 1 }],
    };
    expect(parseSceneTemplate(bad)).toBeNull();
  });
});
