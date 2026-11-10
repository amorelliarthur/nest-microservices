import { loadGatewaySecret } from './gateway-secret';

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

describe('loadGatewaySecret', () => {
  it('deve devolver o segredo quando ele tem pelo menos 32 caracteres', () => {
    expect(loadGatewaySecret(SECRET)).toBe(SECRET);
  });

  it('deve falhar quando o segredo não está configurado', () => {
    expect(() => loadGatewaySecret(undefined)).toThrow('GATEWAY_SHARED_SECRET');
    expect(() => loadGatewaySecret('   ')).toThrow('GATEWAY_SHARED_SECRET');
  });

  it('deve falhar quando o segredo tem menos de 32 caracteres', () => {
    expect(() => loadGatewaySecret('curto-demais')).toThrow(
      'GATEWAY_SHARED_SECRET',
    );
  });

  it('não deve incluir o segredo na mensagem de erro', () => {
    const message = errorMessage(() =>
      loadGatewaySecret('valor-secreto-curto'),
    );

    expect(message).toContain('GATEWAY_SHARED_SECRET');
    expect(message).not.toContain('valor-secreto-curto');
  });
});
