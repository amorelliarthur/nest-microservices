import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestWithRequester } from './internal-token.guard';
import type { Requester } from './requester';

// Lê a identidade gravada pelo InternalTokenGuard. Sem o guard na rota,
// não há identidade e a requisição é recusada.
export const CurrentRequester = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Requester => {
    const request = context.switchToHttp().getRequest<RequestWithRequester>();

    if (!request.requester) {
      throw new UnauthorizedException('Usuário não identificado');
    }
    return request.requester;
  },
);
