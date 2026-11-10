import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  GATEWAY_SECRET_VERIFIER,
  type GatewaySecretVerifier,
} from './gateway-secret';

export const GATEWAY_SECRET_HEADER = 'x-gateway-secret';

// Só o gateway, que conhece o segredo, pode chamar as rotas internas do auth.
@Injectable()
export class GatewaySecretGuard implements CanActivate {
  constructor(
    @Inject(GATEWAY_SECRET_VERIFIER)
    private readonly verify: GatewaySecretVerifier,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (!this.verify(req.headers[GATEWAY_SECRET_HEADER])) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
