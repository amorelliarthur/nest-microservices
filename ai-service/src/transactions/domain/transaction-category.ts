export const TRANSACTION_CATEGORIES = [
  'alimentacao',
  'transporte',
  'moradia',
  'saude',
  'lazer',
  'educacao',
  'outros',
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];
