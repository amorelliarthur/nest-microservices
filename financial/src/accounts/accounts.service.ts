import {
  Injectable,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { assertAccountAccess } from './account-access';
import { canAccess } from '../common/auth/requester';
import type { Requester } from '../common/auth/requester';

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
      throw new ConflictException('Usuário já possui uma conta deste tipo');
    }

    const account = this.accountRepo.create(dto);
    return this.accountRepo.save(account);
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
