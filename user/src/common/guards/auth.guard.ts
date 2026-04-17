import {
    CanActivate, ExecutionContext, Injectable,
    UnauthorizedException, ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = request.headers['token'];

        if (!token) throw new UnauthorizedException('Token não fornecido');

        try {
            const authServer = this.configService.get<string>('AUTH_SERVER');

            // Chama o auth-service para validar o token
            const { data } = await firstValueFrom(
                this.httpService.post(
                    `http://${authServer}/validaToken`,
                    {},
                    { headers: { token } },
                ),
            );

            // Injeta os dados do usuário na request para uso nos controllers
            request.user = data;
            return true;

        } catch (err: any) {
            if (err.response?.status === 401) {
                throw new UnauthorizedException('Token inválido');
            }
            throw new ServiceUnavailableException('Auth service indisponível');
        }
    }
}