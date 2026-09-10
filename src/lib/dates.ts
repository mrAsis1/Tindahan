export const STORE_TIMEZONE = 'Asia/Manila';

// Reuse locale setup, but always format the supplied/current time (including midnight).
const storeClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: STORE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const shortDate = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const longDate = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  weekday: 'long',
});

let clockSecond: number | undefined;
let clockValue: { date: string; time: string } | undefined;

export function storeNow(now = new Date()) {
  // Output has second precision. Recheck the instant on every call, including
  // backwards clock changes, but avoid repeating timezone work within a second.
  const second = Math.floor(now.getTime() / 1000);
  if (second === clockSecond && clockValue) return { ...clockValue };
  const parts = storeClock.formatToParts(now);
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  clockValue = {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}:${part('second')}`,
  };
  clockSecond = second;
  return { ...clockValue };
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
  return (long ? longDate : shortDate).format(new Date(`${value}T12:00:00Z`));
}

export function timeLabel(value: string) {
  const [h, m] = value.split(':');
  return `${Number(h) % 12 || 12}:${m} ${Number(h) >= 12 ? 'PM' : 'AM'}`;
}
