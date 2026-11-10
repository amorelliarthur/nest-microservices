import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  GATEWAY_SECRET_VERIFIER,
  type GatewaySecretVerifier,
} from './gateway-secret';

export const GATEWAY_SECRET_HEADER = 'x-gateway-secret';

// Só o gateway, que conhece o segredo, pode chamar as rotas internas do auth.
// Responde 403 (e não 401) para o gateway distinguir um segredo que não
// confere (erro de configuração) de um token de cliente inválido.
@Injectable()
export class GatewaySecretGuard implements CanActivate {
  constructor(
    @Inject(GATEWAY_SECRET_VERIFIER)
    private readonly verify: GatewaySecretVerifier,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (!this.verify(req.headers[GATEWAY_SECRET_HEADER])) {
      throw new ForbiddenException();
    }
    return true;
  }
}
