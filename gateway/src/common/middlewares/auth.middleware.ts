import {
    Injectable, NestMiddleware,
    UnauthorizedException, ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { Request, Response, NextFunction } from 'express';

const PUBLIC_ROUTES = [
    { path: '/auth/login', method: 'POST' },
    { path: '/user', method: 'POST' },
];

@Injectable()
export class AuthMiddleware implements NestMiddleware {
    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) { }

    async use(req: Request, res: Response, next: NextFunction) {
        console.log(`[AuthMiddleware] ${req.method} ${req.url}`);
        const isPublic = PUBLIC_ROUTES.some(
            (route) => req.url === route.path && req.method === route.method,
        );

        if (isPublic) return next();

        const token = req.headers['token'] as string;
        if (!token) {
            res.status(401).json({ message: 'Token não fornecido' });
            return;
        }

        try {
            const authServer = this.configService.get<string>('AUTH_SERVER');

            const { data } = await firstValueFrom(
                this.httpService.post(
                    `${authServer}/auth/validaToken`,
                    {},
                    { headers: { token } },
                ),
            );

            // injeta o usuário na request
            (req as any).user = data;

            // repassa os dados do usuário para os serviços internos
            req.headers['x-user-id'] = data.id;
            req.headers['x-user-role'] = data.role;
            req.headers['x-user-email'] = data.email;
            next();

        } catch (err: any) {
            if (err.response?.status === 401) {
                res.status(401).json({ message: 'Token inválido' });
                return;
            }
            res.status(503).json({ message: 'Auth service indisponível' });
        }
    }
}