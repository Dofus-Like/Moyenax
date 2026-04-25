import { Test, TestingModule } from '@nestjs/testing';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('ShopController', () => {
  let controller: ShopController;
  let service: {
    getAvailableItems: jest.Mock;
    buy: jest.Mock;
    sell: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getAvailableItems: jest.fn().mockResolvedValue([]),
      buy: jest.fn().mockResolvedValue({ id: 'ok' }),
      sell: jest.fn().mockResolvedValue({ goldEarned: 50 }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShopController],
      providers: [{ provide: ShopService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(ShopController);
  });

  it('GET /shop/items liste items', async () => {
    service.getAvailableItems.mockResolvedValue([{ id: 'x' }]);
    expect(await controller.getAvailableItems()).toEqual([{ id: 'x' }]);
  });

  it('POST /shop/buy délègue avec itemId/quantity', async () => {
    await controller.buy({ itemId: 'i', quantity: 3 }, { user: { id: 'p1' } });
    expect(service.buy).toHaveBeenCalledWith('p1', 'i', 3);
  });

  it('POST /shop/sell délègue avec inventoryItemId/quantity', async () => {
    await controller.sell(
      { inventoryItemId: 'inv-1', quantity: 2 },
      { user: { id: 'p1' } },
    );
    expect(service.sell).toHaveBeenCalledWith('p1', 'inv-1', 2);
  });
});
