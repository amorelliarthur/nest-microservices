import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { InternalTokenVerifier } from './internal-token.verifier';

// Header em que o auth se identifica ao chamar o user-service
export const SERVICE_TOKEN_HEADER = 'x-service-token';

// Só deixa passar chamadas feitas pelo próprio auth. Um token interno de
// usuário, mesmo de ADMIN, não serve aqui. Responde 403 (e não 401) para o
// auth distinguir "não reconheci o serviço" de "senha errada", sem expor o motivo.
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(private readonly verifier: InternalTokenVerifier) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!this.verifier.isAuthService(request.headers[SERVICE_TOKEN_HEADER])) {
      throw new ForbiddenException();
    }

    return true;
  }
}
