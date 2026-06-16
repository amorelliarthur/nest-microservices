import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';

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

  async findByUser(userId: string): Promise<Account[]> {
    return this.accountRepo.find({
      where: { userId, active: true },
    });
  }

  async findById(id: string): Promise<Account> {
    const account = await this.accountRepo.findOne({
      where: { id, active: true },
    });
    if (!account) throw new NotFoundException('Conta não encontrada');
    return account;
  }

  // soft delete
  async remove(id: string): Promise<void> {
    const account = await this.findById(id);
    account.active = false;
    await this.accountRepo.save(account);
  }
}
