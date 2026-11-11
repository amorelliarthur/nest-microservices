import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { RequestWithUser } from './authenticated-user';
import { InternalTokenVerifier } from './internal-token.verifier';
import { createInternalTokenTestKit } from './testing/internal-token.testing';
import { UserContextGuard } from './user-context.guard';

const contextFor = (headers: Record<string, string>) => {
  const request = { headers } as unknown as RequestWithUser;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { request, context };
};

describe('UserContextGuard', () => {
  const kit = createInternalTokenTestKit();
  const guard = new UserContextGuard(new InternalTokenVerifier(kit.publicKey));

  it('stores the identity and the token itself from a valid internal token', () => {
    const token = kit.issue('user-1', 'ADMIN');
    const { request, context } = contextFor({ 'x-internal-token': token });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual({
      id: 'user-1',
      role: 'ADMIN',
      internalToken: token,
    });
  });

  it('ignores x-user-* headers and trusts only the token', () => {
    const token = kit.issue('user-1');
    const { request, context } = contextFor({
      'x-internal-token': token,
      'x-user-id': 'user-2',
      'x-user-role': 'ADMIN',
    });

    guard.canActivate(context);

    expect(request.user).toEqual({
      id: 'user-1',
      role: 'USER',
      internalToken: token,
    });
  });

  it('rejects a request that only has x-user-* headers', () => {
    const { request, context } = contextFor({
      'x-user-id': 'user-1',
      'x-user-role': 'ADMIN',
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });

  it('rejects a token signed by someone else', () => {
    const forged = createInternalTokenTestKit().issue('user-1', 'ADMIN');
    const { request, context } = contextFor({ 'x-internal-token': forged });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });
});
