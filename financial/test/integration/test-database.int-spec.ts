import { assertTestDatabase } from './test-database';

const testUrl = process.env.TEST_DATABASE_URL as string;

// Mesmo servidor, outro banco: a consulta só lê, nada é gravado
const urlForDatabase = (database: string) => {
  const url = new URL(testUrl);
  url.pathname = `/${database}`;
  return url.toString();
};

describe('assertTestDatabase (integration)', () => {
  it('deve aceitar o banco de testes', async () => {
    await expect(assertTestDatabase(testUrl)).resolves.toBeUndefined();
  });

  it('deve recusar um banco conectado cujo nome não termina em _test', async () => {
    await expect(
      assertTestDatabase(urlForDatabase('postgres')),
    ).rejects.toThrow(
      'Connected database "postgres" does not end with "_test"',
    );
  });

  it('deve recusar quando a URL não foi informada', async () => {
    await expect(assertTestDatabase(undefined)).rejects.toThrow(
      'TEST_DATABASE_URL is not set',
    );
  });
});
