import { describe, expect, it } from 'vitest';

import { deriveActivePoiList, derivePoiStateLabels } from './poiState';

describe('derivePoiStateLabels', () => {
  it('returns no labels in the idle case', () => {
    expect(
      derivePoiStateLabels({ isInQueue: false, isWaitingPrivateSession: false, hasOpenSession: false }),
    ).toEqual({});
  });

  it('marks combat as "Recherche…" while in queue', () => {
    const labels = derivePoiStateLabels({
      isInQueue: true,
      isWaitingPrivateSession: false,
      hasOpenSession: false,
    });
    expect(labels.combat).toBe('Recherche…');
  });

  it('marks rooms as "En attente…" while a private room is waiting', () => {
    const labels = derivePoiStateLabels({
      isInQueue: false,
      isWaitingPrivateSession: true,
      hasOpenSession: true,
    });
    expect(labels.rooms).toBe('En attente…');
  });

  it('marks vs-ai as "Reprendre" when an open session exists outside a waiting private room', () => {
    const labels = derivePoiStateLabels({
      isInQueue: false,
      isWaitingPrivateSession: false,
      hasOpenSession: true,
    });
    expect(labels['vs-ai']).toBe('Reprendre');
  });

  it('does not surface "Reprendre" for the user’s own waiting room', () => {
    const labels = derivePoiStateLabels({
      isInQueue: false,
      isWaitingPrivateSession: true,
      hasOpenSession: true,
    });
    expect(labels['vs-ai']).toBeUndefined();
  });
});

describe('deriveActivePoiList', () => {
  it('returns an empty list at idle', () => {
    expect(deriveActivePoiList({ isInQueue: false, isWaitingPrivateSession: false })).toEqual([]);
  });

  it('flags combat as active while in queue', () => {
    expect(deriveActivePoiList({ isInQueue: true, isWaitingPrivateSession: false })).toEqual(['combat']);
  });

  it('flags rooms as active while a private room is waiting', () => {
    expect(deriveActivePoiList({ isInQueue: false, isWaitingPrivateSession: true })).toEqual(['rooms']);
  });

  it('can flag both at once', () => {
    expect(deriveActivePoiList({ isInQueue: true, isWaitingPrivateSession: true })).toEqual([
      'combat',
      'rooms',
    ]);
  });
});
