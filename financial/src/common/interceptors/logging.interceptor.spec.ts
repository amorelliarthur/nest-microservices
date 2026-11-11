import { Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

const TOKEN_INTERNO = 'eyJ.token-interno.assinatura';
const SEGREDO_GATEWAY = 'segredo-do-gateway';

const contextFor = (headers: Record<string, string>) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        url: '/accounts/me',
        headers,
        body: {},
      }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  }) as unknown as ExecutionContext;

describe('LoggingInterceptor', () => {
  const nodeEnvOriginal = process.env.NODE_ENV;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    // em dev os headers vão para o console; é esse log que conferimos
    process.env.NODE_ENV = 'dev';
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    process.env.NODE_ENV = nodeEnvOriginal;
    jest.restoreAllMocks();
  });

  const logDaRequisicao = async (headers: Record<string, string>) => {
    const next: CallHandler = { handle: () => of(null) };
    await lastValueFrom(
      new LoggingInterceptor().intercept(contextFor(headers), next),
    );
    return logSpy.mock.calls.map((call) => String(call[0])).join('\n');
  };

  it('deve mascarar o token interno e o segredo do gateway nos logs', async () => {
    const log = await logDaRequisicao({
      'x-internal-token': TOKEN_INTERNO,
      'x-gateway-secret': SEGREDO_GATEWAY,
    });

    expect(log).not.toContain(TOKEN_INTERNO);
    expect(log).not.toContain(SEGREDO_GATEWAY);
    expect(log).toContain('"x-internal-token": "******"');
    expect(log).toContain('"x-gateway-secret": "******"');
  });

  it('deve continuar mascarando o token do cliente', async () => {
    const log = await logDaRequisicao({ token: 'jwt-do-cliente' });

    expect(log).not.toContain('jwt-do-cliente');
  });
});
