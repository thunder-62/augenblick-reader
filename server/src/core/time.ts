export const TIME_ZONE = 'Europe/Berlin';

/** Kalendertag (YYYY-MM-DD) in Berliner Zeit. */
export function berlinDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function toIso(value: string | number | Date | undefined | null): string | null {
  if (value === undefined || value === null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
