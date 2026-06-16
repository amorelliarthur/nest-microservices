import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class OwnerOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const id = request.params.id;

    // lê do header repassado pelo gateway
    const userId = request.headers['x-user-id'] as string;
    const role = request.headers['x-user-role'] as string;

    // Admin passa direto, dono do recurso também
    if (role === 'ADMIN' || userId === id) {
      return true;
    }

    throw new ForbiddenException('Acesso negado');
  }
}
