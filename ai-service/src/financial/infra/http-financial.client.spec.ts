import { ConfigService } from '@nestjs/config';
import { FinancialServiceError } from '../domain/financial-service.error';
import { HttpFinancialClient } from './http-financial.client';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const makeSut = () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  const client = new HttpFinancialClient(
    new ConfigService({
      FINANCIAL_SERVER: 'http://financial.test',
      FINANCIAL_TIMEOUT_MS: '3000',
    }),
  );
  return { client, fetchMock };
};

describe('HttpFinancialClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('requests the accounts forwarding the user id with a timeout and converts decimals', async () => {
    const { client, fetchMock } = makeSut();
    fetchMock.mockResolvedValue(
      jsonResponse([
        {
          id: 'acc-1',
          userId: 'user-1',
          type: 'CHECKING',
          balance: '150.50',
          active: true,
        },
      ]),
    );

    await expect(client.listAccounts('user-1')).resolves.toEqual([
      { id: 'acc-1', type: 'CHECKING', balance: 150.5 },
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://financial.test/accounts/user/user-1');
    expect(init?.headers).toEqual({ 'x-user-id': 'user-1' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('parses transactions converting amount and createdAt', async () => {
    const { client, fetchMock } = makeSut();
    fetchMock.mockResolvedValue(
      jsonResponse([
        {
          id: 't1',
          accountId: 'acc-1',
          type: 'WITHDRAWAL',
          amount: '42.90',
          description: null,
          status: 'COMPLETED',
          targetAccountId: null,
          createdAt: '2026-10-15T10:00:00.000Z',
        },
      ]),
    );

    await expect(client.listTransactions('user-1', 'acc-1')).resolves.toEqual([
      {
        id: 't1',
        accountId: 'acc-1',
        type: 'WITHDRAWAL',
        amount: 42.9,
        description: null,
        createdAt: new Date('2026-10-15T10:00:00.000Z'),
      },
    ]);
  });

  it('encodes the account id in the path', async () => {
    const { client, fetchMock } = makeSut();
    fetchMock.mockResolvedValue(jsonResponse([]));

    await client.listTransactions('user-1', '../accounts/x');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://financial.test/transactions/account/..%2Faccounts%2Fx',
    );
  });

  it('throws FinancialServiceError on a non-2xx response', async () => {
    const { client, fetchMock } = makeSut();
    fetchMock.mockResolvedValue(jsonResponse({ message: 'boom' }, 500));

    await expect(client.listAccounts('user-1')).rejects.toThrow(
      FinancialServiceError,
    );
  });

  it('throws FinancialServiceError when the response has an unexpected shape', async () => {
    const { client, fetchMock } = makeSut();
    fetchMock.mockResolvedValue(jsonResponse([{ id: 'acc-1' }]));

    await expect(client.listAccounts('user-1')).rejects.toThrow(
      FinancialServiceError,
    );
  });

  it('throws FinancialServiceError when the request fails or times out', async () => {
    const { client, fetchMock } = makeSut();
    fetchMock.mockRejectedValue(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      ),
    );

    await expect(client.listAccounts('user-1')).rejects.toThrow(
      FinancialServiceError,
    );
  });
});
