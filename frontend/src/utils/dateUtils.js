import { format, parseISO, isValid } from 'date-fns';

export function formatDate(date, fmt = 'dd MMM yyyy') {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return isValid(d) ? format(d, fmt) : '-';
  } catch { return '-'; }
}

export function formatDateTime(date) {
  return formatDate(date, 'dd MMM yyyy, hh:mm a');
}

export function formatTime(timeStr) {
  if (!timeStr) return '-';
  try {
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m));
    return format(d, 'hh:mm a');
  } catch { return timeStr; }
}

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function currentMonthISO() {
  return format(new Date(), 'yyyy-MM');
}

export function monthRangeISO(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const from = `${monthStr}-01`;
  const to = format(new Date(year, month, 0), 'yyyy-MM-dd'); // Last day of month
  return { from, to };
}
