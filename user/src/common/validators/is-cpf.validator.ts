import { registerDecorator, ValidationOptions } from 'class-validator';

// 11 dígitos, ou a máscara completa 000.000.000-00
const CPF_FORMAT = /^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/;

// dígito verificador do CPF: soma ponderada dos dígitos anteriores, módulo 11
const checkDigit = (digits: number[]): number => {
  const weightStart = digits.length + 1;
  const sum = digits.reduce(
    (total, digit, index) => total + digit * (weightStart - index),
    0,
  );
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
};

export function isCpf(value: unknown): boolean {
  if (typeof value !== 'string' || !CPF_FORMAT.test(value)) return false;

  const digits = value.replace(/\D/g, '').split('').map(Number);

  // CPFs com todos os dígitos iguais passam no cálculo, mas são inválidos
  if (digits.every((digit) => digit === digits[0])) return false;

  const first = checkDigit(digits.slice(0, 9));
  const second = checkDigit(digits.slice(0, 10));
  return first === digits[9] && second === digits[10];
}

export function IsCpf(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isCpf',
      target: object.constructor,
      propertyName,
      options: {
        ...validationOptions,
        message: validationOptions?.message ?? 'CPF inválido',
      },
      validator: {
        validate: (value: unknown) => isCpf(value),
      },
    });
  };
}
