/** Dropdown label for a category: "602 · CUMPUTER HARDWARE(...)" (account code only when set) */
export const catLabel = (c) => (c?.account_code ? `${c.account_code} · ${c.name}` : c?.name || '');

/** Dropdown label for a department: "504 · INFORMATION TECHNOLOGY" (Dept Code only when set) */
export const deptLabel = (d) => (d?.dept_no ? `${d.dept_no} · ${d.name}` : d?.name || '');

export const LOCALES ={ th: 'th-TH', en: 'en-GB', km: 'km-KH' };

export function fmtDate(value, lang = 'th', opts = {}) {
  if (!value) return '-';
  const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00') : new Date(value);
  if (isNaN(d)) return '-';
  try {
    return new Intl.DateTimeFormat(LOCALES[lang] || 'th-TH', { day: 'numeric', month: 'short', year: 'numeric', ...opts }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

export function fmtDateTime(value, lang = 'th') {
  return fmtDate(value, lang, { hour: '2-digit', minute: '2-digit' });
}

export function fmtMoney(v, lang = 'th') {
  const n = Number(v) || 0;
  try {
    return '฿' + new Intl.NumberFormat(LOCALES[lang] === 'km-KH' ? 'en-US' : LOCALES[lang], { maximumFractionDigits: 2 }).format(n);
  } catch {
    return '฿' + n.toLocaleString();
  }
}

export function fmtNumber(v) {
  return new Intl.NumberFormat('en-US').format(Number(v) || 0);
}

/** Current hour (0-23) in Cambodia time, independent of the device timezone */
export const APP_TIMEZONE = 'Asia/Phnom_Penh';
export function cambodiaHour(date = new Date()) {
  try {
    const h = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: APP_TIMEZONE }).format(date);
    return Number(h) % 24;
  } catch {
    return (date.getUTCHours() + 7) % 24; // Cambodia is UTC+7 all year (no DST)
  }
}

/** morning 05:00–11:59 · afternoon 12:00–16:59 · evening 17:00–04:59 */
export function greetingKey(date = new Date()) {
  const h = cambodiaHour(date);
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  return 'evening';
}

/** Today's date (YYYY-MM-DD) in Cambodia time */
export const today = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  }
};

/** Year-code options for the asset code: 00 (unknown / fully depreciated) + 2023 .. current year */
/** First year offered in the asset-code "Year" dropdown (older assets use 00) */
export const YEAR_FROM = 2000;
/** Current year in Cambodia time */
export const currentYear = () => Number(today().slice(0, 4));
/** Year 2-digit code for the asset code: "26" for 2026, "00" outside YEAR_FROM…current year */
export const yearCode = (y) => (y >= YEAR_FROM && y <= currentYear() ? String(y).slice(2) : '00');

/** Year dropdown: current year down to 2000 → [{ value: '26', year: 2026 }, …, { value: '00', year: 2000 }] */
export function yearOptions() {
  const list = [];
  for (let y = currentYear(); y >= YEAR_FROM; y--) list.push({ value: String(y).slice(2), year: y });
  return list;
}

export function relativeTime(value, t) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return t('time.just_now');
  if (diff < 3600) return t('time.minutes_ago', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('time.hours_ago', { n: Math.floor(diff / 3600) });
  return t('time.days_ago', { n: Math.floor(diff / 86400) });
}
