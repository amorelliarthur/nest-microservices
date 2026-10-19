import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestWithUser } from './authenticated-user';

// O gateway valida o token e injeta x-user-*; este serviço só aceita requisições com esse contexto
@Injectable()
export class UserContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const id = request.headers['x-user-id'];
    const role = request.headers['x-user-role'];

    if (typeof id !== 'string' || id.trim() === '') {
      throw new UnauthorizedException('Missing user context');
    }

    request.user = { id, role: typeof role === 'string' ? role : 'USER' };
    return true;
  }
}
