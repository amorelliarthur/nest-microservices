import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { IsCPF } from 'brazilian-class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  nome!: string;

  @IsEmail({}, { message: 'Email inválido' })
  email!: string;

  @IsString()
  @Length(6, 100, { message: 'Senha deve ter no mínimo 6 caracteres' })
  senha!: string;

  @Transform(({ value }) => value.replace(/\D/g, ''))
  @IsCPF({ message: 'CPF inválido' })
  cpf!: string;
}
