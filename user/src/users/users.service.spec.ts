import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { RedisService } from '../common/redis/redis.service';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { User } from './schemas/user.schema';

// bcrypt é um módulo nativo (binding C++) — jest.spyOn falha com
// "Cannot redefine property" porque suas funções não são configuráveis.
// Mockamos o módulo inteiro para poder controlar o retorno de hash/compare.
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let userModel: any;
  let redisService: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let rabbitMQService: { publish: jest.Mock };

  // mock simples de um documento mongoose, com save() e toObject() encadeáveis
  const buildUserDoc = (overrides: Partial<any> = {}) => {
    const base = {
      _id: '6839a1b2c3d4e5f6a7b8c9d0',
      nome: 'Arthur',
      email: 'arthur@user.br',
      senha: 'hashed-senha',
      cpf: '14352312212',
      role: 'USER',
      deletedAt: null,
      ...overrides,
    };

    return {
      ...base,
      set: jest.fn(),
      save: jest.fn(),
      toObject: jest.fn().mockReturnValue(base),
    };
  };

  beforeEach(async () => {
    // mock do model do mongoose — userModel é usado tanto como função (new this.userModel(...))
    // quanto com métodos estáticos (findOne, findOneAndUpdate, find)
    userModel = jest.fn().mockImplementation((data: any) => ({
      ...data,
      save: jest
        .fn()
        .mockResolvedValue({ ...data, _id: '6839a1b2c3d4e5f6a7b8c9d0' }),
    }));
    userModel.findOne = jest.fn();
    userModel.findOneAndUpdate = jest.fn();
    userModel.find = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: RedisService,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        {
          provide: RabbitMQService,
          useValue: { publish: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    redisService = module.get(RedisService);
    rabbitMQService = module.get(RabbitMQService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    const dto = {
      nome: 'Arthur',
      email: 'arthur@user.br',
      senha: 'Senha@123',
      cpf: '14352312212',
    };

    it('deve criar um novo usuário quando não existe email ou cpf cadastrado', async () => {
      userModel.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-senha');

      const result = await service.create(dto as any);

      expect(userModel.findOne).toHaveBeenCalledWith({
        $or: [{ email: dto.email }, { cpf: dto.cpf }],
      });
      expect(userModel).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.email,
          senha: 'hashed-senha',
          deletedAt: null,
        }),
      );
      expect(rabbitMQService.publish).toHaveBeenCalledWith(
        'user.created',
        expect.objectContaining({ nome: dto.nome, email: dto.email }),
      );
      expect(result).toBeDefined();
    });

    it('deve lançar ConflictException quando email ou cpf já estão cadastrados e o usuário está ativo', async () => {
      const existente = buildUserDoc({ deletedAt: null });
      userModel.findOne.mockResolvedValue(existente);

      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
      expect(rabbitMQService.publish).not.toHaveBeenCalled();
    });

    it('deve reativar o usuário quando ele existe mas está com deletedAt preenchido', async () => {
      const existente = buildUserDoc({ deletedAt: new Date() });
      existente.save.mockResolvedValue({ ...existente, deletedAt: null });
      userModel.findOne.mockResolvedValue(existente);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-senha');

      const result = await service.create(dto as any);

      expect(existente.set).toHaveBeenCalledWith(
        expect.objectContaining({ senha: 'hashed-senha', deletedAt: null }),
      );
      expect(existente.save).toHaveBeenCalled();
      expect(rabbitMQService.publish).toHaveBeenCalledWith(
        'user.created',
        expect.any(Object),
      );
      expect(result).toBeDefined();
    });
  });

  describe('findById()', () => {
    const userId = '6839a1b2c3d4e5f6a7b8c9d0';

    it('deve retornar o usuário do cache quando houver HIT no Redis', async () => {
      const cachedUser = buildUserDoc({ _id: userId }).toObject();
      redisService.get.mockResolvedValue(JSON.stringify(cachedUser));

      const result = await service.findById(userId);

      expect(redisService.get).toHaveBeenCalledWith(`user:${userId}`);
      expect(userModel.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(cachedUser);
    });

    it('deve buscar no MongoDB e popular o cache quando houver MISS no Redis', async () => {
      const userDoc = buildUserDoc({ _id: userId });
      redisService.get.mockResolvedValue(null);
      userModel.findOne.mockResolvedValue(userDoc);

      const result = await service.findById(userId);

      expect(userModel.findOne).toHaveBeenCalledWith({
        _id: userId,
        deletedAt: null,
      });
      expect(redisService.set).toHaveBeenCalledWith(
        `user:${userId}`,
        JSON.stringify(userDoc.toObject()),
        300,
      );
      expect(result).toBe(userDoc);
    });

    it('deve lançar NotFoundException quando o usuário não existe', async () => {
      redisService.get.mockResolvedValue(null);
      userModel.findOne.mockResolvedValue(null);

      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('authenticate()', () => {
    it('deve retornar o usuário sem a senha quando as credenciais são válidas', async () => {
      const userDoc = buildUserDoc({ senha: 'hashed-senha' });
      userModel.findOne.mockResolvedValue(userDoc);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.authenticate('arthur@user.br', 'Senha@123');

      expect(result).not.toHaveProperty('senha');
    });

    it('deve lançar NotFoundException quando o usuário não existe', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(
        service.authenticate('inexistente@user.br', 'Senha@123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar UnauthorizedException quando a senha está incorreta', async () => {
      const userDoc = buildUserDoc({ senha: 'hashed-senha' });
      userModel.findOne.mockResolvedValue(userDoc);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.authenticate('arthur@user.br', 'errada'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('update()', () => {
    const userId = '6839a1b2c3d4e5f6a7b8c9d0';

    it('deve atualizar o usuário e invalidar o cache', async () => {
      const userAtualizado = buildUserDoc({
        _id: userId,
        nome: 'Arthur Atualizado',
      });
      userModel.findOneAndUpdate.mockResolvedValue(userAtualizado);

      const result = await service.update(userId, {
        nome: 'Arthur Atualizado',
      } as any);

      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: userId, deletedAt: null },
        { nome: 'Arthur Atualizado' },
        { returnDocument: 'after' },
      );
      expect(redisService.del).toHaveBeenCalledWith(`user:${userId}`);
      expect(result).toBe(userAtualizado);
    });

    it('deve fazer hash da senha quando ela é informada na atualização', async () => {
      const userAtualizado = buildUserDoc({ _id: userId });
      userModel.findOneAndUpdate.mockResolvedValue(userAtualizado);
      (bcrypt.hash as jest.Mock).mockResolvedValue('nova-senha-hash');

      await service.update(userId, { senha: 'NovaSenha@123' } as any);

      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: userId, deletedAt: null },
        { senha: 'nova-senha-hash' },
        { returnDocument: 'after' },
      );
    });

    it('deve lançar NotFoundException quando o usuário não existe', async () => {
      userModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.update(userId, { nome: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(redisService.del).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    const userId = '6839a1b2c3d4e5f6a7b8c9d0';

    it('deve fazer soft delete do usuário e invalidar o cache', async () => {
      const userRemovido = buildUserDoc({ _id: userId, deletedAt: new Date() });
      userModel.findOneAndUpdate.mockResolvedValue(userRemovido);

      await service.remove(userId);

      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: userId, deletedAt: null },
        { deletedAt: expect.any(Date) },
        { returnDocument: 'after' },
      );
      expect(redisService.del).toHaveBeenCalledWith(`user:${userId}`);
    });

    it('deve lançar NotFoundException quando o usuário não existe', async () => {
      userModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(service.remove(userId)).rejects.toThrow(NotFoundException);
      expect(redisService.del).not.toHaveBeenCalled();
    });
  });
});
