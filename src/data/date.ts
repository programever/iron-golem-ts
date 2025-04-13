export function getDateMonthsAgo(x: number): Date {
  const now = new Date();
  now.setMonth(now.getMonth() - x);
  return now;
}

export function subDays(date: Date, days: number): Date {
  const newDate = new Date(date);
  newDate.setDate(date.getDate() - days);
  return newDate;
}

export function format(date: Date, formatString: string): string {
  const pad = (num: number) => (num < 10 ? `0${num}` : `${num}`);

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  return formatString.replace('yyyy', `${year}`).replace('MM', month).replace('dd', day);
}
