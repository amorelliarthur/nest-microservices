import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// Índice composto — acelera buscas por conta + data (extrato)
@Index(['accountId', 'createdAt'])
// Índice parcial das PENDING — acelera a rotina que encerra as antigas.
// O TypeORM não detecta mudanças só no `where`: altere com migration à mão.
@Index('IDX_transactions_pending_created_at', ['createdAt'], {
  where: `"status" = 'PENDING'`,
})
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'account_id' })
  accountId!: string;

  // relacionamento N:1 — muitas transações pertencem a uma conta
  @ManyToOne(() => Account, (account) => account.transactions)
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ nullable: true })
  description!: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status!: TransactionStatus;

  // motivo exibido ao usuário quando o status é FAILED; vazio nos demais
  @Column({ name: 'failure_reason', type: 'varchar', nullable: true })
  failureReason!: string | null;

  // id da conta destino — usado em transferências
  @Column({ name: 'target_account_id', nullable: true })
  targetAccountId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
