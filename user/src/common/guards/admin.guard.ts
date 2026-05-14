import {
    CanActivate, ExecutionContext, Injectable, ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();

        // lê do header repassado pelo gateway
        const role = request.headers['x-user-role'];

        if (role !== 'ADMIN') {
            throw new ForbiddenException('Acesso restrito a administradores');
        }

        return true;
    }
}