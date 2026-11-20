import { DataSource } from 'typeorm';
import { TimestampsWithTimeZone1795201933074 } from '../../src/migrations/1795201933074-TimestampsWithTimeZone';

// O global-setup já conferiu que o banco conectado termina em _test
const url = process.env.TEST_DATABASE_URL;

// As linhas antigas foram gravadas pelo DEFAULT now() no fuso da sessão. A
// migration converte como UTC, então se recusa a rodar em outro fuso, em vez
// de deslocar as datas em silêncio.
describe('TimestampsWithTimeZone migration (integration)', () => {
  const tokyo = new DataSource({
    type: 'postgres',
    url,
    extra: { options: '-c timezone=Asia/Tokyo' },
  });

  beforeAll(async () => {
    await tokyo.initialize();
  });

  afterAll(async () => {
    await tokyo.destroy();
  });

  it.each(['up', 'down'] as const)(
    'deve recusar o %s numa sessão fora de UTC',
    async (direction) => {
      // Transação desfeita no fim: o banco de teste já está migrado
      const queryRunner = tokyo.createQueryRunner();
      await queryRunner.startTransaction();
      try {
        await expect(
          new TimestampsWithTimeZone1795201933074()[direction](queryRunner),
        ).rejects.toThrow('UTC');
      } finally {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
      }
    },
  );
});
