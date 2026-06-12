/**
 * Format a number as Indian Rupees (₹)
 */
export function formatCurrency(amount, showSymbol = true) {
  if (amount === null || amount === undefined || isNaN(amount)) return showSymbol ? '₹0.00' : '0.00';
  const num = parseFloat(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));
  const sign = num < 0 ? '-' : '';
  return showSymbol ? `${sign}₹${formatted}` : `${sign}${formatted}`;
}

/**
 * Format a compact number (1,200 → ₹1.2K)
 */
export function formatCurrencyCompact(amount) {
  if (!amount) return '₹0';
  const num = parseFloat(amount);
  if (Math.abs(num) >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
  if (Math.abs(num) >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (Math.abs(num) >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return formatCurrency(num);
}

/**
 * Format percentage
 */
export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined) return '0%';
  return `${parseFloat(value).toFixed(decimals)}%`;
}

/**
 * Calculate profit margin
 */
export function calcProfitMargin(sellingPrice, purchasePrice) {
  if (!purchasePrice || purchasePrice === 0) return 0;
  return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
}
