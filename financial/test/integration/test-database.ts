import { DataSource } from 'typeorm';

export const assertTestDatabaseName = (name: string): void => {
  if (!name.endsWith('_test')) {
    throw new Error(`Connected database "${name}" does not end with "_test"`);
  }
};

// Os testes de integração apagam tabelas: só rodam num banco cujo nome termina
// em _test. O nome vem do próprio servidor, depois de conectar, porque a URL
// pode apontar para outro banco (ex.: socket com ?db=) sem mudar o pathname.
export const assertTestDatabase = async (
  url: string | undefined,
): Promise<void> => {
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set');
  }

  const dataSource = new DataSource({ type: 'postgres', url });
  await dataSource.initialize();
  try {
    const rows: { name: string }[] = await dataSource.query(
      'SELECT current_database() AS name',
    );
    assertTestDatabaseName(rows[0].name);
  } finally {
    await dataSource.destroy();
  }
};
