import { assertTestDatabase } from './test-database';

export default async () => {
  // Fuso à frente de UTC: é onde um prazo calculado no Node encerraria
  // transações recém-criadas. Precisa estar no processo real, antes dos testes:
  // o process.env de dentro de um arquivo de teste é uma cópia do Jest.
  process.env.TZ = 'Asia/Tokyo';

  // Ponto único da checagem: nenhum teste roda fora de um banco _test
  await assertTestDatabase(process.env.TEST_DATABASE_URL);
};
