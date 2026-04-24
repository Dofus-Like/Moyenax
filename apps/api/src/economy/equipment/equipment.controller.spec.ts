import { Test, TestingModule } from '@nestjs/testing';
import { EquipmentSlotType } from '@game/shared-types';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('EquipmentController', () => {
  let controller: EquipmentController;
  let service: { getEquipment: jest.Mock; equip: jest.Mock; unequip: jest.Mock };

  beforeEach(async () => {
    service = {
      getEquipment: jest.fn().mockResolvedValue({}),
      equip: jest.fn().mockResolvedValue({}),
      unequip: jest.fn().mockResolvedValue({}),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EquipmentController],
      providers: [{ provide: EquipmentService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(EquipmentController);
  });

  it('GET /equipment', async () => {
    await controller.getEquipment({ user: { id: 'p1' } });
    expect(service.getEquipment).toHaveBeenCalledWith('p1');
  });

  it('PUT /equipment/:slot', async () => {
    await controller.equip(
      { user: { id: 'p1' } },
      EquipmentSlotType.WEAPON_LEFT,
      'inv-1',
    );
    expect(service.equip).toHaveBeenCalledWith('p1', 'inv-1', EquipmentSlotType.WEAPON_LEFT);
  });

  it('DELETE /equipment/:slot', async () => {
    await controller.unequip({ user: { id: 'p1' } }, EquipmentSlotType.ARMOR_HEAD);
    expect(service.unequip).toHaveBeenCalledWith('p1', EquipmentSlotType.ARMOR_HEAD);
  });
});
