import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class OwnerOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const id = request.params.id;

    // lê do header repassado pelo gateway
    const userId = request.headers['x-user-id'];
    const role = request.headers['x-user-role'];

    // Admin passa direto, dono do recurso também
    if (role === 'ADMIN' || userId === id) {
      return true;
    }

    throw new ForbiddenException('Acesso negado');
  }
}
