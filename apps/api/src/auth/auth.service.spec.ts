import { describe, expect, it } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('registers a new user without leaking the password', () => {
    const service = new AuthService();
    const user = service.register({ username: 'merito', password: 'secret', name: 'Merito' });
    expect(user).toMatchObject({ username: 'merito', name: 'Merito' });
    expect(user).not.toHaveProperty('password');
  });

  it('rejects registering a duplicate username', () => {
    const service = new AuthService();
    service.register({ username: 'merito', password: 'secret', name: 'Merito' });
    expect(() =>
      service.register({ username: 'merito', password: 'other', name: 'Merito2' }),
    ).toThrow(ConflictException);
  });

  it('logs in with matching credentials', () => {
    const service = new AuthService();
    service.register({ username: 'merito', password: 'secret', name: 'Merito' });
    const user = service.login({ username: 'merito', password: 'secret' });
    expect(user.username).toBe('merito');
  });

  it('rejects login with wrong credentials', () => {
    const service = new AuthService();
    service.register({ username: 'merito', password: 'secret', name: 'Merito' });
    expect(() => service.login({ username: 'merito', password: 'wrong' })).toThrow(
      UnauthorizedException,
    );
  });
});
