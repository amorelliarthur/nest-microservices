import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly client: Redis;

    constructor() {
        this.client = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
        });

        this.client.on('connect', () => console.log('[Redis] conectado'));
        this.client.on('error', (err) => console.error('[Redis] erro:', err));
    }

    // adiciona token na blacklist com TTL em segundos
    async blacklist(token: string, ttlSeconds: number): Promise<void> {
        await this.client.set(`blacklist:${token}`, '1', 'EX', ttlSeconds);
    }

    // verifica se token está na blacklist
    async isBlacklisted(token: string): Promise<boolean> {
        const result = await this.client.get(`blacklist:${token}`);
        return result !== null;
    }

    onModuleDestroy() {
        this.client.disconnect();
    }
}