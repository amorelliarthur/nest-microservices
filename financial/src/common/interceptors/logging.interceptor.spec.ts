import { Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import * as fs from 'fs';
import { lastValueFrom, of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

// os mocks impedem gravar no disco e permitem provar que nada é gravado
jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  appendFileSync: jest.fn(),
  appendFile: jest.fn(),
  createWriteStream: jest.fn(),
}));

const GATEWAY_SECRET = 'segredo-do-gateway-que-nunca-vai-para-o-log';
const INTERNAL_TOKEN = 'token-interno-que-nunca-vai-para-o-log';
const CLIENT_TOKEN = 'jwt-do-cliente-que-nunca-vai-para-o-log';

const buildRequest = () => ({
  method: 'POST',
  url: '/accounts/me',
  headers: {
    host: 'localhost:3004',
    'content-type': 'application/json',
    'user-agent': 'node',
    'x-gateway-secret': GATEWAY_SECRET,
    'x-internal-token': INTERNAL_TOKEN,
    token: CLIENT_TOKEN,
    'x-header-novo': 'valor-desconhecido',
  },
  body: { email: 'user@test.com', senha: 'Senha@123' },
});

const run = async (interceptor: LoggingInterceptor) => {
  const req = buildRequest();
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
  let appendSpy: jest.MockedFunction<typeof fs.appendFileSync>;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    appendSpy = jest.mocked(fs.appendFileSync);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
    appendSpy.mockClear();
  });

  const loggedText = () =>
    [...logSpy.mock.calls, ...appendSpy.mock.calls]
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
      expect(text).toContain('"host": "localhost:3004"');
      expect(text).toContain('"content-type": "application/json"');
      expect(text).toContain('"user-agent": "node"');
    });

    it('deve continuar mascarando os campos sensíveis do body', async () => {
      await run(new LoggingInterceptor());

      const text = loggedText();
      expect(text).not.toContain('Senha@123');
      expect(text).toContain('"email": "user@test.com"');
    });
  });

  describe('em produção (só stdout)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('não deve gravar nada em disco', async () => {
      await run(new LoggingInterceptor());

      expect(appendSpy).not.toHaveBeenCalled();
      expect(fs.appendFile).not.toHaveBeenCalled();
      expect(fs.createWriteStream).not.toHaveBeenCalled();
    });

    it('deve registrar só a linha resumida da requisição', async () => {
      await run(new LoggingInterceptor());

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^POST \/accounts\/me 200 - \d+ms$/),
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
