export const STORE_TIMEZONE = 'Asia/Manila';

export function storeNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: STORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}:${part('second')}`,
  };
}

export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '1900-01-01' &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

export function dateLabel(value: string, long = false) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    day: 'numeric',
    month: long ? 'long' : 'short',
    year: 'numeric',
    ...(long ? { weekday: 'long' as const } : {}),
  }).format(new Date(`${value}T12:00:00Z`));
}

export function timeLabel(value: string) {
  const [h, m] = value.split(':');
  return `${Number(h) % 12 || 12}:${m} ${Number(h) >= 12 ? 'PM' : 'AM'}`;
}
