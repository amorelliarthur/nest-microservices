import {
  Injectable,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  Account,
  UNIQUE_ACTIVE_ACCOUNT_INDEX,
} from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { assertAccountAccess } from './account-access';
import { canAccess } from '../common/auth/requester';
import type { Requester } from '../common/auth/requester';

const PG_UNIQUE_VIOLATION = '23505';

const ACCOUNT_TYPE_CONFLICT = 'Usuário já possui uma conta deste tipo';

function isUniqueActiveAccountViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const driverError = err.driverError as { code?: string; constraint?: string };
  return (
    driverError.code === PG_UNIQUE_VIOLATION &&
    driverError.constraint === UNIQUE_ACTIVE_ACCOUNT_INDEX
  );
}

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async create(dto: CreateAccountDto): Promise<Account> {
    // um usuário só pode ter uma conta de cada tipo
    const exists = await this.accountRepo.findOne({
      where: { userId: dto.userId, type: dto.type, active: true },
    });

    if (exists) {
      throw new ConflictException(ACCOUNT_TYPE_CONFLICT);
    }

    const account = this.accountRepo.create(dto);
    try {
      return await this.accountRepo.save(account);
    } catch (err: unknown) {
      // duas criações simultâneas podem passar pela consulta acima; o índice
      // único no banco recusa a segunda, que recebe o mesmo 409
      if (isUniqueActiveAccountViolation(err)) {
        throw new ConflictException(ACCOUNT_TYPE_CONFLICT);
      }
      throw err;
    }
  }

  async findByUser(userId: string, requester: Requester): Promise<Account[]> {
    if (!canAccess(requester, userId)) {
      throw new ForbiddenException(
        'Você não tem permissão para ver as contas deste usuário',
      );
    }

    return this.accountRepo.find({
      where: { userId, active: true },
    });
  }

  async findById(id: string, requester: Requester): Promise<Account> {
    const account = await this.accountRepo.findOne({
      where: { id, active: true },
    });
    return assertAccountAccess(account, requester);
  }

  // soft delete
  async remove(id: string, requester: Requester): Promise<void> {
    const account = await this.findById(id, requester);
    account.active = false;
    await this.accountRepo.save(account);
  }
}
