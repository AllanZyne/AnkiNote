import { randomUUID } from 'node:crypto';

export function newId() {
  return randomUUID();
}

// ISO-8601 with the local timezone offset (e.g. ...+08:00), not the trailing Z.
export function nowIso(date = new Date()) {
  const tzMin = -date.getTimezoneOffset();          // minutes east of UTC
  const sign = tzMin >= 0 ? '+' : '-';
  const abs = Math.abs(tzMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
         `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
         `.${pad(date.getMilliseconds(), 3)}${sign}${hh}:${mm}`;
}

export function toInstant(iso) {
  return Date.parse(iso);
}
