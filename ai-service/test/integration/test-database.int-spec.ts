import { assertTestDatabase } from './test-database';

const testUrl = process.env.TEST_DATABASE_URL as string;

// Same server, another database: the query only reads, nothing is written
const urlForDatabase = (database: string) => {
  const url = new URL(testUrl);
  url.pathname = `/${database}`;
  return url.toString();
};

describe('assertTestDatabase (integration)', () => {
  it('accepts the test database', async () => {
    await expect(assertTestDatabase(testUrl)).resolves.toBeUndefined();
  });

  it('rejects a connected database whose name does not end with _test', async () => {
    await expect(
      assertTestDatabase(urlForDatabase('postgres')),
    ).rejects.toThrow(
      'Connected database "postgres" does not end with "_test"',
    );
  });

  it('rejects when the URL is not set', async () => {
    await expect(assertTestDatabase(undefined)).rejects.toThrow(
      'TEST_DATABASE_URL is not set',
    );
  });
});
