import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisService {
    getConnectionOptions() {
        return {
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            maxRetriesPerRequest: null, // obrigatório para o BullMQ
        };
    }
}