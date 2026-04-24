import { Test, TestingModule } from '@nestjs/testing';
import { FarmingController } from './farming.controller';
import { FarmingService } from './farming.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('FarmingController', () => {
  let controller: FarmingController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      getOrCreateInstance: jest.fn().mockResolvedValue({}),
      gatherResource: jest.fn().mockResolvedValue({}),
      endFarmingPhase: jest.fn().mockResolvedValue({}),
      debugRefillPips: jest.fn().mockResolvedValue({}),
      nextRound: jest.fn().mockResolvedValue({}),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FarmingController],
      providers: [{ provide: FarmingService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(FarmingController);
  });

  it('GET /farming/state', async () => {
    await controller.getState({ user: { id: 'p1' } }, 'NATURE');
    expect(service['getOrCreateInstance']).toHaveBeenCalledWith('p1', 'NATURE');
  });

  it('GET /farming/state sans seed passe undefined', async () => {
    await controller.getState({ user: { id: 'p1' } });
    expect(service['getOrCreateInstance']).toHaveBeenCalledWith('p1', undefined);
  });

  it('POST /farming/gather', async () => {
    await controller.gather(
      { user: { id: 'p1' } },
      { targetX: 1, targetY: 2, playerX: 0, playerY: 0 },
    );
    expect(service['gatherResource']).toHaveBeenCalledWith('p1', 1, 2, 0, 0);
  });

  it('POST /farming/end-farming-phase', async () => {
    await controller.endFarmingPhase({ user: { id: 'p1' } });
    expect(service['endFarmingPhase']).toHaveBeenCalledWith('p1');
  });

  it('POST /farming/next-round', async () => {
    await controller.nextRound({ user: { id: 'p1' } });
    expect(service['nextRound']).toHaveBeenCalledWith('p1');
  });

  it('POST /farming/debug-refill', async () => {
    await controller.debugRefillPips({ user: { id: 'p1' } });
    expect(service['debugRefillPips']).toHaveBeenCalledWith('p1');
  });
});
