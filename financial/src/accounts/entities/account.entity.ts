import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Transaction } from '../../transactions/entities/transaction.entity';

export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
}

// no máximo uma conta ativa de cada tipo por usuário, garantido pelo banco
// (a verificação no service sozinha não impede criações simultâneas)
// O migration:generate do TypeORM não compara o `where` de índices parciais:
// ao mudar só o `where` abaixo, escreva a migration à mão.
export const UNIQUE_ACTIVE_ACCOUNT_INDEX = 'UQ_accounts_user_id_type_active';

@Index(UNIQUE_ACTIVE_ACCOUNT_INDEX, ['userId', 'type'], {
  unique: true,
  where: '"active" = true',
})
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
