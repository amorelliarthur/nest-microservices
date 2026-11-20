import { Client } from 'pg';

// Integration tests truncate tables: they only run on a database whose name
// ends with _test. The name comes from the server after connecting, because
// the URL can point to another database (e.g. a socket with ?db=) without
// changing its pathname.
export const assertTestDatabase = async (
  url: string | undefined,
): Promise<void> => {
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set');
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ name: string }>(
      'SELECT current_database() AS name',
    );
    const name = rows[0].name;
    if (!name.endsWith('_test')) {
      throw new Error(`Connected database "${name}" does not end with "_test"`);
    }
  } finally {
    await client.end();
  }
};
