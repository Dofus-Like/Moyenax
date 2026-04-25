import { Test, TestingModule } from '@nestjs/testing';
import { MapController } from './map.controller';
import { MapGeneratorService } from './map-generator.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('MapController', () => {
  let controller: MapController;
  let service: { getOrCreateMap: jest.Mock; resetMap: jest.Mock };

  beforeEach(async () => {
    service = {
      getOrCreateMap: jest.fn().mockResolvedValue({ grid: [] }),
      resetMap: jest.fn().mockResolvedValue({ grid: [] }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MapController],
      providers: [{ provide: MapGeneratorService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(MapController);
  });

  it('GET /map retourne la map active', async () => {
    await controller.getMap();
    expect(service.getOrCreateMap).toHaveBeenCalled();
  });

  it('POST /map/reset avec seed valide passe le seed', async () => {
    await controller.resetMap('NATURE');
    expect(service.resetMap).toHaveBeenCalledWith('NATURE');
  });

  it('POST /map/reset avec seed invalide passe undefined', async () => {
    await controller.resetMap('INVALID_SEED');
    expect(service.resetMap).toHaveBeenCalledWith(undefined);
  });

  it('POST /map/reset sans seed passe undefined', async () => {
    await controller.resetMap();
    expect(service.resetMap).toHaveBeenCalledWith(undefined);
  });
});
