import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: { check: jest.Mock };

  beforeEach(async () => {
    service = { check: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: service }],
    }).compile();
    controller = module.get(HealthController);
  });

  it('getHealth délègue à HealthService.check()', async () => {
    service.check.mockResolvedValue({ status: 'ok' });
    expect(await controller.getHealth()).toEqual({ status: 'ok' });
  });

  it('propage l\'erreur si le service échoue', async () => {
    service.check.mockRejectedValue(new Error('fail'));
    await expect(controller.getHealth()).rejects.toThrow('fail');
  });
});
