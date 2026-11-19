// Fuso à frente de UTC: é onde um prazo calculado no Node encerraria
// transações recém-criadas. Precisa estar no processo real, antes dos testes:
// o process.env de dentro de um arquivo de teste é uma cópia do Jest.
export default () => {
  process.env.TZ = 'Asia/Tokyo';
};
