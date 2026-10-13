/** Swedish public holidays, plus the eves nobody works (midsommarafton, julafton, nyårsafton). */

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

/** Easter Sunday, anonymous Gregorian algorithm. */
function easter(y: number) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}

const shift = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000).toISOString().slice(0, 10);

const cache = new Map<number, Map<string, string>>();

export function holidaysOf(y: number): Map<string, string> {
  const hit = cache.get(y);
  if (hit) return hit;
  const e = easter(y);
  // Midsommarafton is the Friday between 19 and 25 June.
  const midsummerEve = [19, 20, 21, 22, 23, 24, 25].map((d) => new Date(Date.UTC(y, 5, d))).find((d) => d.getUTCDay() === 5)!;
  const list: [string, string][] = [
    [iso(y, 1, 1), "Nyårsdagen"],
    [iso(y, 1, 6), "Trettondedag jul"],
    [shift(e, -2), "Långfredagen"],
    [shift(e, 1), "Annandag påsk"],
    [iso(y, 5, 1), "Första maj"],
    [shift(e, 39), "Kristi himmelsfärdsdag"],
    [iso(y, 6, 6), "Nationaldagen"],
    [midsummerEve.toISOString().slice(0, 10), "Midsommarafton"],
    [iso(y, 12, 24), "Julafton"],
    [iso(y, 12, 25), "Juldagen"],
    [iso(y, 12, 26), "Annandag jul"],
    [iso(y, 12, 31), "Nyårsafton"],
  ];
  const map = new Map(list);
  cache.set(y, map);
  return map;
}

/** Name of the holiday on a YYYY-MM-DD date, if it is one. */
export const holidayOn = (isoDate: string) => holidaysOf(Number(isoDate.slice(0, 4))).get(isoDate) ?? null;

/** Monday–Friday and not a holiday. */
export function isWorkday(d: Date) {
  const wd = d.getUTCDay();
  return wd !== 0 && wd !== 6 && !holidayOn(d.toISOString().slice(0, 10));
}
