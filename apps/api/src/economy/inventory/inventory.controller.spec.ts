import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: { findByPlayer: jest.Mock };

  beforeEach(async () => {
    service = { findByPlayer: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: InventoryService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(InventoryController);
  });

  it('GET /inventory utilise req.user.id', async () => {
    service.findByPlayer.mockResolvedValue([{ id: 'i1' }]);
    const r = await controller.findAll({ user: { id: 'p1' } });
    expect(r).toEqual([{ id: 'i1' }]);
    expect(service.findByPlayer).toHaveBeenCalledWith('p1');
  });
});
