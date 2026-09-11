export const MAX_CENTAVOS = 999_999_999;

export function parseMoney(value: string): number | null {
  const clean = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [pesos, fraction = ''] = clean.split('.');
  const amount = Number(pesos) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_CENTAVOS ? amount : null;
}

const pesoAmount = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const money = (centavos: number) => `₱${pesoAmount.format(centavos / 100)}`;
