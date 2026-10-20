import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedUser, RequestWithUser } from './authenticated-user';

// Lê o usuário que o UserContextGuard já validou
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) throw new UnauthorizedException('Missing user context');
    return request.user;
  },
);
