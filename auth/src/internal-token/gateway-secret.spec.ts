import { createGatewaySecretVerifier } from './gateway-secret';

const SECRET = 'segredo-compartilhado-com-pelo-menos-32-caracteres';

// captura a mensagem para conferir o que ela NÃO contém;
// um not.toThrow(valor) também passaria se nada fosse lançado
const errorMessage = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('expected the function to throw');
};

describe('createGatewaySecretVerifier', () => {
  it('deve falhar quando o segredo não está configurado', () => {
    expect(() => createGatewaySecretVerifier(undefined)).toThrow(
      'GATEWAY_SHARED_SECRET',
    );
    expect(() => createGatewaySecretVerifier('   ')).toThrow(
      'GATEWAY_SHARED_SECRET',
    );
  });

  it('deve falhar quando o segredo tem menos de 32 caracteres', () => {
    expect(() => createGatewaySecretVerifier('curto-demais')).toThrow(
      'GATEWAY_SHARED_SECRET',
    );
  });

  it('não deve incluir o segredo na mensagem de erro', () => {
    const message = errorMessage(() =>
      createGatewaySecretVerifier('valor-secreto-curto'),
    );

    expect(message).toContain('GATEWAY_SHARED_SECRET');
    expect(message).not.toContain('valor-secreto-curto');
  });

  it('deve aceitar o segredo correto', () => {
    const verify = createGatewaySecretVerifier(SECRET);

    expect(verify(SECRET)).toBe(true);
  });

  it('deve recusar um segredo diferente com o mesmo tamanho', () => {
    const verify = createGatewaySecretVerifier(SECRET);
    const wrong = SECRET.slice(0, -1) + 'X';

    expect(verify(wrong)).toBe(false);
  });

  it('deve recusar um segredo de tamanho diferente sem lançar erro', () => {
    const verify = createGatewaySecretVerifier(SECRET);

    expect(verify('outro')).toBe(false);
    expect(verify(SECRET + 'a')).toBe(false);
  });

  it('deve recusar quando o segredo não é enviado', () => {
    const verify = createGatewaySecretVerifier(SECRET);

    expect(verify(undefined)).toBe(false);
    expect(verify('')).toBe(false);
  });

  it('deve recusar quando o header vem repetido', () => {
    const verify = createGatewaySecretVerifier(SECRET);

    // o Node junta headers customizados repetidos em uma string
    expect(verify(`${SECRET}, ${SECRET}`)).toBe(false);
    expect(verify([SECRET, SECRET])).toBe(false);
  });
});
