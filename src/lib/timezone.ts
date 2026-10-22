export function getUserTimezone(): string {
  try {
    let tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Calcutta') tz = 'Asia/Kolkata';
    return tz && tz.trim() ? tz : 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

export function getTimezoneAbbreviation(timeZone = getUserTimezone()): string {
  if (timeZone === 'Asia/Kolkata' || timeZone === 'Asia/Calcutta') return 'IST';
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find(p => p.type === 'timeZoneName')?.value;
    if (tzPart && !tzPart.startsWith('GMT+')) return tzPart;
  } catch {
    // fallback
  }
  return 'IST';
}
