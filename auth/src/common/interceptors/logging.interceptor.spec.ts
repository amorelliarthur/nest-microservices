import { Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { lastValueFrom, of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

// Toda função de escrita do fs vira mock: nada vai para o disco e os testes
// provam que o interceptor não escreve em arquivo por nenhum caminho.
jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  const mockWrites = (names: string[]) =>
    Object.fromEntries(names.map((name) => [name, jest.fn()]));

  return {
    ...actual,
    ...mockWrites([
      'appendFile',
      'appendFileSync',
      'createWriteStream',
      'open',
      'openSync',
      'write',
      'writeFile',
      'writeFileSync',
      'writeSync',
    ]),
    promises: {
      ...actual.promises,
      ...mockWrites(['appendFile', 'open', 'writeFile']),
    },
  };
});
jest.mock('fs/promises', () => ({
  ...jest.requireActual<typeof import('fs/promises')>('fs/promises'),
  appendFile: jest.fn(),
  open: jest.fn(),
  writeFile: jest.fn(),
}));

// nomes das funções de escrita mockadas que foram chamadas
const calledFsWrites = (): string[] =>
  [
    ...Object.entries(fs).map(([name, fn]) => [`fs.${name}`, fn] as const),
    ...Object.entries(fs.promises).map(
      ([name, fn]) => [`fs.promises.${name}`, fn] as const,
    ),
    ...Object.entries(fsPromises).map(
      ([name, fn]) => [`fs/promises.${name}`, fn] as const,
    ),
  ]
    .filter(([, fn]) => jest.isMockFunction(fn) && fn.mock.calls.length > 0)
    .map(([name]) => name);

const GATEWAY_SECRET = 'segredo-do-gateway-que-nunca-vai-para-o-log';
const INTERNAL_TOKEN = 'token-interno-que-nunca-vai-para-o-log';
const CLIENT_TOKEN = 'jwt-do-cliente-que-nunca-vai-para-o-log';

const buildRequest = () => ({
  method: 'POST',
  url: '/internal/validate',
  headers: {
    host: 'localhost:3001',
    'content-type': 'application/json',
    'user-agent': 'axios/1.0',
    'x-gateway-secret': GATEWAY_SECRET,
    'x-internal-token': INTERNAL_TOKEN,
    token: CLIENT_TOKEN,
    'x-header-novo': 'valor-desconhecido',
  },
  body: { email: 'user@test.com', senha: 'Senha@123' },
});

const run = async (
  interceptor: LoggingInterceptor,
  overrides: { url?: string; body?: unknown } = {},
) => {
  const req = { ...buildRequest(), ...overrides };
  const context = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of({}) };

  await lastValueFrom(interceptor.intercept(context, next));
};

describe('LoggingInterceptor', () => {
  const originalEnv = process.env.NODE_ENV;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const loggedText = () =>
    logSpy.mock.calls
      .flat()
      .map((value) => String(value))
      .join('\n');

  describe('em dev (console detalhado)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'dev';
    });

    it('não deve registrar o segredo do gateway nem o token interno', async () => {
      await run(new LoggingInterceptor());

      const text = loggedText();
      expect(text).not.toContain(GATEWAY_SECRET);
      expect(text).not.toContain(INTERNAL_TOKEN);
      expect(text).not.toContain(CLIENT_TOKEN);
    });

    it('deve mostrar como [REDACTED] todo header fora da allowlist', async () => {
      await run(new LoggingInterceptor());

      const text = loggedText();
      expect(text).toContain('"x-gateway-secret": "[REDACTED]"');
      expect(text).toContain('"x-internal-token": "[REDACTED]"');
      expect(text).toContain('"token": "[REDACTED]"');
      // um header sensível novo já nasce protegido
      expect(text).toContain('"x-header-novo": "[REDACTED]"');
    });

    it('deve registrar os headers da allowlist', async () => {
      await run(new LoggingInterceptor());

      const text = loggedText();
      expect(text).toContain('"host": "localhost:3001"');
      expect(text).toContain('"content-type": "application/json"');
      expect(text).toContain('"user-agent": "axios/1.0"');
    });

    it('deve continuar mascarando os campos sensíveis do body', async () => {
      await run(new LoggingInterceptor());

      const text = loggedText();
      expect(text).not.toContain('Senha@123');
      expect(text).toContain('"email": "user@test.com"');
    });

    it('deve mascarar campos sensíveis em objetos aninhados e em arrays', async () => {
      await run(new LoggingInterceptor(), {
        body: {
          dados: { senha: 'SenhaAninhada@1', perfil: { cpf: '52998224725' } },
          contas: [{ token: 'token-dentro-de-array' }],
          tags: ['mercado', 'mensal'],
        },
      });

      const text = loggedText();
      expect(text).not.toContain('SenhaAninhada@1');
      expect(text).not.toContain('52998224725');
      expect(text).not.toContain('token-dentro-de-array');
      // o que não é sensível continua aparecendo
      expect(text).toContain('"mercado"');
    });

    it('deve mascarar campos cujo nome contém um termo sensível', async () => {
      await run(new LoggingInterceptor(), {
        body: {
          novaSenha: 'NovaSenha@1',
          password: 'Password@1',
          refreshToken: 'refresh-token-secreto',
          Authorization: 'Bearer abc',
          descricao: 'Almoço',
        },
      });

      const text = loggedText();
      expect(text).not.toContain('NovaSenha@1');
      expect(text).not.toContain('Password@1');
      expect(text).not.toContain('refresh-token-secreto');
      expect(text).not.toContain('Bearer abc');
      expect(text).toContain('"descricao": "Almoço"');
    });
  });

  describe('em produção (só stdout)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('não deve gravar nada em disco', async () => {
      await run(new LoggingInterceptor());

      expect(calledFsWrites()).toEqual([]);
    });

    it('deve registrar só a linha resumida da requisição', async () => {
      await run(new LoggingInterceptor());

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^POST \/internal\/validate 200 - \d+ms$/),
      );
    });

    it('não deve registrar headers, body nem segredos', async () => {
      await run(new LoggingInterceptor());

      const text = loggedText();
      expect(text).not.toContain('Headers:');
      expect(text).not.toContain('Body:');
      expect(text).not.toContain(GATEWAY_SECRET);
      expect(text).not.toContain(INTERNAL_TOKEN);
      expect(text).not.toContain(CLIENT_TOKEN);
      expect(text).not.toContain('Senha@123');
    });
  });
});
