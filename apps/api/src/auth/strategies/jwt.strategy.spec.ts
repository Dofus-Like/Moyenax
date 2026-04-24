import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('throw si JWT_SECRET manquant', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    expect(() => new JwtStrategy(config)).toThrow('JWT_SECRET manquant');
  });

  it('construit la stratégie si le secret est présent', () => {
    const config = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;
    const strategy = new JwtStrategy(config);
    expect(strategy).toBeDefined();
  });

  it('validate retourne le mapping {id, username, email} depuis le payload', () => {
    const config = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;
    const strategy = new JwtStrategy(config);

    const result = strategy.validate({
      sub: 'user-123',
      username: 'alice',
      email: 'alice@example.com',
    });

    expect(result).toEqual({
      id: 'user-123',
      username: 'alice',
      email: 'alice@example.com',
    });
  });
});
