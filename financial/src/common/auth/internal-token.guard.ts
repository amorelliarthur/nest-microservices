import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { InternalTokenVerifier } from './internal-token.verifier';
import type { Requester } from './requester';

// Header em que o gateway (e serviços internos) repassam o token do auth
export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

export type RequestWithRequester = Request & { requester?: Requester };

// Só deixa passar requisições com um token interno válido e grava a
// identidade dele na requisição. Os headers x-user-* nunca são lidos.
@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly verifier: InternalTokenVerifier) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithRequester>();
    const requester = this.verifier.verify(
      request.headers[INTERNAL_TOKEN_HEADER],
    );

    if (!requester) {
      throw new UnauthorizedException('Usuário não identificado');
    }

    request.requester = requester;
    return true;
  }
}
