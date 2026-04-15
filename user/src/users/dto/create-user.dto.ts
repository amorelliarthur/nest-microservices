// src/users/dto/create-user.dto.ts
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateUserDto {
    @IsString()
    @IsNotEmpty({ message: 'Nome é obrigatório' })
    nome!: string;

    @IsEmail({}, { message: 'Email inválido' })
    email!: string;

    @IsString()
    @Length(6, 100, { message: 'Senha deve ter no mínimo 6 caracteres' })
    senha!: string;

    @IsString()
    @IsNotEmpty({ message: 'CPF é obrigatório' })
    cpf!: string;
}