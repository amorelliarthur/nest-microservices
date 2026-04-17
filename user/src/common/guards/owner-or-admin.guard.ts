import {
    CanActivate, ExecutionContext, Injectable, ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class OwnerOrAdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const id = request.params.id;

        // Admin passa direto, dono do recurso também
        if (user?.role === 'ADMIN' || user?.id === id) {
            return true;
        }

        throw new ForbiddenException('Acesso negado');
    }
}