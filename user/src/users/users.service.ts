import {
    Injectable,
    ConflictException,
    NotFoundException,
    UnauthorizedException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RedisService } from '../common/redis/redis.service';

const CACHE_TTL = 300; // 5 minutos

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private readonly redisService: RedisService,
    ) { }

    async create(dto: CreateUserDto): Promise<UserDocument> {
        const existe = await this.userModel.findOne({
            $or: [{ email: dto.email }, { cpf: dto.cpf }],
        });

        // Ativo: bloqueia
        if (existe && !existe.deletedAt) {
            throw new ConflictException('Email ou CPF já cadastrado');
        }

        const senhaHash = await bcrypt.hash(dto.senha, 10);

        // Deletado: reativa com os novos dados
        if (existe && existe.deletedAt) {
            existe.set({ ...dto, senha: senhaHash, deletedAt: null });
            return existe.save();
        }

        // Novo usuário
        return new this.userModel({ ...dto, senha: senhaHash, deletedAt: null }).save();
    }

    async findAll(nome?: string): Promise<UserDocument[]> {
        const filtro: any = { deletedAt: null };

        // Se enviou nome, busca por regex case-insensitive
        if (nome) {
            filtro.nome = { $regex: nome, $options: 'i' };
        }

        return this.userModel.find(filtro);
    }

    async findById(id: string): Promise<UserDocument> {
        const cacheKey = `user:${id}`;

        // tenta buscar do cache primeiro
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            console.log(`[Cache] HIT user:${id}`);
            return JSON.parse(cached);
        }

        // se não tem cache, busca no MongoDB
        console.log(`[Cache] MISS user:${id}`);
        const user = await this.userModel.findOne({ _id: id, deletedAt: null });
        if (!user) throw new NotFoundException('Usuário não encontrado');

        // salva no cache para próximas requisições
        await this.redisService.set(cacheKey, JSON.stringify(user.toObject()), CACHE_TTL);

        return user;
    }

    // Usado internamente pelo auth-service para autenticar
    async authenticate(email: string, senha: string) {
        const user = await this.userModel.findOne({ email, deletedAt: null });
        if (!user) throw new NotFoundException('Usuário não encontrado');

        const senhaValida = await bcrypt.compare(senha, user.senha);
        if (!senhaValida) throw new UnauthorizedException('Credenciais inválidas');

        // Não retorna a senha para fora do serviço
        const { senha: _, ...result } = user.toObject();
        return result;
    }

    async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
        if (dto.senha) {
            dto.senha = await bcrypt.hash(dto.senha, 10);
        }

        const user = await this.userModel.findOneAndUpdate(
            { _id: id, deletedAt: null },
            dto,
            { returnDocument: 'after' },
        );

        if (!user) throw new NotFoundException('Usuário não encontrado');

        // invalida o cache — dados foram alterados
        await this.redisService.del(`user:${id}`);
        console.log(`[Cache] INVALIDATED user:${id}`);
        return user;
    }

    // Soft delete
    async remove(id: string): Promise<void> {
        const user = await this.userModel.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { deletedAt: new Date() },
            { returnDocument: 'after' },
        );

        if (!user) throw new NotFoundException('Usuário não encontrado');

        // invalida o cache — usuário foi deletado
        await this.redisService.del(`user:${id}`);
        console.log(`[Cache] INVALIDATED user:${id}`);
    }
}