import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsCpf } from '../../common/validators/is-cpf.validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  nome!: string;

  @IsEmail({}, { message: 'Email inválido' })
  email!: string;

  @IsString()
  @Length(6, 100, { message: 'Senha deve ter no mínimo 6 caracteres' })
  senha!: string;

  // remove a máscara do CPF (pontos e traço) antes da validação
  @Transform(({ value }: { value: string }) => value.replace(/\D/g, ''))
  @IsCpf({ message: 'CPF inválido' })
  cpf!: string;
}
