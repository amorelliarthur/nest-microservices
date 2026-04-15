import {
    Injectable,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
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

    async findById(id: string): Promise<UserDocument> {
        const user = await this.userModel.findOne({ _id: id, deletedAt: null });
        if (!user) throw new NotFoundException('Usuário não encontrado');
        return user;
    }

    // Usado internamente pelo auth-service para autenticar
    // async authenticate(email: string, senha: string) {
    //     const user = await this.userModel.findOne({ email, deletedAt: null });
    //     if (!user) throw new NotFoundException('Usuário não encontrado');

    //     const senhaValida = await bcrypt.compare(senha, user.senha);
    //     if (!senhaValida) throw new ConflictException('Senha inválida');

    //     // Não retorna a senha para fora do serviço
    //     const { senha: _, ...result } = user.toObject();
    //     return result;
    // }

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
    }
}