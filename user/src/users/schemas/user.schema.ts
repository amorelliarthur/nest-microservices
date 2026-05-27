import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true })
    nome!: string;

    @Prop({ required: true, unique: true })
    email!: string;

    @Prop({ required: true })
    senha!: string;

    @Prop({ required: true, unique: true })
    cpf!: string;

    @Prop({ enum: ['USER', 'ADMIN'], default: 'USER' })
    role!: string;

    @Prop({ default: null })
    deletedAt?: Date;

    // Evento RabbitMQ quando uma transação é concluída
    @Prop({ default: null })
    lastTransactionAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);