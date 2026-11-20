import { assertTestDatabase, assertTestDatabaseName } from './test-database';

describe('assertTestDatabaseName', () => {
  it('deve aceitar um nome que termina em _test', () => {
    expect(() => assertTestDatabaseName('financeiro_test')).not.toThrow();
  });

  it('deve recusar um nome que não termina em _test', () => {
    expect(() => assertTestDatabaseName('financeiro')).toThrow(
      'Connected database "financeiro" does not end with "_test"',
    );
  });
});

describe('assertTestDatabase (integration)', () => {
  it('deve aceitar o banco de testes conectado', async () => {
    await expect(
      assertTestDatabase(process.env.TEST_DATABASE_URL),
    ).resolves.toBeUndefined();
  });

  it('deve recusar quando a URL não foi informada', async () => {
    await expect(assertTestDatabase(undefined)).rejects.toThrow(
      'TEST_DATABASE_URL is not set',
    );
  });
});
