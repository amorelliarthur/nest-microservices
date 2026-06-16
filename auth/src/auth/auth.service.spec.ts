import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { RedisService } from '../common/redis/redis.service';

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

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: JwtService, useValue: mockJwtService },
                { provide: HttpService, useValue: mockHttpService },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: RedisService, useValue: mockRedisService },
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

        it('deve lançar UnauthorizedException quando user-service retorna erro', async () => {
            const dto = { email: 'user@test.com', senha: 'errada' };

            mockConfigService.get.mockReturnValue('localhost:3000');
            mockHttpService.post.mockReturnValue(
                throwError(() => ({ response: { status: 401, data: 'Unauthorized' } })),
            );

            await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
            await expect(service.login(dto)).rejects.toThrow('Email ou senha inválidos');
        });

        it('deve lançar ServiceUnavailableException quando user-service está fora do ar', async () => {
            const dto = { email: 'user@test.com', senha: 'senha123' };

            mockConfigService.get.mockReturnValue('localhost:3000');
            mockHttpService.post.mockReturnValue(
                throwError(() => new Error('ECONNREFUSED')),
            );

            await expect(service.login(dto)).rejects.toThrow(ServiceUnavailableException);
            await expect(service.login(dto)).rejects.toThrow('User service indisponível');
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

        it('deve lançar UnauthorizedException quando token não é fornecido', async () => {
            await expect(service.validaToken('')).rejects.toThrow(UnauthorizedException);
            await expect(service.validaToken('')).rejects.toThrow('Token não fornecido');
            expect(mockRedisService.isBlacklisted).not.toHaveBeenCalled();
        });

        it('deve lançar UnauthorizedException quando token está na blacklist', async () => {
            const token = 'blacklisted-token';

            mockRedisService.isBlacklisted.mockResolvedValue(true);

            await expect(service.validaToken(token)).rejects.toThrow(UnauthorizedException);
            await expect(service.validaToken(token)).rejects.toThrow('Token inválido');
            expect(mockJwtService.verify).not.toHaveBeenCalled();
        });

        it('deve lançar UnauthorizedException quando token é inválido', async () => {
            const token = 'tampered-token';

            mockRedisService.isBlacklisted.mockResolvedValue(false);
            mockJwtService.verify.mockImplementation(() => {
                throw new Error('invalid signature');
            });

            await expect(service.validaToken(token)).rejects.toThrow(UnauthorizedException);
            await expect(service.validaToken(token)).rejects.toThrow('Token inválido');
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
