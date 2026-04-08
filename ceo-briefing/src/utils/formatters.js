const dayjs = require('dayjs');

function currency(amount) {
  if (amount == null || isNaN(amount)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function number(val, decimals = 0) {
  if (val == null || isNaN(val)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

function percent(val, decimals = 1) {
  if (val == null || isNaN(val)) return '0%';
  return `${val.toFixed(decimals)}%`;
}

function date(d, fmt = 'MMM D, YYYY') {
  return dayjs(d).format(fmt);
}

function shortDate(d) {
  return dayjs(d).format('M/D');
}

function time(d) {
  return dayjs(d).format('h:mm A');
}

function weekRange(startDate) {
  const start = dayjs(startDate);
  const end = start.add(6, 'day');
  return `${start.format('M/D')} - ${end.format('M/D')}`;
}

function cashFlowColor(amount) {
  if (amount > 0) return '#22c55e';
  if (amount < 0) return '#ef4444';
  return '#6b7280';
}

function statusColor(status) {
  const colors = {
    critical: '#ef4444',
    warning: '#f59e0b',
    healthy: '#22c55e',
    neutral: '#6b7280',
  };
  return colors[status] || colors.neutral;
}

function statusEmoji(status) {
  const emojis = { critical: '🔴', warning: '🟡', healthy: '🟢' };
  return emojis[status] || '';
}

module.exports = {
  currency,
  number,
  percent,
  date,
  shortDate,
  time,
  weekRange,
  cashFlowColor,
  statusColor,
  statusEmoji,
};
