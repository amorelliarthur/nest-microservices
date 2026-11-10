import { loadGatewaySecret } from './gateway-secret';

const SECRET = 'segredo-compartilhado-com-pelo-menos-32-caracteres';

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
    expect(() => loadGatewaySecret('curto-demais')).not.toThrow('curto-demais');
  });
});
