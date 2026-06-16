import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import { firstValueFrom } from 'rxjs';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async login(dto: LoginDto) {
    const userServer = this.configService.get<string>('USER_SERVER');

    try {
      // Chama o user-service para autenticar
      const { data: user } = await firstValueFrom(
        this.httpService.post(
          `http://${userServer}/user/authenticate`,
          { email: dto.email, senha: dto.senha },
          { timeout: 5000 },
        ),
      );

      // Gera o token
      const token = this.jwtService.sign({
        id: user._id,
        email: user.email,
        role: user.role,
      });

      return { user: user.email, token };
    } catch (err: any) {
      // Erro vindo do user-service (ex: senha inválida, não encontrado)
      if (err.response) {
        throw new UnauthorizedException('Email ou senha inválidos');
      }

      // User-service fora do ar
      throw new ServiceUnavailableException('User service indisponível');
    }
  }

  async validaToken(token: string) {
    if (!token) {
      throw new UnauthorizedException('Token não fornecido');
    }

    // verifica blacklist antes de validar assinatura
    const blacklisted = await this.redisService.isBlacklisted(token);
    if (blacklisted) {
      throw new UnauthorizedException('Token inválido');
    }

    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }

  async logout(token: string): Promise<void> {
    if (!token) {
      throw new UnauthorizedException('Token não fornecido');
    }

    try {
      // decodifica para pegar o tempo restante de expiração
      const decoded = this.jwtService.verify(token);
      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - now;

      // só adiciona na blacklist se o token ainda não expirou
      if (ttl > 0) {
        await this.redisService.blacklist(token, ttl);
      }
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
