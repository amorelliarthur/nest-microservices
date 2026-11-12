import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { RedisService } from '../common/redis/redis.service';
import { InternalTokenIssuer } from '../internal-token/internal-token.issuer';
import { ServiceTokenIssuer } from '../internal-token/service-token.issuer';

describe('AuthService', () => {
  let service: AuthService;

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockRedisService = {
    isBlacklisted: jest.fn(),
    blacklist: jest.fn(),
  };

  const mockInternalTokenIssuer = {
    issue: jest.fn(),
  };

  const mockServiceTokenIssuer = {
    issue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: InternalTokenIssuer, useValue: mockInternalTokenIssuer },
        { provide: ServiceTokenIssuer, useValue: mockServiceTokenIssuer },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.resetAllMocks());

  describe('login()', () => {
    it('deve retornar token e email quando credenciais são válidas', async () => {
      const dto = { email: 'user@test.com', senha: 'senha123' };
      const user = { _id: 'user-1', email: 'user@test.com', role: 'user' };

      mockConfigService.get.mockReturnValue('localhost:3000');
      mockHttpService.post.mockReturnValue(of({ data: user }));
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login(dto);

      expect(result).toEqual({ user: 'user@test.com', token: 'jwt-token' });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        id: user._id,
        email: user.email,
        role: user.role,
      });
    });

    it('deve se identificar ao user-service com o token de serviço', async () => {
      const dto = { email: 'user@test.com', senha: 'senha123' };
      const user = { _id: 'user-1', email: 'user@test.com', role: 'user' };

      mockConfigService.get.mockReturnValue('localhost:3000');
      mockServiceTokenIssuer.issue.mockReturnValue('service-token');
      mockHttpService.post.mockReturnValue(of({ data: user }));
      mockJwtService.sign.mockReturnValue('jwt-token');

      await service.login(dto);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:3000/user/authenticate',
        { email: dto.email, senha: dto.senha },
        {
          headers: { 'x-service-token': 'service-token' },
          timeout: 5000,
        },
      );
    });

    it('deve lançar UnauthorizedException quando user-service retorna erro', async () => {
      const dto = { email: 'user@test.com', senha: 'errada' };

      mockConfigService.get.mockReturnValue('localhost:3000');
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 401, data: 'Unauthorized' } })),
      );

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow(
        'Email ou senha inválidos',
      );
    });

    it('deve lançar ServiceUnavailableException quando user-service está fora do ar', async () => {
      const dto = { email: 'user@test.com', senha: 'senha123' };

      mockConfigService.get.mockReturnValue('localhost:3000');
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('ECONNREFUSED')),
      );

      await expect(service.login(dto)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(service.login(dto)).rejects.toThrow(
        'User service indisponível',
      );
    });
  });

  describe('validaToken()', () => {
    it('deve retornar o payload decodificado quando token é válido', async () => {
      const token = 'valid-token';
      const payload = { id: 'user-1', email: 'user@test.com', role: 'user' };

      mockRedisService.isBlacklisted.mockResolvedValue(false);
      mockJwtService.verify.mockReturnValue(payload);

      const result = await service.validaToken(token);

      expect(result).toEqual(payload);
      expect(mockRedisService.isBlacklisted).toHaveBeenCalledWith(token);
      expect(mockJwtService.verify).toHaveBeenCalledWith(token);
    });

    it('não deve emitir nem devolver o token interno na validação pública', async () => {
      const token = 'valid-token';
      const payload = { id: 'user-1', email: 'user@test.com', role: 'user' };

      mockRedisService.isBlacklisted.mockResolvedValue(false);
      mockJwtService.verify.mockReturnValue(payload);
      mockInternalTokenIssuer.issue.mockReturnValue('internal-token');

      const result = await service.validaToken(token);

      expect(result).not.toHaveProperty('internalToken');
      expect(mockInternalTokenIssuer.issue).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException quando token não é fornecido', async () => {
      await expect(service.validaToken('')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validaToken('')).rejects.toThrow(
        'Token não fornecido',
      );
      expect(mockRedisService.isBlacklisted).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException quando token está na blacklist', async () => {
      const token = 'blacklisted-token';

      mockRedisService.isBlacklisted.mockResolvedValue(true);

      await expect(service.validaToken(token)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validaToken(token)).rejects.toThrow(
        'Token inválido',
      );
      expect(mockJwtService.verify).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException quando token é inválido', async () => {
      const token = 'tampered-token';

      mockRedisService.isBlacklisted.mockResolvedValue(false);
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.validaToken(token)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validaToken(token)).rejects.toThrow(
        'Token inválido',
      );
    });
  });

  describe('validateForGateway()', () => {
    it('deve devolver só a identidade e o token interno quando token é válido', async () => {
      const token = 'valid-token';
      const payload = {
        id: 'user-1',
        email: 'user@test.com',
        role: 'user',
        iat: 1700000000,
        exp: 1700086400,
      };

      mockRedisService.isBlacklisted.mockResolvedValue(false);
      mockJwtService.verify.mockReturnValue(payload);
      mockInternalTokenIssuer.issue.mockReturnValue('internal-token');

      const result = await service.validateForGateway(token);

      // sem iat/exp do token do cliente
      expect(result).toEqual({
        id: 'user-1',
        role: 'user',
        email: 'user@test.com',
        internalToken: 'internal-token',
      });
      expect(mockRedisService.isBlacklisted).toHaveBeenCalledWith(token);
      expect(mockInternalTokenIssuer.issue).toHaveBeenCalledWith({
        id: 'user-1',
        role: 'user',
        email: 'user@test.com',
      });
    });

    it('deve lançar UnauthorizedException sem emitir quando token não é fornecido', async () => {
      await expect(service.validateForGateway('')).rejects.toThrow(
        'Token não fornecido',
      );
      expect(mockInternalTokenIssuer.issue).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException sem emitir quando token está na blacklist', async () => {
      mockRedisService.isBlacklisted.mockResolvedValue(true);

      await expect(
        service.validateForGateway('blacklisted-token'),
      ).rejects.toThrow(new UnauthorizedException('Token inválido'));
      expect(mockInternalTokenIssuer.issue).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException sem emitir quando token é inválido', async () => {
      mockRedisService.isBlacklisted.mockResolvedValue(false);
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(
        service.validateForGateway('tampered-token'),
      ).rejects.toThrow(new UnauthorizedException('Token inválido'));
      expect(mockInternalTokenIssuer.issue).not.toHaveBeenCalled();
    });

    it.each([
      ['sem id', { email: 'user@test.com', role: 'user' }],
      ['sem role', { id: 'user-1', email: 'user@test.com' }],
      ['sem email', { id: 'user-1', role: 'user' }],
      ['com id vazio', { id: '', email: 'user@test.com', role: 'user' }],
      ['em formato de string', 'payload-em-string'],
    ])(
      'deve lançar UnauthorizedException sem emitir quando o payload está %s',
      async (_caso, payload) => {
        mockRedisService.isBlacklisted.mockResolvedValue(false);
        mockJwtService.verify.mockReturnValue(payload);

        await expect(service.validateForGateway('valid-token')).rejects.toThrow(
          new UnauthorizedException('Token inválido'),
        );
        expect(mockInternalTokenIssuer.issue).not.toHaveBeenCalled();
      },
    );

    it('não deve transformar uma falha ao emitir o token interno em "Token inválido"', async () => {
      mockRedisService.isBlacklisted.mockResolvedValue(false);
      mockJwtService.verify.mockReturnValue({
        id: 'user-1',
        email: 'user@test.com',
        role: 'user',
      });
      mockInternalTokenIssuer.issue.mockImplementation(() => {
        throw new Error('falha ao assinar');
      });

      const result = service.validateForGateway('valid-token');

      await expect(result).rejects.toThrow('falha ao assinar');
      await expect(result).rejects.not.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout()', () => {
    it('deve adicionar o token na blacklist com o TTL correto', async () => {
      const token = 'valid-token';
      const mockNow = 1700000000;
      jest.spyOn(Date, 'now').mockReturnValue(mockNow * 1000);

      mockJwtService.verify.mockReturnValue({ exp: mockNow + 3600 });
      mockRedisService.blacklist.mockResolvedValue(undefined);

      await service.logout(token);

      expect(mockRedisService.blacklist).toHaveBeenCalledWith(token, 3600);
    });

    it('deve lançar UnauthorizedException quando token não é fornecido', async () => {
      await expect(service.logout('')).rejects.toThrow(UnauthorizedException);
      await expect(service.logout('')).rejects.toThrow('Token não fornecido');
      expect(mockJwtService.verify).not.toHaveBeenCalled();
    });
  });
});
