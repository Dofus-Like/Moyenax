import { Test, TestingModule } from '@nestjs/testing';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

describe('ItemsController', () => {
  let controller: ItemsController;
  let service: { findAll: jest.Mock; findById: jest.Mock };

  beforeEach(async () => {
    service = { findAll: jest.fn(), findById: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ItemsController],
      providers: [{ provide: ItemsService, useValue: service }],
    }).compile();
    controller = module.get(ItemsController);
  });

  it('GET /items liste tous les items', async () => {
    service.findAll.mockResolvedValue([{ id: 'a' }]);
    expect(await controller.findAll()).toEqual([{ id: 'a' }]);
  });

  it('GET /items/:id retourne l\'item', async () => {
    service.findById.mockResolvedValue({ id: 'x' });
    expect(await controller.findById('x')).toEqual({ id: 'x' });
    expect(service.findById).toHaveBeenCalledWith('x');
  });
});
