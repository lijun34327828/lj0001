const dayjs = require('dayjs');

function isValidAmount(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return false;
  if (amount <= 0) return false;
  if (amount > 999999999.99) return false;
  return true;
}

function isValidDate(dateStr) {
  if (!dateStr) return false;
  const d = dayjs(dateStr);
  return d.isValid();
}

function isValidDateRange(startDate, endDate) {
  if (!isValidDate(startDate) || !isValidDate(endDate)) return false;
  return dayjs(startDate).isBefore(endDate) || dayjs(startDate).isSame(endDate);
}

function formatMoney(amount) {
  return Number(parseFloat(amount).toFixed(2));
}

function getMonthRange(year, month) {
  const start = dayjs(`${year}-${month}-01`).startOf('month');
  const end = start.endOf('month');
  return {
    start: start.format('YYYY-MM-DD HH:mm:ss'),
    end: end.format('YYYY-MM-DD HH:mm:ss'),
    startDate: start.format('YYYY-MM-DD'),
    endDate: end.format('YYYY-MM-DD')
  };
}

function getMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function parseMonthKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
}

function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  let result = str.trim();
  result = result.replace(/[<>&"']/g, '');
  if (result.length > maxLength) {
    result = result.substring(0, maxLength);
  }
  return result;
}

function generateIdempotencyKey() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

module.exports = {
  isValidAmount,
  isValidDate,
  isValidDateRange,
  formatMoney,
  getMonthRange,
  getMonthKey,
  parseMonthKey,
  sanitizeString,
  generateIdempotencyKey
};
