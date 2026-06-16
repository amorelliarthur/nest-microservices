import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AccountsService } from './accounts.service';
import { Account, AccountType } from './entities/account.entity';

describe('AccountsService', () => {
    let service: AccountsService;
    let accountRepo: jest.Mocked<Repository<Account>>;

    const buildAccount = (overrides: Partial<Account> = {}): Account =>
    ({
        id: 'acc-1',
        userId: 'user-1',
        type: AccountType.CHECKING,
        balance: 0,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        transactions: [],
        ...overrides,
    } as Account);

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
            accountRepo.create.mockReturnValue(novaConta as any);
            accountRepo.save.mockResolvedValue(novaConta);

            const result = await service.create(dto as any);

            expect(accountRepo.findOne).toHaveBeenCalledWith({
                where: { userId: dto.userId, type: dto.type, active: true },
            });
            expect(accountRepo.create).toHaveBeenCalledWith(dto);
            expect(accountRepo.save).toHaveBeenCalledWith(novaConta);
            expect(result).toBe(novaConta);
        });

        it('deve lançar ConflictException quando o usuário já possui uma conta ativa desse tipo', async () => {
            accountRepo.findOne.mockResolvedValue(buildAccount());

            await expect(service.create(dto as any)).rejects.toThrow(ConflictException);
            expect(accountRepo.create).not.toHaveBeenCalled();
            expect(accountRepo.save).not.toHaveBeenCalled();
        });

        it('deve permitir criar uma conta do mesmo tipo se a anterior estiver inativa', async () => {
            // findOne filtra por active: true, então uma conta inativa não deve bloquear a criação
            accountRepo.findOne.mockResolvedValue(null);
            const novaConta = buildAccount({ type: AccountType.SAVINGS });
            accountRepo.create.mockReturnValue(novaConta as any);
            accountRepo.save.mockResolvedValue(novaConta);

            const result = await service.create({ userId: 'user-1', type: AccountType.SAVINGS } as any);

            expect(result.type).toBe(AccountType.SAVINGS);
        });
    });

    describe('findByUser()', () => {
        it('deve retornar apenas as contas ativas do usuário', async () => {
            const contas = [buildAccount({ id: 'acc-1' }), buildAccount({ id: 'acc-2', type: AccountType.SAVINGS })];
            accountRepo.find.mockResolvedValue(contas);

            const result = await service.findByUser('user-1');

            expect(accountRepo.find).toHaveBeenCalledWith({
                where: { userId: 'user-1', active: true },
            });
            expect(result).toHaveLength(2);
        });

        it('deve retornar uma lista vazia quando o usuário não possui contas', async () => {
            accountRepo.find.mockResolvedValue([]);

            const result = await service.findByUser('user-sem-contas');

            expect(result).toEqual([]);
        });
    });

    describe('findById()', () => {
        it('deve retornar a conta quando ela existe e está ativa', async () => {
            const conta = buildAccount();
            accountRepo.findOne.mockResolvedValue(conta);

            const result = await service.findById('acc-1');

            expect(accountRepo.findOne).toHaveBeenCalledWith({
                where: { id: 'acc-1', active: true },
            });
            expect(result).toBe(conta);
        });

        it('deve lançar NotFoundException quando a conta não existe ou está inativa', async () => {
            accountRepo.findOne.mockResolvedValue(null);

            await expect(service.findById('acc-inexistente')).rejects.toThrow(NotFoundException);
        });
    });

    describe('remove()', () => {
        it('deve desativar a conta (soft delete) mantendo o restante dos dados', async () => {
            const conta = buildAccount({ active: true });
            accountRepo.findOne.mockResolvedValue(conta);
            accountRepo.save.mockResolvedValue({ ...conta, active: false });

            await service.remove('acc-1');

            expect(accountRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'acc-1', active: false }),
            );
        });

        it('deve lançar NotFoundException ao tentar remover uma conta que não existe', async () => {
            accountRepo.findOne.mockResolvedValue(null);

            await expect(service.remove('acc-inexistente')).rejects.toThrow(NotFoundException);
            expect(accountRepo.save).not.toHaveBeenCalled();
        });
    });
});