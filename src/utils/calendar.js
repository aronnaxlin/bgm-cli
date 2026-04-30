/**
 * Calendar/weekday utilities.
 */

export function todayWeekdayId() {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay; // 1=Mon ... 7=Sun
}

export function resolveWeekdaySubcommand(cmd) {
  const map = {
    today: null,          // sentinel for explicit today
    all: "all",           // sentinel for all
    monday: 1, mon: 1,
    tuesday: 2, tue: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
    sunday: 7, sun: 7,
  };
  return map[cmd] !== undefined ? map[cmd] : null;
}
