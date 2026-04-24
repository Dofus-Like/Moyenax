import { Test, TestingModule } from '@nestjs/testing';
import { CombatActionType } from '@game/shared-types';
import { TurnController } from './turn.controller';
import { TurnService } from './turn.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('TurnController', () => {
  let controller: TurnController;
  let turn: { playAction: jest.Mock };

  beforeEach(async () => {
    turn = { playAction: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TurnController],
      providers: [{ provide: TurnService, useValue: turn }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TurnController);
  });

  it('délègue playAction avec sessionId, user.id et action', async () => {
    turn.playAction.mockResolvedValue({ ok: true });
    const action = { type: CombatActionType.MOVE, targetX: 2, targetY: 3 };
    const result = await controller.playAction('s-1', action, { user: { id: 'p1' } });
    expect(result).toEqual({ ok: true });
    expect(turn.playAction).toHaveBeenCalledWith('s-1', 'p1', action);
  });

  it('supporte une action END_TURN sans targetX/targetY', async () => {
    turn.playAction.mockResolvedValue({});
    await controller.playAction('s-1', { type: CombatActionType.END_TURN }, { user: { id: 'p1' } });
    expect(turn.playAction).toHaveBeenCalledWith(
      's-1',
      'p1',
      expect.objectContaining({ type: CombatActionType.END_TURN }),
    );
  });
});
