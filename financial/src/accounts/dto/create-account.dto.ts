import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { AccountType } from '../entities/account.entity';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsEnum(AccountType, { message: 'Tipo deve ser CHECKING ou SAVINGS' })
  type!: AccountType;
}
