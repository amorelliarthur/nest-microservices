import { validate } from 'class-validator';
import { IsCpf, isCpf } from './is-cpf.validator';

describe('isCpf', () => {
  it.each([
    ['12345678909'],
    ['123.456.789-09'],
    ['98765432100'],
    ['52998224725'],
  ])('deve aceitar o CPF válido %s', (value) => {
    expect(isCpf(value)).toBe(true);
  });

  it.each([
    ['12345678900', 'dígito verificador errado'],
    ['12345678919', 'primeiro dígito verificador errado'],
    ['11111111111', 'todos os dígitos iguais'],
    ['00000000000', 'todos os dígitos zero'],
    ['1234567890', '10 dígitos'],
    ['123456789090', '12 dígitos'],
    ['', 'vazio'],
    ['abcdefghijk', 'letras'],
    ['123.456.78909', 'máscara incompleta'],
    ['123 456 789 09', 'espaços no lugar da máscara'],
    [' 12345678909', 'espaço antes'],
  ])('deve recusar %s (%s)', (value) => {
    expect(isCpf(value)).toBe(false);
  });

  it.each([[12345678909], [null], [undefined], [{}], [['12345678909']]])(
    'deve recusar o valor %p, que não é texto',
    (value) => {
      expect(isCpf(value)).toBe(false);
    },
  );
});

describe('IsCpf', () => {
  class Pessoa {
    @IsCpf({ message: 'CPF inválido' })
    cpf: unknown;

    constructor(cpf: unknown) {
      this.cpf = cpf;
    }
  }

  it('não deve gerar erro para um CPF válido', async () => {
    const errors = await validate(new Pessoa('12345678909'));

    expect(errors).toHaveLength(0);
  });

  it('deve gerar erro com a mensagem configurada para um CPF inválido', async () => {
    const errors = await validate(new Pessoa('12345678900'));

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('cpf');
    expect(errors[0].constraints).toEqual({ isCpf: 'CPF inválido' });
  });

  it('deve usar uma mensagem padrão quando nenhuma é configurada', async () => {
    class SemMensagem {
      @IsCpf()
      cpf = '11111111111';
    }

    const errors = await validate(new SemMensagem());

    expect(errors[0].constraints).toEqual({ isCpf: 'CPF inválido' });
  });

  it('deve manter a mensagem padrão quando a opção message vem undefined', async () => {
    class MensagemUndefined {
      @IsCpf({ message: undefined })
      cpf = '11111111111';
    }

    const errors = await validate(new MensagemUndefined());

    expect(errors[0].constraints).toEqual({ isCpf: 'CPF inválido' });
  });
});
