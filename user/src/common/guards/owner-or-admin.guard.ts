import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import type { RequestWithRequester } from '../auth/internal-token.guard';

// Usar sempre depois do InternalTokenGuard, que grava o requester na requisição
@Injectable()
export class OwnerOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithRequester>();
    const requester = request.requester;

    // Admin passa direto, dono do recurso também
    if (
      requester &&
      (requester.role === 'ADMIN' || requester.id === request.params.id)
    ) {
      return true;
    }

    throw new ForbiddenException('Acesso negado');
  }
}
