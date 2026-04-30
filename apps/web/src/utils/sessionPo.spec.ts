import { describe, it, expect } from 'vitest';

import { getSessionPo } from './sessionPo';

describe('getSessionPo', () => {
  it('retourne null si session est null', () => {
    expect(getSessionPo(null, 'p1')).toBeNull();
  });

  it('retourne null si playerId est undefined', () => {
    expect(
      getSessionPo(
        { player1Id: 'p1', player2Id: 'p2', player1Po: 100, player2Po: 200 },
        undefined,
      ),
    ).toBeNull();
  });

  it('retourne player1Po si playerId = player1', () => {
    expect(
      getSessionPo(
        { player1Id: 'p1', player2Id: 'p2', player1Po: 100, player2Po: 200 },
        'p1',
      ),
    ).toBe(100);
  });

  it('retourne player2Po si playerId = player2', () => {
    expect(
      getSessionPo(
        { player1Id: 'p1', player2Id: 'p2', player1Po: 100, player2Po: 200 },
        'p2',
      ),
    ).toBe(200);
  });

  it('retourne null si playerId ne matche ni p1 ni p2', () => {
    expect(
      getSessionPo(
        { player1Id: 'p1', player2Id: 'p2', player1Po: 100, player2Po: 200 },
        'other',
      ),
    ).toBeNull();
  });

  it('gère player2Id=null', () => {
    expect(
      getSessionPo({ player1Id: 'p1', player2Id: null, player1Po: 50, player2Po: 0 }, 'p1'),
    ).toBe(50);
    expect(
      getSessionPo({ player1Id: 'p1', player2Id: null, player1Po: 50, player2Po: 0 }, 'p2'),
    ).toBeNull();
  });

  it('coerce null/undefined de po en 0', () => {
    expect(
      getSessionPo(
        {
          player1Id: 'p1',
          player2Id: 'p2',
          player1Po: null as unknown as number,
          player2Po: 42,
        },
        'p1',
      ),
    ).toBe(0);
  });
});
