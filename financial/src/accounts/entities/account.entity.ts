import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Transaction } from '../../transactions/entities/transaction.entity';

export enum AccountType {
    CHECKING = 'CHECKING',
    SAVINGS = 'SAVINGS',
}

@Entity('accounts') // nome da tabela no banco
export class Account {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    // referência ao user-service — não é FK real, é só o id
    @Column({ name: 'user_id' })
    userId!: string;

    @Column({ type: 'enum', enum: AccountType, default: AccountType.CHECKING })
    type!: AccountType;

    // precisão de 10 dígitos, 2 decimais — padrão para valores monetários
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    balance!: number;

    @Column({ default: true })
    active!: boolean;

    // relacionamento 1:N — uma conta tem muitas transações
    @OneToMany(() => Transaction, (transaction) => transaction.account)
    transactions!: Transaction[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}