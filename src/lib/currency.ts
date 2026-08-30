export function formatCurrency(value: string | number, locale: string = 'en-US', currency: string = 'SAR'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function parseCurrency(formatted: string): number {
  // Remove any non-digit, non-decimal characters
  const numeric = formatted.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  const num = parseFloat(numeric);
  return isNaN(num) ? 0 : num;
}

/** Format a number with comma separators and 2 decimal places (no currency symbol) */
export function fmtNum(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
