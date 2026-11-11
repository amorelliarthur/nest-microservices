import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestWithUser } from './authenticated-user';
import { InternalTokenVerifier } from './internal-token.verifier';

// Header where the gateway (and internal services) forward the auth-issued token
export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

// Only requests with a valid internal token get through. The identity comes from
// the token; x-user-* headers are never read. The token is kept so it can be
// forwarded to the financial service on behalf of the same user.
@Injectable()
export class UserContextGuard implements CanActivate {
  constructor(private readonly verifier: InternalTokenVerifier) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = request.headers[INTERNAL_TOKEN_HEADER];
    const identity = this.verifier.verify(token);

    if (!identity || typeof token !== 'string') {
      throw new UnauthorizedException('Missing user context');
    }

    request.user = { ...identity, internalToken: token };
    return true;
  }
}
