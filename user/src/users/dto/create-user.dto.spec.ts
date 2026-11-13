import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  const validBody = {
    nome: 'Ana',
    email: 'ana@example.com',
    senha: 'Senha@123',
    cpf: '123.456.789-09',
  };

  // mesmo caminho do ValidationPipe com transform: true
  const validateBody = async (body: Record<string, unknown>) => {
    const dto = plainToInstance(CreateUserDto, body);
    const errors = await validate(dto);
    return { dto, errors };
  };

  describe('cpf', () => {
    it('deve aceitar o CPF com máscara e guardá-lo só com os dígitos', async () => {
      const { dto, errors } = await validateBody(validBody);

      expect(errors).toHaveLength(0);
      expect(dto.cpf).toBe('12345678909');
    });

    it('deve aceitar o CPF sem máscara', async () => {
      const { errors } = await validateBody({
        ...validBody,
        cpf: '12345678909',
      });

      expect(errors).toHaveLength(0);
    });

    it('deve recusar um CPF inválido com a mensagem "CPF inválido"', async () => {
      const { errors } = await validateBody({
        ...validBody,
        cpf: '123.456.789-00',
      });

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('cpf');
      expect(Object.values(errors[0].constraints ?? {})).toEqual([
        'CPF inválido',
      ]);
    });
  });
});
