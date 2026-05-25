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

    async get(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        await this.client.set(key, value, 'EX', ttlSeconds);
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    onModuleDestroy() {
        this.client.disconnect();
    }
}