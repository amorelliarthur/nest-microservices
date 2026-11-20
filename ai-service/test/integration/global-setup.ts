import { assertTestDatabase } from './test-database';

// Single place for the check: no test runs outside a _test database
export default async () => {
  await assertTestDatabase(process.env.TEST_DATABASE_URL);
};
