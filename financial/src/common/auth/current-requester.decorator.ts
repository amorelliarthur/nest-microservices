import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Requester } from './requester';

export const CurrentRequester = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Requester => {
    const request = context.switchToHttp().getRequest<Request>();
    const id = request.headers['x-user-id'];
    const role = request.headers['x-user-role'];

    if (typeof id !== 'string' || id.trim() === '') {
      throw new UnauthorizedException('Usuário não identificado');
    }
    return { id, role: typeof role === 'string' ? role : 'USER' };
  },
);
