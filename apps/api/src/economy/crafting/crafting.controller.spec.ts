import { Test, TestingModule } from '@nestjs/testing';
import { CraftingController } from './crafting.controller';
import { CraftingService } from './crafting.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('CraftingController', () => {
  let controller: CraftingController;
  let service: { getRecipes: jest.Mock; craft: jest.Mock; merge: jest.Mock };

  beforeEach(async () => {
    service = {
      getRecipes: jest.fn().mockResolvedValue([]),
      craft: jest.fn().mockResolvedValue({ ok: true }),
      merge: jest.fn().mockResolvedValue({ ok: true }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CraftingController],
      providers: [{ provide: CraftingService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(CraftingController);
  });

  it('GET /crafting/recipes', async () => {
    expect(await controller.getRecipes()).toEqual([]);
  });

  it('POST /crafting/craft', async () => {
    await controller.craft('item-1', { user: { id: 'p1' } });
    expect(service.craft).toHaveBeenCalledWith('p1', 'item-1');
  });

  it('POST /crafting/merge', async () => {
    await controller.merge('item-1', 2, { user: { id: 'p1' } });
    expect(service.merge).toHaveBeenCalledWith('p1', 'item-1', 2);
  });
});
