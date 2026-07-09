import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@mold-tracker/shared';
import { RolesGuard } from './guards';

function ctx(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function reflectorReturning(roles: Role[] | undefined): Reflector {
  return { getAllAndOverride: () => roles } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('tolak role yang tidak diizinkan (jadi 403)', () => {
    const guard = new RolesGuard(reflectorReturning([Role.ADMIN]));
    expect(guard.canActivate(ctx({ role: Role.OPERATOR }))).toBe(false);
  });

  it('izinkan role yang cocok', () => {
    const guard = new RolesGuard(reflectorReturning([Role.ADMIN]));
    expect(guard.canActivate(ctx({ role: Role.ADMIN }))).toBe(true);
  });

  it('izinkan bila endpoint tidak menandai @Roles', () => {
    const guard = new RolesGuard(reflectorReturning(undefined));
    expect(guard.canActivate(ctx({ role: Role.OPERATOR }))).toBe(true);
  });
});
