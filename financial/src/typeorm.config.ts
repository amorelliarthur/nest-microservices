import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { Account } from './accounts/entities/account.entity';
import { Transaction } from './transactions/entities/transaction.entity';

export default new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [Account, Transaction],
    migrations: ['src/migrations/*.ts'],
});