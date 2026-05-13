import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TransactionType } from '../entities/transaction.entity';

export class CreateTransactionDto {
    @IsString()
    @IsNotEmpty()
    accountId!: string;

    @IsEnum(TransactionType, { message: 'Tipo deve ser DEPOSIT, WITHDRAWAL ou TRANSFER' })
    type!: TransactionType;

    @IsNumber()
    @Min(0.01, { message: 'Valor mínimo é 0.01' })
    amount!: number;

    @IsOptional()
    @IsString()
    description?: string;

    // obrigatório apenas em transferências — validamos no service
    @IsOptional()
    @IsString()
    targetAccountId?: string;
}