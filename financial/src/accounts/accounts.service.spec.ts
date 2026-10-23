import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { AccountsService } from './accounts.service';
import { Account, AccountType } from './entities/account.entity';
import type { Requester } from '../common/auth/requester';

describe('AccountsService', () => {
  let service: AccountsService;
  let accountRepo: jest.Mocked<Repository<Account>>;

  const dono: Requester = { id: 'user-1', role: 'USER' };
  const outroUsuario: Requester = { id: 'user-2', role: 'USER' };
  const admin: Requester = { id: 'admin-1', role: 'ADMIN' };

  const buildAccount = (overrides: Partial<Account> = {}): Account => ({
    id: 'acc-1',
    userId: 'user-1',
    type: AccountType.CHECKING,
    balance: 0,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    transactions: [],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: getRepositoryToken(Account),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    accountRepo = module.get(getRepositoryToken(Account));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    const dto = { userId: 'user-1', type: AccountType.CHECKING };

    it('deve criar a conta quando o usuário ainda não possui uma conta desse tipo', async () => {
      accountRepo.findOne.mockResolvedValue(null);
      const novaConta = buildAccount();
      accountRepo.create.mockReturnValue(novaConta);
      accountRepo.save.mockResolvedValue(novaConta);

      const result = await service.create(dto);

      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { userId: dto.userId, type: dto.type, active: true },
      });
      expect(accountRepo.create).toHaveBeenCalledWith(dto);
      expect(accountRepo.save).toHaveBeenCalledWith(novaConta);
      expect(result).toBe(novaConta);
    });

    it('deve lançar ConflictException quando o usuário já possui uma conta ativa desse tipo', async () => {
      accountRepo.findOne.mockResolvedValue(buildAccount());

      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
      expect(accountRepo.create).not.toHaveBeenCalled();
      expect(accountRepo.save).not.toHaveBeenCalled();
    });

    it('deve permitir criar uma conta do mesmo tipo se a anterior estiver inativa', async () => {
      // findOne filtra por active: true, então uma conta inativa não deve bloquear a criação
      accountRepo.findOne.mockResolvedValue(null);
      const novaConta = buildAccount({ type: AccountType.SAVINGS });
      accountRepo.create.mockReturnValue(novaConta);
      accountRepo.save.mockResolvedValue(novaConta);

      const result = await service.create({
        userId: 'user-1',
        type: AccountType.SAVINGS,
      });

      expect(result.type).toBe(AccountType.SAVINGS);
    });
  });

  describe('findByUser()', () => {
    it('deve retornar apenas as contas ativas do usuário', async () => {
      const contas = [
        buildAccount({ id: 'acc-1' }),
        buildAccount({ id: 'acc-2', type: AccountType.SAVINGS }),
      ];
      accountRepo.find.mockResolvedValue(contas);

      const result = await service.findByUser('user-1', dono);

      expect(accountRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', active: true },
      });
      expect(result).toHaveLength(2);
    });

    it('deve retornar uma lista vazia quando o usuário não possui contas', async () => {
      accountRepo.find.mockResolvedValue([]);

      const result = await service.findByUser('user-sem-contas', {
        id: 'user-sem-contas',
        role: 'USER',
      });

      expect(result).toEqual([]);
    });

    it('deve permitir que ADMIN liste as contas de outro usuário', async () => {
      const contas = [buildAccount({ id: 'acc-1' })];
      accountRepo.find.mockResolvedValue(contas);

      const result = await service.findByUser('user-1', admin);

      expect(result).toBe(contas);
    });

    it('deve lançar ForbiddenException ao listar contas de outro usuário sem consultar o banco', async () => {
      await expect(service.findByUser('user-1', outroUsuario)).rejects.toThrow(
        ForbiddenException,
      );
      expect(accountRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('findById()', () => {
    it('deve retornar a conta quando ela existe e está ativa', async () => {
      const conta = buildAccount();
      accountRepo.findOne.mockResolvedValue(conta);

      const result = await service.findById('acc-1', dono);

      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'acc-1', active: true },
      });
      expect(result).toBe(conta);
    });

    it('deve permitir que ADMIN veja a conta de outro usuário', async () => {
      const conta = buildAccount();
      accountRepo.findOne.mockResolvedValue(conta);

      const result = await service.findById('acc-1', admin);

      expect(result).toBe(conta);
    });

    it('deve lançar NotFoundException quando a conta não existe ou está inativa', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('acc-inexistente', dono)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve lançar NotFoundException quando a conta é de outro usuário', async () => {
      accountRepo.findOne.mockResolvedValue(buildAccount());

      const promise = service.findById('acc-1', outroUsuario);

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Conta não encontrada');
    });
  });

  describe('remove()', () => {
    it('deve desativar a conta (soft delete) mantendo o restante dos dados', async () => {
      const conta = buildAccount({ active: true });
      accountRepo.findOne.mockResolvedValue(conta);
      accountRepo.save.mockResolvedValue({ ...conta, active: false });

      await service.remove('acc-1', dono);

      expect(accountRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'acc-1', active: false }),
      );
    });

    it('deve lançar NotFoundException ao tentar remover uma conta que não existe', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('acc-inexistente', dono)).rejects.toThrow(
        NotFoundException,
      );
      expect(accountRepo.save).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException ao tentar remover conta de outro usuário sem desativá-la', async () => {
      const conta = buildAccount({ active: true });
      accountRepo.findOne.mockResolvedValue(conta);

      await expect(service.remove('acc-1', outroUsuario)).rejects.toThrow(
        NotFoundException,
      );
      expect(conta.active).toBe(true);
      expect(accountRepo.save).not.toHaveBeenCalled();
    });
  });
});
