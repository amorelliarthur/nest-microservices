import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // lê do header repassado pelo gateway
    const role = request.headers['x-user-role'] as string;

    if (role !== 'ADMIN') {
      throw new ForbiddenException('Acesso restrito a administradores');
    }

    return true;
  }
}
