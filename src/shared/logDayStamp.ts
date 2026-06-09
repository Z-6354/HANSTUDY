/** 本地日历日 YYYY-MM-DD（日志/审计文件名与 UI「今日」一致） */
export function localLogDayStamp(date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
