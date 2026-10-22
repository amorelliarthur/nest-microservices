import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { toJobError } from './job-error';

describe('toJobError()', () => {
  it('deve tornar saldo insuficiente (400) definitivo, sem novas tentativas', () => {
    const error = toJobError(new BadRequestException('Saldo insuficiente'));

    expect(error).toBeInstanceOf(UnrecoverableError);
    expect((error as Error).message).toBe('Saldo insuficiente');
  });

  it('deve tornar conta não encontrada (404) definitivo', () => {
    expect(
      toJobError(new NotFoundException('Conta não encontrada')),
    ).toBeInstanceOf(UnrecoverableError);
  });

  it('deve manter erros de servidor (5xx) repetíveis', () => {
    const error = new InternalServerErrorException('falha interna');

    expect(toJobError(error)).toBe(error);
  });

  it('deve manter erros inesperados (ex.: banco indisponível) repetíveis', () => {
    const error = new Error('connect ECONNREFUSED');

    expect(toJobError(error)).toBe(error);
  });
});
