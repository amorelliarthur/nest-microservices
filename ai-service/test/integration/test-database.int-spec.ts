import { assertTestDatabase, assertTestDatabaseName } from './test-database';

describe('assertTestDatabaseName', () => {
  it('accepts a name ending with _test', () => {
    expect(() => assertTestDatabaseName('ai_test')).not.toThrow();
  });

  it('rejects a name that does not end with _test', () => {
    expect(() => assertTestDatabaseName('ai')).toThrow(
      'Connected database "ai" does not end with "_test"',
    );
  });
});

describe('assertTestDatabase (integration)', () => {
  it('accepts the connected test database', async () => {
    await expect(
      assertTestDatabase(process.env.TEST_DATABASE_URL),
    ).resolves.toBeUndefined();
  });

  it('rejects when the URL is not set', async () => {
    await expect(assertTestDatabase(undefined)).rejects.toThrow(
      'TEST_DATABASE_URL is not set',
    );
  });
});
