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
import { InternalTokenIssuer } from '../internal-token/internal-token.issuer';

// formato retornado pelo user-service em /user/authenticate
interface AuthenticatedUser {
  _id: string;
  email: string;
  role: string;
}

// payload assinado/decodificado pelo JwtService
export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  exp: number;
}

// resposta da rota interna: só a identidade e o token interno
export interface GatewayValidation {
  id: string;
  role: string;
  email: string;
  internalToken: string;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value !== '';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly internalTokenIssuer: InternalTokenIssuer,
  ) {}

  async login(dto: LoginDto) {
    const userServer = this.configService.get<string>('USER_SERVER');

    try {
      // Chama o user-service para autenticar
      const { data: user } = await firstValueFrom(
        this.httpService.post<AuthenticatedUser>(
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
    } catch (err: unknown) {
      const error = err as { response?: unknown };

      // Erro vindo do user-service (ex: senha inválida, não encontrado)
      if (error.response) {
        throw new UnauthorizedException('Email ou senha inválidos');
      }

      // User-service fora do ar
      throw new ServiceUnavailableException('User service indisponível');
    }
  }

  // rota pública: não emite o token interno
  async validaToken(token: string): Promise<JwtPayload> {
    return this.verifyClientToken(token);
  }

  // rota interna, só para o gateway (protegida pelo segredo compartilhado)
  async validateForGateway(token: string): Promise<GatewayValidation> {
    const { id, role, email } = await this.verifyClientToken(token);

    if (
      !isNonEmptyString(id) ||
      !isNonEmptyString(role) ||
      !isNonEmptyString(email)
    ) {
      throw new UnauthorizedException('Token inválido');
    }

    // fora de qualquer try: uma falha ao emitir não pode virar "Token inválido"
    const internalToken = this.internalTokenIssuer.issue({ id, role, email });

    return { id, role, email, internalToken };
  }

  private async verifyClientToken(token: string): Promise<JwtPayload> {
    if (!token) {
      throw new UnauthorizedException('Token não fornecido');
    }

    // verifica blacklist antes de validar assinatura
    const blacklisted = await this.redisService.isBlacklisted(token);
    if (blacklisted) {
      throw new UnauthorizedException('Token inválido');
    }

    try {
      return this.jwtService.verify<JwtPayload>(token);
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
      const decoded = this.jwtService.verify<JwtPayload>(token);
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
