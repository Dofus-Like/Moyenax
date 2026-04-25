import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let auth: {
    register: jest.Mock;
    login: jest.Mock;
    validateUser: jest.Mock;
    updateSkin: jest.Mock;
  };

  beforeEach(async () => {
    auth = {
      register: jest.fn(),
      login: jest.fn(),
      validateUser: jest.fn(),
      updateSkin: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AuthController);
  });

  it('register délègue à authService', async () => {
    auth.register.mockResolvedValue({ accessToken: 't' });
    const r = await controller.register({
      email: 'a@b.com',
      username: 'a',
      password: 'pw12345678',
    });
    expect(r).toEqual({ accessToken: 't' });
    expect(auth.register).toHaveBeenCalledWith({
      email: 'a@b.com',
      username: 'a',
      password: 'pw12345678',
    });
  });

  it('login délègue à authService', async () => {
    auth.login.mockResolvedValue({ accessToken: 't' });
    const r = await controller.login({ email: 'a@b.com', password: 'pw12345678' });
    expect(r).toEqual({ accessToken: 't' });
  });

  it('me utilise req.user.id pour récupérer le joueur', async () => {
    auth.validateUser.mockResolvedValue({ id: 'p1' });
    const r = await controller.me({ user: { id: 'p1' } });
    expect(r).toEqual({ id: 'p1' });
    expect(auth.validateUser).toHaveBeenCalledWith('p1');
  });

  it('updateSkin utilise req.user.id et le skin du DTO', async () => {
    auth.updateSkin.mockResolvedValue({ skin: 'mage' });
    const r = await controller.updateSkin({ user: { id: 'p1' } }, { skin: 'mage' });
    expect(r).toEqual({ skin: 'mage' });
    expect(auth.updateSkin).toHaveBeenCalledWith('p1', 'mage');
  });
});
