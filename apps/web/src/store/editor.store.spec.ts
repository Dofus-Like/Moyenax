import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore } from './editor.store';

function reset(): void {
  useEditorStore.getState().resetTemplate();
  useEditorStore.getState().select(null);
  useEditorStore.getState().setGizmoMode('translate');
  useEditorStore.getState().setPlacingModel(null);
  useEditorStore.getState().setMode('edit');
  useEditorStore.getState().setSnapToGrid(false);
  useEditorStore.getState().setShowColliders(false);
  useEditorStore.setState({ past: [], future: [], clipboard: [], showShortcuts: false });
}

function addTwo(): [string, string] {
  useEditorStore.getState().addProp('props/a.glb', [0, 0, 0]);
  useEditorStore.getState().addProp('props/b.glb', [4, 0, 0]);
  const [a, b] = useEditorStore.getState().template.props;
  return [a.id, b.id];
}

describe('useEditorStore', () => {
  beforeEach(reset);

  it('addProp ajoute une prop avec des défauts et un id unique', () => {
    useEditorStore.getState().addProp('props/rock.glb', [1, 0, 2]);
    useEditorStore.getState().addProp('props/tree.glb', [3, 0, 4]);

    const { props } = useEditorStore.getState().template;
    expect(props).toHaveLength(2);
    expect(props[0]).toMatchObject({
      modelKey: 'props/rock.glb',
      position: [1, 0, 2],
      rotation: [0, 0, 0],
      scale: 1,
    });
    expect(props[0].id).not.toBe(props[1].id);
  });

  it('addProp active la collision par défaut', () => {
    useEditorStore.getState().addProp('props/rock.glb', [0, 0, 0]);
    expect(useEditorStore.getState().template.props[0].collides).toBe(true);
  });

  it('addProp aligne sur la grille quand snapToGrid est actif', () => {
    useEditorStore.getState().setSnapToGrid(true);
    useEditorStore.getState().addProp('props/rock.glb', [1.4, 0.5, 2.6]);
    expect(useEditorStore.getState().template.props[0].position).toEqual([1, 0.5, 3]);
  });

  it('duplicateProp clone la prop avec un décalage et la sélectionne', () => {
    useEditorStore.getState().addProp('props/rock.glb', [2, 0, 2]);
    const id = useEditorStore.getState().template.props[0].id;
    useEditorStore.getState().duplicateProp(id);
    const props = useEditorStore.getState().template.props;
    expect(props).toHaveLength(2);
    expect(props[1].position).toEqual([3, 0, 3]);
    expect(props[1].id).not.toBe(id);
    expect(useEditorStore.getState().selectedId).toBe(props[1].id);
  });

  it('setShowColliders bascule l’affichage des collisions', () => {
    useEditorStore.getState().setShowColliders(true);
    expect(useEditorStore.getState().showColliders).toBe(true);
  });

  it('addProp sélectionne automatiquement la prop ajoutée', () => {
    useEditorStore.getState().addProp('props/rock.glb', [0, 0, 0]);
    const { template, selectedId } = useEditorStore.getState();
    expect(selectedId).toBe(template.props[0].id);
  });

  it('updateProp patch uniquement la prop ciblée', () => {
    useEditorStore.getState().addProp('props/rock.glb', [0, 0, 0]);
    useEditorStore.getState().addProp('props/tree.glb', [0, 0, 0]);
    const [first, second] = useEditorStore.getState().template.props;

    useEditorStore.getState().updateProp(second.id, { scale: 2.5, rotation: [0, 1, 0] });

    const props = useEditorStore.getState().template.props;
    expect(props.find((p) => p.id === second.id)).toMatchObject({
      scale: 2.5,
      rotation: [0, 1, 0],
    });
    expect(props.find((p) => p.id === first.id)?.scale).toBe(1);
  });

  it('removeProp retire la prop et désélectionne si elle était active', () => {
    useEditorStore.getState().addProp('props/rock.glb', [0, 0, 0]);
    const id = useEditorStore.getState().template.props[0].id;

    useEditorStore.getState().removeProp(id);

    expect(useEditorStore.getState().template.props).toHaveLength(0);
    expect(useEditorStore.getState().selectedId).toBeNull();
  });

  it('removeProp conserve la sélection si une autre prop est active', () => {
    useEditorStore.getState().addProp('props/rock.glb', [0, 0, 0]);
    useEditorStore.getState().addProp('props/tree.glb', [0, 0, 0]);
    const [first, second] = useEditorStore.getState().template.props;
    useEditorStore.getState().select(second.id);

    useEditorStore.getState().removeProp(first.id);

    expect(useEditorStore.getState().selectedId).toBe(second.id);
  });

  it('select et setGizmoMode mettent à jour le state', () => {
    useEditorStore.getState().select('prop-1');
    useEditorStore.getState().setGizmoMode('rotate');
    expect(useEditorStore.getState().selectedId).toBe('prop-1');
    expect(useEditorStore.getState().gizmoMode).toBe('rotate');
  });

  it('setTimeOfDay applique le preset (moment + intensités par défaut)', () => {
    useEditorStore.getState().setTimeOfDay('night');
    const { ambiance } = useEditorStore.getState().template;
    expect(ambiance.timeOfDay).toBe('night');
    expect(ambiance.ambientIntensity).toBe(0.35);
    expect(ambiance.directionalIntensity).toBe(0.5);
  });

  it('setAmbientIntensity et setDirectionalIntensity surchargent le preset', () => {
    useEditorStore.getState().setTimeOfDay('day');
    useEditorStore.getState().setAmbientIntensity(0.2);
    useEditorStore.getState().setDirectionalIntensity(2.1);
    const { ambiance } = useEditorStore.getState().template;
    expect(ambiance.timeOfDay).toBe('day');
    expect(ambiance.ambientIntensity).toBe(0.2);
    expect(ambiance.directionalIntensity).toBe(2.1);
  });

  it('loadTemplate charge un template et évite les collisions d’id', () => {
    useEditorStore.getState().loadTemplate({
      id: 'imported',
      name: 'Importée',
      terrain: { width: 11, height: 11, seedId: 'ARCANE' },
      ambiance: { timeOfDay: 'sunset', ambientIntensity: 0.6, directionalIntensity: 1.2 },
      props: [
        {
          id: 'prop-5',
          modelKey: 'props/rock.glb',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
          collides: true,
        },
      ],
    });
    expect(useEditorStore.getState().template.name).toBe('Importée');
    expect(useEditorStore.getState().selectedId).toBeNull();

    useEditorStore.getState().addProp('props/tree.glb', [0, 0, 0]);
    const ids = useEditorStore.getState().template.props.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // pas de doublon
  });

  it('setMode bascule entre édition et jeu', () => {
    expect(useEditorStore.getState().mode).toBe('edit');
    useEditorStore.getState().setMode('play');
    expect(useEditorStore.getState().mode).toBe('play');
  });

  it('setSeedId change le seed du terrain', () => {
    useEditorStore.getState().setSeedId('FORGE');
    expect(useEditorStore.getState().template.terrain.seedId).toBe('FORGE');
  });

  it('setPlacingModel arme le modèle à poser', () => {
    useEditorStore.getState().setPlacingModel('props/rock.glb');
    expect(useEditorStore.getState().placingModelKey).toBe('props/rock.glb');
    useEditorStore.getState().setPlacingModel(null);
    expect(useEditorStore.getState().placingModelKey).toBeNull();
  });

  it('undo annule le dernier ajout et redo le rétablit', () => {
    useEditorStore.getState().addProp('props/rock.glb', [0, 0, 0]);
    expect(useEditorStore.getState().template.props).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().template.props).toHaveLength(0);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().template.props).toHaveLength(1);
  });

  it('une nouvelle action après undo efface le redo', () => {
    useEditorStore.getState().addProp('props/rock.glb', [0, 0, 0]);
    useEditorStore.getState().undo();
    useEditorStore.getState().addProp('props/tree.glb', [1, 0, 1]);
    useEditorStore.getState().redo(); // ne doit rien faire
    expect(useEditorStore.getState().template.props).toHaveLength(1);
    expect(useEditorStore.getState().template.props[0].modelKey).toBe('props/tree.glb');
  });

  it('undo sans historique ne plante pas', () => {
    expect(() => useEditorStore.getState().undo()).not.toThrow();
    expect(useEditorStore.getState().template.props).toHaveLength(0);
  });

  it('copySelected + paste ajoute un clone décalé', () => {
    useEditorStore.getState().addProp('props/rock.glb', [2, 0, 2]);
    const id = useEditorStore.getState().template.props[0].id;
    useEditorStore.getState().select(id);
    useEditorStore.getState().copySelected();
    useEditorStore.getState().paste();
    const props = useEditorStore.getState().template.props;
    expect(props).toHaveLength(2);
    expect(props[1].position).toEqual([3, 0, 3]);
    expect(props[1].id).not.toBe(id);
  });

  it('selectNext cycle la sélection dans les deux sens', () => {
    useEditorStore.getState().addProp('props/a.glb', [0, 0, 0]);
    useEditorStore.getState().addProp('props/b.glb', [0, 0, 0]);
    const [a, b] = useEditorStore.getState().template.props;

    useEditorStore.getState().select(null);
    useEditorStore.getState().selectNext(1);
    expect(useEditorStore.getState().selectedId).toBe(a.id);
    useEditorStore.getState().selectNext(1);
    expect(useEditorStore.getState().selectedId).toBe(b.id);
    useEditorStore.getState().selectNext(1);
    expect(useEditorStore.getState().selectedId).toBe(a.id); // wrap
    useEditorStore.getState().selectNext(-1);
    expect(useEditorStore.getState().selectedId).toBe(b.id); // wrap back
  });

  it('nudgeSelected décale la prop sélectionnée', () => {
    useEditorStore.getState().addProp('props/a.glb', [2, 0, 3]);
    const id = useEditorStore.getState().template.props[0].id;
    useEditorStore.getState().select(id);
    useEditorStore.getState().nudgeSelected(1, -1);
    expect(useEditorStore.getState().template.props[0].position).toEqual([3, 0, 2]);
  });

  it('toggleSelect ajoute puis retire de la multi-sélection', () => {
    const [a, b] = addTwo();
    useEditorStore.getState().select(a);
    useEditorStore.getState().toggleSelect(b);
    expect(useEditorStore.getState().selectedIds).toEqual([a, b]);
    expect(useEditorStore.getState().selectedId).toBe(b); // primaire = dernier
    useEditorStore.getState().toggleSelect(b);
    expect(useEditorStore.getState().selectedIds).toEqual([a]);
  });

  it('selectAll sélectionne tout sauf verrouillé/masqué', () => {
    const [a, b] = addTwo();
    useEditorStore.getState().toggleLock(b);
    useEditorStore.getState().selectAll();
    expect(useEditorStore.getState().selectedIds).toEqual([a]);
  });

  it('toggleLock verrouille et désélectionne la prop', () => {
    const [a] = addTwo();
    useEditorStore.getState().select(a);
    useEditorStore.getState().toggleLock(a);
    expect(useEditorStore.getState().template.props.find((p) => p.id === a)?.locked).toBe(true);
    expect(useEditorStore.getState().selectedIds).not.toContain(a);
  });

  it('toggleHide masque la prop', () => {
    const [a] = addTwo();
    useEditorStore.getState().toggleHide(a);
    expect(useEditorStore.getState().template.props.find((p) => p.id === a)?.hidden).toBe(true);
  });

  it('removeSelected supprime toute la sélection', () => {
    const [a, b] = addTwo();
    useEditorStore.getState().selectMany([a, b]);
    useEditorStore.getState().removeSelected();
    expect(useEditorStore.getState().template.props).toHaveLength(0);
    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });

  it('duplicateSelected duplique toute la sélection', () => {
    const [a, b] = addTwo();
    useEditorStore.getState().selectMany([a, b]);
    useEditorStore.getState().duplicateSelected();
    expect(useEditorStore.getState().template.props).toHaveLength(4);
    expect(useEditorStore.getState().selectedIds).toHaveLength(2);
  });

  it('nudgeSelected décale la sélection mais pas les props verrouillées', () => {
    const [a, b] = addTwo();
    useEditorStore.getState().toggleLock(b);
    useEditorStore.getState().selectMany([a, b]);
    useEditorStore.getState().nudgeSelected(1, 0);
    const props = useEditorStore.getState().template.props;
    expect(props.find((p) => p.id === a)?.position[0]).toBe(1);
    expect(props.find((p) => p.id === b)?.position[0]).toBe(4); // verrouillée
  });

  it('alignSelected aligne la sélection sur l’axe X', () => {
    const [a, b] = addTwo();
    useEditorStore.getState().selectMany([a, b]);
    useEditorStore.getState().alignSelected('x', 'min');
    const props = useEditorStore.getState().template.props;
    expect(props.find((p) => p.id === a)?.position[0]).toBe(0);
    expect(props.find((p) => p.id === b)?.position[0]).toBe(0);
  });

  it('resetTemplate vide les props et la sélection', () => {
    useEditorStore.getState().addProp('props/rock.glb', [0, 0, 0]);
    useEditorStore.getState().resetTemplate();
    expect(useEditorStore.getState().template.props).toHaveLength(0);
    expect(useEditorStore.getState().selectedId).toBeNull();
  });
});
