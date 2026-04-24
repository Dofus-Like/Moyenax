import { Test, TestingModule } from '@nestjs/testing';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('ResourcesController', () => {
  let controller: ResourcesController;
  let service: { findAll: jest.Mock; gather: jest.Mock };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      gather: jest.fn().mockResolvedValue({}),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResourcesController],
      providers: [{ provide: ResourcesService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(ResourcesController);
  });

  it('GET /map/resources liste les ressources', async () => {
    service.findAll.mockResolvedValue([{ id: 'wood' }]);
    expect(await controller.findAll()).toEqual([{ id: 'wood' }]);
  });

  it('POST /map/resources/:id/gather récolte la ressource', async () => {
    await controller.gather('wood', { user: { id: 'p1' } });
    expect(service.gather).toHaveBeenCalledWith('wood', 'p1');
  });
});
